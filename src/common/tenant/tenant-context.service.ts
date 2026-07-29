import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/enums';

export interface TenantStore {
  organizationId: string;
  userId: string;
  role: UserRole;
}

/** Mutable so the middleware can open the context before the guard can fill it. */
interface TenantStoreHolder {
  /** Known from the first middleware, so it is available on public routes too. */
  ipAddress?: string;
  current?: TenantStore;
}

/**
 * Organization and user behind the current request.
 *
 * Backed by AsyncLocalStorage rather than a request-scoped provider: a
 * request-scoped provider propagates its scope to every dependent, which would
 * rebuild most of the container on each request.
 *
 * Filling it takes two steps because `AsyncLocalStorage.run` has to wrap
 * everything that follows, and a guard cannot do that — it returns a boolean and
 * the framework continues on its own. So the middleware opens an empty holder
 * around the request and the auth guard writes into it once it knows who is
 * calling.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStoreHolder>();

  /** Opens the context for one request. Called by TenantContextMiddleware. */
  run<T>(ipAddress: string | undefined, callback: () => T): T {
    return this.storage.run({ ipAddress }, callback);
  }

  /** @throws {Error} when no middleware opened a context for this request. */
  set(store: TenantStore): void {
    const holder = this.storage.getStore();

    if (!holder) {
      throw new Error('TenantContextMiddleware did not run for this request.');
    }

    holder.current = store;
  }

  /** Returns undefined on public routes. */
  peek(): TenantStore | undefined {
    return this.storage.getStore()?.current;
  }

  /** @throws {Error} when called outside an authenticated request. */
  private require(): TenantStore {
    const store = this.peek();

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

  /** Available on public routes as well, which is where sign-ins are audited. */
  get ipAddress(): string | null {
    return this.storage.getStore()?.ipAddress ?? null;
  }
}
