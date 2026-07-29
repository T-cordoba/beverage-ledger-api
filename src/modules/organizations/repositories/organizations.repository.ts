import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const ORGANIZATION = {
  id: true,
  name: true,
  slug: true,
  legalName: true,
  logoUrl: true,
  timezone: true,
  createdAt: true,
} as const;

/**
 * Does not extend BaseRepository: organizations is the table the scope is drawn
 * from, so there is no organizationId column on it to filter by. The id comes
 * straight from the tenant context instead.
 */
@Injectable()
export class OrganizationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  findCurrent() {
    return this.prisma.organization.findUnique({
      where: { id: this.tenant.organizationId },
      select: ORGANIZATION,
    });
  }

  update(data: Partial<{ name: string; legalName: string; logoUrl: string; timezone: string }>) {
    return this.prisma.organization.update({
      where: { id: this.tenant.organizationId },
      data,
      select: ORGANIZATION,
    });
  }
}
