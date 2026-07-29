import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';

/** Not tenant-scoped: a refresh token is presented before any context exists. */
@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
  }

  async create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<string> {
    const created = await this.prisma.refreshToken.create({ data, select: { id: true } });
    return created.id;
  }

  /** Revocation and replacement in one write, so a crash cannot leave both live. */
  async revoke(id: string, replacedById?: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedById: replacedById ?? null },
    });
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
}
