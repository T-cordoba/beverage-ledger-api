import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../../config/configuration';

const OAUTH_STATE_COOKIE = 'bl_oauth_state';
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

@Injectable()
export class AuthCookieService {
  private readonly refreshCookieName: string;
  private readonly isProduction: boolean;
  private readonly authPath: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.refreshCookieName = config.get('authCookie', { infer: true }).name;
    this.isProduction = config.get('isProduction', { infer: true });
    this.authPath = `/${config.get('apiPrefix', { infer: true })}/auth`;
  }

  setRefreshToken(response: Response, token: string, maxAgeMs: number): void {
    response.cookie(this.refreshCookieName, token, this.refreshOptions(maxAgeMs));
  }

  clearRefreshToken(response: Response): void {
    response.clearCookie(this.refreshCookieName, this.refreshOptions());
  }

  readRefreshToken(request: Request): string | undefined {
    return this.read(request, this.refreshCookieName);
  }

  setOAuthState(response: Response, state: string): void {
    response.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.isProduction,
      // Lax, not None: Google sends the browser back with a top-level GET, which
      // Lax allows, and it keeps the cookie out of third-party subrequests.
      sameSite: 'lax',
      path: this.authPath,
      maxAge: OAUTH_STATE_MAX_AGE_MS,
    });
  }

  clearOAuthState(response: Response): void {
    response.clearCookie(OAUTH_STATE_COOKIE, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: this.authPath,
    });
  }

  readOAuthState(request: Request): string | undefined {
    return this.read(request, OAUTH_STATE_COOKIE);
  }

  /**
   * Scoped to the auth routes so the refresh token is not attached to every
   * request; and cross-site in production because the frontend and the API sit on
   * different registrable domains. Safari blocks that cookie under ITP — the fix
   * is a shared parent domain, not a cookie flag.
   */
  private refreshOptions(maxAgeMs?: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' : 'lax',
      path: this.authPath,
      ...(maxAgeMs === undefined ? {} : { maxAge: maxAgeMs }),
    };
  }

  private read(request: Request, name: string): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[name];
  }
}
