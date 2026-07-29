import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { permissionsFor } from '../../common/permissions/permissions.config';
import type { AppConfig } from '../../config/configuration';
import { AuthProvider, UserRole, UserStatus } from '../../generated/prisma/enums';
import type { CurrentSessionDto, SessionDto, SessionUserDto } from './dto/session.dto';
import type { RegisterDto } from './dto/credentials.dto';
import { PasswordService } from './password.service';
import { AuthRepository, type UserCredentials } from './repositories/auth.repository';
import { TokenService, type RequestOrigin } from './token.service';

/**
 * One message for every way a sign-in can fail.
 *
 * Distinguishing "no such email" from "wrong password" from "locked" turns the
 * endpoint into an account-enumeration oracle, which is worth more to an
 * attacker than the hint is to a user.
 */
const INVALID_CREDENTIALS = 'Invalid email or password';

export interface GoogleProfile {
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/** A session the caller still has to deliver: the cookie is the controller's job. */
export interface IssuedSession {
  session: SessionDto;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxAttempts: number;
  private readonly lockoutMinutes: number;
  private readonly defaultOrganizationSlug: string;

  constructor(
    private readonly users: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    config: ConfigService<AppConfig, true>,
  ) {
    const login = config.get('login', { infer: true });
    this.maxAttempts = login.maxAttempts;
    this.lockoutMinutes = login.lockoutMinutes;
    this.defaultOrganizationSlug = config.get('defaultOrganizationSlug', { infer: true });
  }

  /**
   * Self-registration into the default organization, as the lowest role. Creating
   * organizations is deferred until the SaaS is real, and an admin promotes from
   * the admin panel.
   *
   * @throws {ConflictException} when the email is taken. This does reveal that an
   * account exists — hiding it means answering 201 and settling the truth over
   * email, which needs delivery this project does not have yet.
   */
  async register(dto: RegisterDto): Promise<AuthenticatedUser> {
    const organization = await this.users.findOrganizationBySlug(this.defaultOrganizationSlug);

    if (!organization) {
      this.logger.error(
        `DEFAULT_ORGANIZATION_SLUG points at "${this.defaultOrganizationSlug}", which does not exist. Run the seed.`,
      );
      throw new ServiceUnavailableException('Registration is unavailable');
    }

    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('That email is already registered');
    }

    const created = await this.users.createUser({
      organizationId: organization.id,
      email: dto.email,
      name: dto.name,
      passwordHash: await this.passwords.hash(dto.password),
      role: UserRole.OPERATOR,
      status: UserStatus.ACTIVE,
    });

    return this.toAuthenticatedUser(created);
  }

