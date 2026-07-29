import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

/**
 * Stock needs a "where", and the seed leaves exactly one row.
 *
 * Multi-warehouse is modelled but not built: callers that omit a location get
 * the default resolved here rather than each of them knowing there is only one.
 */
@Injectable()
export class LocationsRepository extends BaseRepository {
  constructor(prisma: PrismaService, tenant: TenantContextService) {
    super(prisma, tenant);
  }

  findDefaultId(): Promise<string | null> {
    return this.prisma.location
      .findFirst({
        where: this.scopedWhere({ isDefault: true }),
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
      .then((found) => found?.id ?? null);
  }

  exists(id: string): Promise<boolean> {
    return this.prisma.location
      .findFirst({ where: this.scopedWhere({ id }), select: { id: true } })
      .then((found) => found !== null);
  }
}
