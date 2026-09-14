import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { permissionsFor } from '../../common/permissions/permissions.config';
import { AuthProvider, UserStatus } from '../../generated/prisma/enums';
import { CredentialsService } from './credentials.service';
import type { CurrentSessionDto, SessionDto, SessionUserDto } from './dto/session.dto';
import { AuthRepository } from './repositories/auth.repository';
import { TokenService, type RequestOrigin } from './token.service';
import { toAuthenticatedUser } from './user.mapper';

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
  constructor(
    private readonly users: AuthRepository,
    private readonly tokens: TokenService,
    private readonly credentials: CredentialsService,
  ) {}

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

      return this.credentials.completeSignIn(linked, 'google');
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

    return this.credentials.completeSignIn(confirmed, 'google');
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

    const authenticated = toAuthenticatedUser(user);
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

    return toAuthenticatedUser(user);
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
