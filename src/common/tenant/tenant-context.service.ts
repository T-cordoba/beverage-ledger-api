import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/enums';

export interface TenantStore {
  organizationId: string;
  userId: string;
  role: UserRole;
}

/**
 * Organization and user behind the current request, populated by the auth guard.
 *
 * Backed by AsyncLocalStorage rather than a request-scoped provider: a
 * request-scoped provider propagates its scope to every dependent, which would
 * rebuild most of the container on each request.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  run<T>(store: TenantStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  /** Returns undefined on public routes. */
  peek(): TenantStore | undefined {
    return this.storage.getStore();
  }

  /** @throws {Error} when called outside an authenticated request. */
  private require(): TenantStore {
    const store = this.storage.getStore();

    if (!store) {
      throw new Error(
        'No tenant context in this request. Routes touching business data must go ' +
          'through the auth guard, which populates it.',
      );
    }

    return store;
  }

  get organizationId(): string {
    return this.require().organizationId;
  }

  get userId(): string {
    return this.require().userId;
  }

  get role(): UserRole {
    return this.require().role;
  }
}
