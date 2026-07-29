import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AppConfig } from '../../config/configuration';
import { durationToSeconds } from '../../common/utils/duration';
import type { UserRole } from '../../generated/prisma/enums';
import type { JwtPayload } from './jwt-payload';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';

export interface RequestOrigin {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface AccessToken {
  token: string;
  expiresInSeconds: number;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenRepository,
    config: ConfigService<AppConfig, true>,
  ) {
    const { accessTtl, refreshTtl } = config.get('jwt', { infer: true });
    this.accessTtlSeconds = durationToSeconds(accessTtl);
    this.refreshTtlSeconds = durationToSeconds(refreshTtl);
  }

  async issueAccessToken(user: {
    id: string;
    organizationId: string;
    email: string;
    role: UserRole;
  }): Promise<AccessToken> {
    const payload: JwtPayload = {
      sub: user.id,
      org: user.organizationId,
      role: user.role,
      email: user.email,
    };

    return {
      token: await this.jwt.signAsync(payload),
      expiresInSeconds: this.accessTtlSeconds,
    };
  }

  async issueRefreshToken(userId: string, origin: RequestOrigin): Promise<string> {
    const { raw } = await this.persistRefreshToken(userId, origin);
    return raw;
  }

  /**
   * Swaps a refresh token for a fresh one and returns whose it was.
   *
   * A token already revoked means someone is replaying one that was handed in
   * earlier — either a stolen copy or the legitimate holder racing itself. There
   * is no way to tell which from here, so every session for that user is dropped
   * and both parties have to sign in again.
   *
   * @throws {UnauthorizedException} when the token is unknown, expired or reused.
   */
  async rotate(rawToken: string, origin: RequestOrigin): Promise<{ userId: string; raw: string }> {
    const stored = await this.refreshTokens.findByHash(this.fingerprint(rawToken));

    if (!stored) {
      throw new UnauthorizedException('Invalid session');
    }

    if (stored.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}`);
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Invalid session');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid session');
    }

    const { id, raw } = await this.persistRefreshToken(stored.userId, origin);
    await this.refreshTokens.revoke(stored.id, id);

    return { userId: stored.userId, raw };
  }

  async revoke(rawToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByHash(this.fingerprint(rawToken));

    if (stored && !stored.revokedAt) {
      await this.refreshTokens.revoke(stored.id);
    }
  }

  revokeAllForUser(userId: string): Promise<number> {
    return this.refreshTokens.revokeAllForUser(userId);
  }

  get refreshMaxAgeMs(): number {
    return this.refreshTtlSeconds * 1000;
  }

  private async persistRefreshToken(
    userId: string,
    origin: RequestOrigin,
  ): Promise<{ id: string; raw: string }> {
    const raw = randomBytes(48).toString('base64url');

    const id = await this.refreshTokens.create({
      userId,
      tokenHash: this.fingerprint(raw),
      expiresAt: new Date(Date.now() + this.refreshMaxAgeMs),
      userAgent: origin.userAgent ?? null,
      ipAddress: origin.ipAddress ?? null,
    });

    return { id, raw };
  }

  /**
   * SHA-256 rather than argon2: the token is 384 random bits, so there is no
   * low-entropy secret to slow an attacker down against. Argon2's work factor
   * would only tax every refresh request.
   */
  private fingerprint(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
