import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, type VerifyCallback } from 'passport-google-oauth20';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { AuthService } from '../auth.service';

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

/**
 * Registered only when credentials are configured — see AuthModule.
 *
 * Scopes stay at `email` and `profile`: anything beyond that puts the OAuth
 * consent screen through Google's verification review.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly auth: AuthService,
    credentials: GoogleCredentials,
  ) {
    super({
      clientID: credentials.clientId,
      clientSecret: credentials.clientSecret,
      callbackURL: credentials.callbackUrl,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value?.trim().toLowerCase();

    if (!email) {
      // Only reachable if the `email` scope was dropped from the consent screen.
      done(new UnauthorizedException('Google did not return an email address'));
      return;
    }

    try {
      const user: AuthenticatedUser = await this.auth.signInWithGoogle({
        providerAccountId: profile.id,
        email,
        name: profile.displayName || email,
        avatarUrl: profile.photos?.[0]?.value ?? null,
      });

      done(null, user);
    } catch (error) {
      done(error);
    }
  }
}
