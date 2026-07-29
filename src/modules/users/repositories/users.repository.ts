import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { UserRole, UserStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const USER = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export type UserRecord = Awaited<ReturnType<UsersRepository['findById']>>;

@Injectable()
export class UsersRepository extends BaseRepository {
  constructor(prisma: PrismaService, tenant: TenantContextService) {
    super(prisma, tenant);
  }

  /** Fetches one extra row: that is how the caller knows another page exists. */
  findPage(limit: number, cursor?: string) {
    return this.prisma.user.findMany({
      where: this.scopedWhere(),
      select: USER,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  findById(id: string) {
    return this.prisma.user.findFirst({ where: this.scopedWhere({ id }), select: USER });
  }

  existsWithEmail(email: string): Promise<boolean> {
    return this.prisma.user
      .findFirst({ where: this.scopedWhere({ email }), select: { id: true } })
      .then((found) => found !== null);
  }

  create(data: {
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
    passwordHash: string | null;
  }) {
    return this.prisma.user.create({ data: this.scopedData(data), select: USER });
  }

  /**
   * updateMany rather than update: it takes a `where` the organization filter can
   * compose into, so a foreign id updates nothing instead of updating someone
   * else's user.
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      avatarUrl: string | null;
      role: UserRole;
      status: UserStatus;
      passwordHash: string;
    }>,
  ): Promise<boolean> {
    const result = await this.prisma.user.updateMany({ where: this.scopedWhere({ id }), data });
    return result.count > 0;
  }

  countAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: this.scopedWhere({ role: UserRole.ORG_ADMIN, status: UserStatus.ACTIVE }),
    });
  }
}
