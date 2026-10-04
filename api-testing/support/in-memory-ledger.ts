import { randomUUID } from 'node:crypto';
import { MovementStatus, MovementType, MovementUnit } from '../../src/generated/prisma/enums';
import type { MovementLineRow } from '../../src/modules/inventory/repositories/movements.repository';

/**
 * In-memory stand-in for the database, so the API suite exercises the real
 * controllers, pipes, guards, filter and services without PostgreSQL.
 *
 * Only the Prisma repositories are replaced; everything above them is the
 * production code. Fixed v4 UUIDs keep the seed deterministic (FIRST: Repeatable).
 */
export const ORGANIZATION_ID = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a';

export const USERS = {
  OPERATOR: { id: '1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b', name: 'Olga Operator' },
  MANAGER: { id: '2c2c2c2c-2c2c-4c2c-8c2c-2c2c2c2c2c2c', name: 'Mario Manager' },
  ORG_ADMIN: { id: '3d3d3d3d-3d3d-4d3d-8d3d-3d3d3d3d3d3d', name: 'Ana Admin' },
  PLATFORM_ADMIN: { id: '4e4e4e4e-4e4e-4e4e-8e4e-4e4e4e4e4e4e', name: 'Pablo Platform' },
} as const;

export const LOCATIONS = {
  MAIN: '5f5f5f5f-5f5f-4f5f-8f5f-5f5f5f5f5f5f',
  BAR: '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6a6a',
} as const;

export const PRODUCTS = {
  /** Sold by the case of 12. */
  RUM: '7b7b7b7b-7b7b-4b7b-8b7b-7b7b7b7b7b7b',
  /** Sold by the case of 6. */
  WHISKY: '8c8c8c8c-8c8c-4c8c-8c8c-8c8c8c8c8c8c',
  /** Deactivated: a movement may not reference it. */
  RETIRED_GIN: '9d9d9d9d-9d9d-4d9d-8d9d-9d9d9d9d9d9d',
} as const;

/** A well-formed UUID that names nothing in the seed. */
export const UNKNOWN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Stock on hand in base units (bottles) right after `reset()`. */
export const INITIAL_STOCK = {
  [LOCATIONS.MAIN]: { [PRODUCTS.RUM]: 100, [PRODUCTS.WHISKY]: 10 },
  [LOCATIONS.BAR]: { [PRODUCTS.RUM]: 5 },
} as const;

interface StoredItem extends MovementLineRow {
  id: string;
}

interface StoredMovement {
  id: string;
  code: string;
  type: MovementType;
  status: MovementStatus;
  locationId: string;
  destinationLocationId: string | null;
  occurredAt: Date;
  reason: string | null;
  note: string | null;
  createdByUserId: string;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  items: StoredItem[];
}

const CATALOG = [
  { id: PRODUCTS.RUM, name: 'Ron Viejo de Caldas', caseSize: 12, isActive: true, brandName: 'ILC' },
  { id: PRODUCTS.WHISKY, name: 'Old Parr 12', caseSize: 6, isActive: true, brandName: 'Diageo' },
  { id: PRODUCTS.RETIRED_GIN, name: 'Gin Retirado', caseSize: 6, isActive: false, brandName: null },
];

const stockKey = (locationId: string, productId: string): string => `${locationId}:${productId}`;

export class InMemoryLedger {
  movements = new Map<string, StoredMovement>();
  stock = new Map<string, number>();
  counters = new Map<number, number>();
  auditLog: { action: string; entityId?: string | null }[] = [];

  constructor() {
    this.reset();
  }

  /** Restores the seed before each test (FIRST: Independent). */
  reset(): void {
    this.movements.clear();
    this.stock.clear();
    this.counters.clear();
    this.auditLog = [];

    for (const [locationId, byProduct] of Object.entries(INITIAL_STOCK)) {
      for (const [productId, quantity] of Object.entries(byProduct)) {
        this.stock.set(stockKey(locationId, productId), quantity);
      }
    }
  }

  stockOf(locationId: string, productId: string): number {
    return this.stock.get(stockKey(locationId, productId)) ?? 0;
  }

