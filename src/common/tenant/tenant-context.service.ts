import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/enums';

export interface TenantStore {
  organizationId: string;
  userId: string;
  role: UserRole;
}

/**
 * Contexto de la petición en curso: a qué organización pertenece y quién la hace.
 *
 * Se implementa con AsyncLocalStorage en lugar de un provider request-scoped a
 * propósito. Un provider request-scoped contagia el scope a todo lo que dependa
 * de él, y acabaría reconstruyendo media aplicación en cada petición.
 *
 * Lo puebla el guard de autenticación (Fase 2). Hasta entonces solo las rutas
 * públicas funcionan, y cualquier repositorio que se use sin contexto falla
 * ruidosamente en vez de devolver datos de otro tenant.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  /** Ejecuta el resto de la petición dentro del contexto dado. */
  run<T>(store: TenantStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  /** Contexto actual, o undefined en rutas públicas. */
  peek(): TenantStore | undefined {
    return this.storage.getStore();
  }

  private require(): TenantStore {
    const store = this.storage.getStore();

    if (!store) {
      throw new Error(
        'No hay contexto de tenant en esta petición. Toda ruta que acceda a datos de ' +
          'negocio debe pasar por el guard de autenticación, que es quien lo puebla.',
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
