import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  ExecutionContext,
  Injectable,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard, type IAuthModuleOptions } from '@nestjs/passport';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../../config/configuration';
import { AuthCookieService } from '../auth-cookie.service';

const compare = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * Starts the Google redirect, carrying a `state` value mirrored in a cookie.
 *
 * Without it, anyone can feed a victim a callback URL holding their own
 * authorization code and end up with the victim's session pointing at the
 * attacker's Google account.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(
    protected readonly cookies: AuthCookieService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    this.assertConfigured();
    return super.canActivate(context);
  }

  override getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions {
    const response = context.switchToHttp().getResponse<Response>();
    const state = randomBytes(32).toString('base64url');

    this.cookies.setOAuthState(response, state);

    return { state };
  }

  protected assertConfigured(): void {
    if (!this.config.get('google', { infer: true })) {
      throw new NotImplementedException('Google sign-in is not configured on this server');
    }
  }
}

/** Verifies the round trip before letting Passport exchange the code. */
@Injectable()
export class GoogleCallbackGuard extends GoogleAuthGuard {
  override canActivate(context: ExecutionContext) {
    this.assertConfigured();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const returned = request.query.state;
    const expected = this.cookies.readOAuthState(request);

    this.cookies.clearOAuthState(response);

    if (typeof returned !== 'string' || !expected || !compare(returned, expected)) {
      throw new UnauthorizedException('Invalid sign-in request');
    }

    return super.canActivate(context);
  }

  /** The state was already checked and consumed; re-issuing one would break it. */
  override getAuthenticateOptions(): IAuthModuleOptions {
    return {};
  }
}
