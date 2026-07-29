import { PrismaService } from '../../infra/prisma/prisma.service';
import type { PrismaTransaction } from '../../infra/prisma/transaction';
import { TenantContextService } from '../tenant/tenant-context.service';

/**
 * Base for every repository touching business data.
 *
 * Tenant isolation cannot rely on each query remembering to filter: one omission
 * leaks another customer's data, so the filter is composed here instead.
 */
export abstract class BaseRepository {
  protected constructor(
    protected readonly prisma: PrismaService,
    protected readonly tenant: TenantContextService,
  ) {}

  protected get organizationId(): string {
    return this.tenant.organizationId;
  }

  /** Scope is spread last so a caller-supplied organizationId cannot override it. */
  protected scopedWhere<T extends object>(where?: T): T & { organizationId: string } {
    return { ...(where ?? ({} as T)), organizationId: this.organizationId };
  }

  protected scopedData<T extends object>(data: T): T & { organizationId: string } {
    return { ...data, organizationId: this.organizationId };
  }

  /**
   * Runs several repository writes as one atomic unit.
   *
   * The service gets an opaque handle to pass back into repository methods; it
   * never issues a query with it. This is what lets a stock change and the
   * movement that caused it commit or roll back together.
   */
  runInTransaction<T>(
    work: (tx: PrismaTransaction) => Promise<T>,
    options?: { timeout?: number; maxWait?: number },
  ): Promise<T> {
    return this.prisma.$transaction(work, options);
  }
}