  /** The MovementsRepository surface MovementsService and DocumentsService use. */
  movementsRepository() {
    const runInTransaction = <T>(work: (tx: unknown) => Promise<T>): Promise<T> => work({});

    return {
      runInTransaction,

      nextSequence: async (year: number): Promise<number> => {
        const next = (this.counters.get(year) ?? 0) + 1;
        this.counters.set(year, next);
        return next;
      },

      create: async (
        data: Omit<
          StoredMovement,
          'id' | 'status' | 'confirmedAt' | 'cancelledAt' | 'createdAt' | 'items'
        > & { items: MovementLineRow[] },
      ): Promise<string> => {
        const id = randomUUID();
        this.movements.set(id, {
          ...data,
          id,
          status: MovementStatus.DRAFT,
          confirmedAt: null,
          cancelledAt: null,
          createdAt: new Date(),
          items: data.items.map((item) => ({ ...item, id: randomUUID() })),
        });
        return id;
      },

      findById: async (id: string) => {
        const movement = this.movements.get(id);

        if (!movement) {
          return null;
        }

        const { createdByUserId, items, ...rest } = movement;
        const author = Object.values(USERS).find((user) => user.id === createdByUserId)!;

        return {
          ...rest,
          createdBy: { id: author.id, name: author.name },
          // Same order as the Prisma select: by product name, outgoing half first.
          items: [...items].sort(
            (a, b) =>
              a.productNameSnapshot.localeCompare(b.productNameSnapshot) ||
              a.quantityBase - b.quantityBase,
          ),
        };
      },

      transition: async (
        id: string,
        from: MovementStatus,
        to: MovementStatus,
        stamp: { confirmedAt?: Date; cancelledAt?: Date },
      ): Promise<boolean> => {
        const movement = this.movements.get(id);

        if (!movement || movement.status !== from) {
          return false;
        }

        Object.assign(movement, { status: to, ...stamp });
        return true;
      },
    };
  }

  stockRepository() {
    return {
      findLevels: async (productIds: string[], locationId: string) =>
        productIds
          .filter((productId) => this.stock.has(stockKey(locationId, productId)))
          .map((productId) => ({ productId, quantityBase: this.stockOf(locationId, productId) })),

      ensureRows: async (productIds: string[], locationId: string): Promise<void> => {
        for (const productId of productIds) {
          const key = stockKey(locationId, productId);
          if (!this.stock.has(key)) {
            this.stock.set(key, 0);
          }
        }
      },

      /** Mirrors the guarded UPDATE: a row that would go negative is skipped. */
      applyDelta: async (
        productIds: string[],
        locationId: string,
        delta: number,
      ): Promise<number> => {
        let moved = 0;
        for (const productId of productIds) {
          const key = stockKey(locationId, productId);
          const current = this.stock.get(key);
          if (current !== undefined && current >= -delta) {
            this.stock.set(key, current + delta);
            moved += 1;
          }
        }
        return moved;
      },
    };
  }

  locationsRepository() {
    const known = new Set<string>(Object.values(LOCATIONS));

    return {
      exists: async (id: string): Promise<boolean> => known.has(id),
      findDefaultId: async (): Promise<string | null> => LOCATIONS.MAIN,
    };
  }

  productsRepository() {
    return {
      findMovementTargets: async (ids: string[]) =>
        CATALOG.filter((product) => ids.includes(product.id)),
    };
  }

  organizationsRepository() {
    return {
      findCurrent: async () => ({
        id: ORGANIZATION_ID,
        name: 'Licorera La Esquina',
        slug: 'licorera-la-esquina',
        legalName: 'Licorera La Esquina S.A.S.',
        logoUrl: null,
        timezone: 'America/Bogota',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      }),
    };
  }

  auditRepository() {
    return {
      insert: async (row: { action: string; entityId?: string | null }): Promise<void> => {
        this.auditLog.push({ action: row.action, entityId: row.entityId });
      },
    };
  }
}

export { MovementStatus, MovementType, MovementUnit };
