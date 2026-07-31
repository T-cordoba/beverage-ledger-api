import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AppConfig } from '../../config/configuration';
import { AuthCookieService } from './auth-cookie.service';
import { AUTH_THROTTLE } from './auth.throttle';
import { AuthService, type IssuedSession } from './auth.service';
import { LoginDto } from './dto/credentials.dto';
import { CurrentSessionDto, SessionDto } from './dto/session.dto';
import { GoogleAuthGuard, GoogleCallbackGuard } from './guards/google-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { TokenService, type RequestOrigin } from './token.service';

@ApiTags('auth')
@ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
@Controller('auth')
export class AuthController {
  private readonly frontendUrl: string;

  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly cookies: AuthCookieService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.frontendUrl = config.get('frontendUrl', { infer: true });
  }

  @Post('login')
  @Public()
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: AUTH_THROTTLE })
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: SessionDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionDto> {
    return this.deliver(await this.auth.issueSession(user, this.originOf(request)), response);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: AUTH_THROTTLE })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Exchange the refresh cookie for a new access token' })
  @ApiOkResponse({ type: SessionDto })
  @ApiUnauthorizedResponse({ description: 'Missing, expired or replayed refresh token' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionDto> {
    const token = this.cookies.readRefreshToken(request);

    if (!token) {
      throw new UnauthorizedException('Invalid session');
    }

    try {
      return this.deliver(await this.auth.refreshSession(token, this.originOf(request)), response);
    } catch (error) {
      // A refused refresh always leaves the browser without the stale cookie,
      // otherwise the client retries with it on every request.
      this.cookies.clearRefreshToken(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = this.cookies.readRefreshToken(request);

    if (token) {
      await this.auth.signOut(token);
    }

    this.cookies.clearRefreshToken(response);
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user, organization and effective permissions' })
  @ApiOkResponse({ type: CurrentSessionDto })
  me(@CurrentUser() user: AuthenticatedUser): Promise<CurrentSessionDto> {
    return this.auth.currentSession(user.id);
  }

  @Get('google')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Redirect to Google sign-in' })
  startGoogle(): void {
    // The guard redirects; nothing reaches this body.
  }

  @Get('google/callback')
  @Public()
  @UseGuards(GoogleCallbackGuard)
  @ApiExcludeEndpoint()
  async googleCallback(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const issued = await this.auth.issueSession(user, this.originOf(request));

    this.cookies.setRefreshToken(response, issued.refreshToken, this.tokens.refreshMaxAgeMs);

    // Only the cookie is handed over: an access token in the redirect URL would
    // land in browser history, server logs and the Referer header. The frontend
    // trades the cookie for a token through POST /auth/refresh.
    response.redirect(`${this.frontendUrl}/auth/callback`);
  }

  private deliver(issued: IssuedSession, response: Response): SessionDto {
    this.cookies.setRefreshToken(response, issued.refreshToken, this.tokens.refreshMaxAgeMs);
    return issued.session;
  }

  private originOf(request: Request): RequestOrigin {
    return {
      userAgent: request.get('user-agent') ?? null,
      ipAddress: request.ip ?? null,
    };
  }
}
