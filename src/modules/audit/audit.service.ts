import { Injectable, Logger } from '@nestjs/common';
import { toPage } from '../../common/dto/paginate';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import type { PrismaTransaction } from '../../infra/prisma/transaction';
import type { AuditAction, AuditEntity } from './audit.actions';
import type { AuditMetadata } from './audit.metadata';
import type { AuditLogPageDto, ListAuditLogsDto } from './dto/audit-log.dto';
import { AuditRepository, type AuditLogRow } from './repositories/audit.repository';

export interface AuditEvent {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  metadata?: AuditMetadata;
  /** Only needed outside an authenticated request, as on sign-in. */
  organizationId?: string;
  userId?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly logs: AuditRepository,
    private readonly tenant: TenantContextService,
  ) {}

  /**
   * Records an event without letting it break the action it describes.
   *
   * Refusing a sign-in because the audit write failed trades a working product
   * for a complete log. Use {@link recordIn} where the record must be as durable
   * as the change itself.
   */
  async record(event: AuditEvent): Promise<void> {
    try {
      await this.logs.insert(this.toRow(event));
    } catch (error) {
      this.logger.error(`Could not record ${event.action}`, error);
    }
  }

  /**
   * Records an event inside a caller's transaction, so it commits or rolls back
   * with the change. A failure here does fail the operation, which is the point:
   * a confirmed movement nobody can attribute is worse than a refused one.
   */
  recordIn(tx: PrismaTransaction, event: AuditEvent): Promise<void> {
    return this.logs.insert(this.toRow(event), tx);
  }

  async list(query: ListAuditLogsDto): Promise<AuditLogPageDto> {
    const rows = await this.logs.findPage(query.limit, query.cursor, {
      entity: query.entity,
      entityId: query.entityId,
      action: query.action,
      userId: query.userId,
      from: query.from,
      to: query.to,
    });

    return toPage(rows, query.limit);
  }

  /** @throws {Error} when called with no organization in context and none given. */
  private toRow(event: AuditEvent): AuditLogRow {
    return {
      organizationId: event.organizationId ?? this.tenant.organizationId,
      userId: event.userId !== undefined ? event.userId : (this.tenant.peek()?.userId ?? null),
      action: event.action,
      entity: event.entity,
      entityId: event.entityId ?? null,
      metadata: event.metadata ?? {},
      ipAddress: this.tenant.ipAddress,
    };
  }
}
