import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { PrismaTransaction } from '../../../infra/prisma/transaction';
import type { AuditMetadata } from '../audit.metadata';

const AUDIT_LOG = {
  id: true,
  action: true,
  entity: true,
  entityId: true,
  metadata: true,
  ipAddress: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

export interface AuditLogRow {
  organizationId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: AuditMetadata;
  ipAddress: string | null;
}

export interface AuditLogFilters {
  entity?: string;
  entityId?: string;
  action?: string;
  userId?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AuditRepository extends BaseRepository {
  constructor(prisma: PrismaService, tenant: TenantContextService) {
    super(prisma, tenant);
  }

  /**
   * Takes organizationId on the row instead of scoping it, because the events
   * worth auditing most — a sign-in, a failed sign-in — happen before any tenant
   * context exists. AuditService is what resolves it.
   */
  async insert(row: AuditLogRow, tx?: PrismaTransaction): Promise<void> {
    const { metadata, ...rest } = row;

    await (tx ?? this.prisma).auditLog.create({
      // The round trip drops the undefined values AuditMetadata allows, which
      // Prisma's JSON input rejects. It belongs here because the repository is
      // the Prisma boundary, not in the service that built the entry.
      data: { ...rest, metadata: JSON.parse(JSON.stringify(metadata)) as object },
    });
  }

  findPage(limit: number, cursor: string | undefined, filters: AuditLogFilters) {
    return this.prisma.auditLog.findMany({
      where: this.scopedWhere({
        ...(filters.entity ? { entity: filters.entity } : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      }),
      select: AUDIT_LOG,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }
}