  /**
   * Backs the local Passport strategy.
   *
   * Every rejection path runs an argon2 verification, real or decoy, so that
   * response time does not tell an unknown email from a known one.
   *
   * @throws {UnauthorizedException} always with the same message.
   */
  async validateCredentials(email: string, password: string): Promise<AuthenticatedUser> {
    // Normalized here and not by the DTO: guards run before pipes, so the local
    // strategy reads the raw body and LoginDto never touches it.
    const user = await this.users.findByEmail(email.trim().toLowerCase());

    if (!user || user.status !== UserStatus.ACTIVE || !user.passwordHash || this.isLocked(user)) {
      await this.passwords.verifyDecoy(password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!(await this.passwords.verify(user.passwordHash, password))) {
      await this.registerFailedAttempt(user);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.users.markLoginSucceeded(user.id);

    return this.toAuthenticatedUser(user);
  }

  /**
   * Resolves a Google profile to a user, linking rather than duplicating.
   *
   * An address that already signs in with a password gets Google attached to the
   * same account; without this the same person ends up with two accounts and
   * half their history under each.
   *
   * @throws {UnauthorizedException} when the account is suspended.
   */
  async signInWithGoogle(profile: GoogleProfile): Promise<AuthenticatedUser> {
    const linked = await this.users.findByProviderAccount(
      AuthProvider.GOOGLE,
      profile.providerAccountId,
    );

    if (linked) {
      if (linked.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException('This account is suspended');
      }

      await this.users.markLoginSucceeded(linked.id);
      return this.toAuthenticatedUser(linked);
    }

    const existing = await this.users.findByEmail(profile.email);

    if (existing) {
      if (existing.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException('This account is suspended');
      }

      await this.users.linkIdentity(existing.id, AuthProvider.GOOGLE, profile.providerAccountId);
      const confirmed = await this.users.confirmGoogleLink(existing.id, profile.avatarUrl);
      await this.users.markLoginSucceeded(confirmed.id);

      return this.toAuthenticatedUser(confirmed);
    }

    const organization = await this.users.findOrganizationBySlug(this.defaultOrganizationSlug);

    if (!organization) {
      this.logger.error(
        `DEFAULT_ORGANIZATION_SLUG points at "${this.defaultOrganizationSlug}", which does not exist. Run the seed.`,
      );
      throw new ServiceUnavailableException('Sign-in is unavailable');
    }

    const created = await this.users.createUser({
      organizationId: organization.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      passwordHash: null,
      role: UserRole.OPERATOR,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    });

    await this.users.linkIdentity(created.id, AuthProvider.GOOGLE, profile.providerAccountId);
    await this.users.markLoginSucceeded(created.id);

    return this.toAuthenticatedUser(created);
  }

  async issueSession(user: AuthenticatedUser, origin: RequestOrigin): Promise<IssuedSession> {
    const access = await this.tokens.issueAccessToken(user);
    const refreshToken = await this.tokens.issueRefreshToken(user.id, origin);

    return {
      session: {
        accessToken: access.token,
        expiresIn: access.expiresInSeconds,
        user: this.toSessionUser(user),
      },
      refreshToken,
    };
  }

  /** @throws {UnauthorizedException} when the token is unknown, expired or replayed. */
  async refreshSession(rawToken: string, origin: RequestOrigin): Promise<IssuedSession> {
    const { userId, raw } = await this.tokens.rotate(rawToken, origin);
    const user = await this.users.findById(userId);

    if (!user || user.status !== UserStatus.ACTIVE) {
      // The account was suspended or deleted while the session was alive.
      await this.tokens.revokeAllForUser(userId);
      throw new UnauthorizedException('Invalid session');
    }

    const authenticated = this.toAuthenticatedUser(user);
    const access = await this.tokens.issueAccessToken(authenticated);

    return {
      session: {
        accessToken: access.token,
        expiresIn: access.expiresInSeconds,
        user: this.toSessionUser(authenticated),
      },
      refreshToken: raw,
    };
  }

  signOut(rawToken: string): Promise<void> {
    return this.tokens.revoke(rawToken);
  }

  /** @throws {UnauthorizedException} when the user vanished mid-session. */
  async currentSession(userId: string): Promise<CurrentSessionDto> {
    const profile = await this.users.findProfile(userId);

    if (!profile) {
      throw new UnauthorizedException('Invalid session');
    }

    return {
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        role: profile.role,
        status: profile.status,
      },
      organization: profile.organization,
      permissions: [...permissionsFor(profile.role)],
    };
  }

  /** Backs the JWT strategy: the user is re-read so a role change lands at once. */
  async resolveTokenSubject(userId: string): Promise<AuthenticatedUser> {
    const user = await this.users.findById(userId);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid session');
    }

    return this.toAuthenticatedUser(user);
  }

  private isLocked(user: UserCredentials): boolean {
    return user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now();
  }

  /** Counting restarts once the account locks, so each window gets a full budget. */
  private async registerFailedAttempt(user: UserCredentials): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const reached = attempts >= this.maxAttempts;

    await this.users.markLoginFailed(
      user.id,
      reached ? 0 : attempts,
      reached ? new Date(Date.now() + this.lockoutMinutes * 60_000) : null,
    );
  }

  private toAuthenticatedUser(user: UserCredentials): AuthenticatedUser {
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: permissionsFor(user.role),
      avatarUrl: user.avatarUrl,
      status: user.status,
    };
  }

  private toSessionUser(user: AuthenticatedUser): SessionUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
    };
  }
}
