import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { permissionsFor } from '../../common/permissions/permissions.config';
import type { AppConfig } from '../../config/configuration';
import { AuthProvider, UserStatus } from '../../generated/prisma/enums';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type { CurrentSessionDto, SessionDto, SessionUserDto } from './dto/session.dto';
import { PasswordService } from './password.service';
import { AuthRepository, type UserCredentials } from './repositories/auth.repository';
import { TokenService, type RequestOrigin } from './token.service';

/**
 * One message for every way a sign-in can fail *before* the password is proven.
 *
 * Distinguishing "no such email" from "wrong password" from "locked" turns the
 * endpoint into an account-enumeration oracle, which is worth more to an
 * attacker than the hint is to a user.
 */
const INVALID_CREDENTIALS = 'Invalid email or password';

/**
 * Said only once the password has verified.
 *
 * At that point the caller already holds the credentials, so naming the reason
 * gives away nothing they could not confirm another way — while withholding it
 * sends a suspended user off to reset a password that was never the problem.
 */
const NOT_SIGNABLE: Record<Exclude<UserStatus, typeof UserStatus.ACTIVE>, string> = {
  [UserStatus.SUSPENDED]: 'This account is suspended. Ask an administrator to restore it.',
  [UserStatus.INVITED]: 'This invitation has not been accepted yet.',
};

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
  private readonly maxAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(
    private readonly users: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    config: ConfigService<AppConfig, true>,
  ) {
    const login = config.get('login', { infer: true });
    this.maxAttempts = login.maxAttempts;
    this.lockoutMinutes = login.lockoutMinutes;
  }

  /**
   * Backs the local Passport strategy.
   *
   * Every rejection path runs an argon2 verification, real or decoy, so that
   * response time does not tell an unknown email from a known one.
   *
   * The account's status is checked *after* the password rather than alongside
   * the other guards. Checking it first is what made a suspended user read
   * "invalid email or password" and go hunting for a typo they had not made.
   *
   * @throws {UnauthorizedException} with INVALID_CREDENTIALS until the password
   * verifies, and only then with the actual reason.
   */
  async validateCredentials(email: string, password: string): Promise<AuthenticatedUser> {
    // Normalized here and not by the DTO: guards run before pipes, so the local
    // strategy reads the raw body and LoginDto never touches it.
    const user = await this.users.findByEmail(email.trim().toLowerCase());

    if (!user || !user.passwordHash || this.isLocked(user)) {
      await this.passwords.verifyDecoy(password);
      // An unknown email has no organization to file an audit entry under, so
      // only attempts against a real account are recorded.
      if (user) {
        await this.recordSignInFailure(user, this.isLocked(user) ? 'locked' : 'no-password');
      }
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!(await this.passwords.verify(user.passwordHash, password))) {
      await this.registerFailedAttempt(user);
      await this.recordSignInFailure(user, 'bad-password');
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (user.status !== UserStatus.ACTIVE) {
      await this.recordSignInFailure(user, 'not-signable');
      throw new UnauthorizedException(NOT_SIGNABLE[user.status]);
    }

    return this.completeSignIn(user, 'password');
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

      return this.completeSignIn(linked, 'google');
    }

    const existing = await this.users.findByEmail(profile.email);

    if (!existing) {
      // Google used to mint an account here for any address that showed up,
      // which was self-registration wearing a different hat. Membership comes
      // from an invitation now, and Google only attaches to what one created.
      throw new UnauthorizedException(
        'No account uses that address. Ask an administrator to invite you',
      );
    }

    if (existing.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('This account is suspended');
    }

    await this.users.linkIdentity(existing.id, AuthProvider.GOOGLE, profile.providerAccountId);
    const confirmed = await this.users.confirmGoogleLink(existing.id, profile.avatarUrl);

    return this.completeSignIn(confirmed, 'google');
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

  private async completeSignIn(
    user: UserCredentials,
    method: 'password' | 'google',
  ): Promise<AuthenticatedUser> {
    await this.users.markLoginSucceeded(user.id);

    await this.audit.record({
      action: AuditAction.UserSignedIn,
      entity: AuditEntity.User,
      entityId: user.id,
      organizationId: user.organizationId,
      userId: user.id,
      metadata: { method },
    });

    return this.toAuthenticatedUser(user);
  }

  private recordSignInFailure(user: UserCredentials, cause: string): Promise<void> {
    return this.audit.record({
      action: AuditAction.UserSignInFailed,
      entity: AuditEntity.User,
      entityId: user.id,
      organizationId: user.organizationId,
      userId: user.id,
      metadata: { cause },
    });
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
