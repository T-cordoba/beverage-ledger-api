import { randomUUID } from 'node:crypto';
import { MovementStatus, MovementType, MovementUnit } from '../../../src/generated/prisma/enums';
import type {
  MovementFilters,
  MovementLineRow,
} from '../../../src/modules/inventory/repositories/movements.repository';
import { toDto } from '../../../src/modules/inventory/repositories/stock.mapper';
import { ConsumptionGrouping } from '../../../src/modules/reports/dto/report.dto';

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
  /** Never moved: no stock row anywhere. */
  AGUARDIENTE: 'adadadad-adad-4dad-8dad-adadadadadad',
} as const;

export const CATEGORIES = {
  RUM: 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1',
  WHISKY: 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2',
  GIN: 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
  AGUARDIENTE: 'c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4',
} as const;

export const BRANDS = {
  ILC: 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1',
  DIAGEO: 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
} as const;

/** Another tenant's rows, present only after `seedOtherTenant()`. */
export const OTHER_TENANT = {
  ORGANIZATION_ID: 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0',
  PRODUCT: 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1',
  LOCATION: 'f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2',
  CATEGORY: 'f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3',
} as const;

/** A well-formed UUID that names nothing in the seed. */
export const UNKNOWN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Stock on hand in base units (bottles) right after `reset()`. */
export const INITIAL_STOCK = {
  [LOCATIONS.MAIN]: { [PRODUCTS.RUM]: 100, [PRODUCTS.WHISKY]: 10 },
  [LOCATIONS.BAR]: { [PRODUCTS.RUM]: 5 },
} as const;

export interface StoredItem extends MovementLineRow {
  id: string;
}

export interface StoredMovement {
  id: string;
  organizationId: string;
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

export interface CatalogProduct {
  id: string;
  organizationId: string;
  name: string;
  caseSize: number;
  isActive: boolean;
  minimumStock: number | null;
  categoryId: string;
  categoryName: string;
  brandId: string | null;
  brandName: string | null;
}

const seedCatalog = (): CatalogProduct[] => [
  {
    id: PRODUCTS.RUM,
    organizationId: ORGANIZATION_ID,
    name: 'Ron Viejo de Caldas',
    caseSize: 12,
    isActive: true,
    minimumStock: 24,
    categoryId: CATEGORIES.RUM,
    categoryName: 'Ron',
    brandId: BRANDS.ILC,
    brandName: 'ILC',
  },
  {
    id: PRODUCTS.WHISKY,
    organizationId: ORGANIZATION_ID,
    name: 'Old Parr 12',
    caseSize: 6,
    isActive: true,
    minimumStock: 12,
    categoryId: CATEGORIES.WHISKY,
    categoryName: 'Whisky',
    brandId: BRANDS.DIAGEO,
    brandName: 'Diageo',
  },
  {
    id: PRODUCTS.RETIRED_GIN,
    organizationId: ORGANIZATION_ID,
    name: 'Gin Retirado',
    caseSize: 6,
    isActive: false,
    minimumStock: 6,
    categoryId: CATEGORIES.GIN,
    categoryName: 'Ginebra',
    brandId: null,
    brandName: null,
  },
  {
    id: PRODUCTS.AGUARDIENTE,
    organizationId: ORGANIZATION_ID,
    name: 'Aguardiente Antioqueño',
    caseSize: 24,
    isActive: true,
    minimumStock: 6,
    categoryId: CATEGORIES.AGUARDIENTE,
    categoryName: 'Aguardiente',
    brandId: BRANDS.ILC,
    brandName: 'ILC',
  },
];

const stockKey = (locationId: string, productId: string): string => `${locationId}:${productId}`;

const authorOf = (userId: string) => {
  const author = Object.values(USERS).find((user) => user.id === userId)!;
  return { id: author.id, name: author.name };
};

const inRange = (date: Date, from: Date, to: Date): boolean => date >= from && date <= to;

export class InMemoryLedger {
  movements = new Map<string, StoredMovement>();
  stock = new Map<string, number>();
  counters = new Map<number, number>();
  catalog: CatalogProduct[] = [];
  auditLog: { action: string; entityId?: string | null }[] = [];

  constructor() {
    this.reset();
  }

  /** Restores the seed before each test (FIRST: Independent). */
  reset(): void {
    this.movements.clear();
    this.stock.clear();
    this.counters.clear();
    this.catalog = seedCatalog();
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

  /** A product, a stock row and a confirmed outbound that belong to another organization. */
  seedOtherTenant(): void {
    this.catalog.push({
      id: OTHER_TENANT.PRODUCT,
      organizationId: OTHER_TENANT.ORGANIZATION_ID,
      name: 'Vodka Secreto',
      caseSize: 6,
      isActive: true,
      minimumStock: 1000,
      categoryId: OTHER_TENANT.CATEGORY,
      categoryName: 'Vodka',
      brandId: null,
      brandName: null,
    });
    this.stock.set(stockKey(OTHER_TENANT.LOCATION, OTHER_TENANT.PRODUCT), 3);
    this.insertMovement({
      organizationId: OTHER_TENANT.ORGANIZATION_ID,
      type: MovementType.OUTBOUND,
      locationId: OTHER_TENANT.LOCATION,
      items: [{ productId: OTHER_TENANT.PRODUCT, quantity: 40, unit: MovementUnit.BOTTLE }],
    });
  }

  /** Adds `count` active products named `${prefix} 0001…`, for volume tests. */
  seedBulkCatalog(count: number, prefix = 'Producto'): string[] {
    const ids: string[] = [];

    for (let index = 1; index <= count; index += 1) {
      const id = randomUUID();
      ids.push(id);
      this.catalog.push({
        id,
        organizationId: ORGANIZATION_ID,
        name: `${prefix} ${String(index).padStart(4, '0')}`,
        caseSize: 12,
        isActive: true,
        minimumStock: index % 2 === 0 ? 10 : null,
        categoryId: index % 3 === 0 ? CATEGORIES.WHISKY : CATEGORIES.RUM,
        categoryName: index % 3 === 0 ? 'Whisky' : 'Ron',
        brandId: BRANDS.ILC,
        brandName: 'ILC',
      });
      this.stock.set(stockKey(LOCATIONS.MAIN, id), index % 20);
    }

    return ids;
  }

  /**
   * Writes a movement straight into the ledger, confirmed by default, bypassing
   * the service. Stock is not touched: this seeds history, not a registration.
   */
  insertMovement(movement: {
    type: MovementType;
    items: { productId: string; quantity: number; unit: MovementUnit; locationId?: string }[];
    organizationId?: string;
    status?: MovementStatus;
    locationId?: string;
    occurredAt?: Date;
    createdByUserId?: string;
  }): string {
    const id = randomUUID();
    const locationId = movement.locationId ?? LOCATIONS.MAIN;
    const occurredAt = movement.occurredAt ?? new Date();
    const status = movement.status ?? MovementStatus.CONFIRMED;
    const sequence = this.movements.size + 1;

    this.movements.set(id, {
      id,
      organizationId: movement.organizationId ?? ORGANIZATION_ID,
      code: `MOV-${occurredAt.getFullYear()}-${String(900_000 + sequence).padStart(6, '0')}`,
      type: movement.type,
      status,
      locationId,
      destinationLocationId: null,
      occurredAt,
      reason: movement.type === MovementType.ADJUSTMENT ? 'Conteo físico' : null,
      note: null,
      createdByUserId: movement.createdByUserId ?? USERS.MANAGER.id,
      confirmedAt: status === MovementStatus.CONFIRMED ? occurredAt : null,
      cancelledAt: null,
      createdAt: occurredAt,
      items: movement.items.map((item) => {
        const product = this.catalog.find((candidate) => candidate.id === item.productId)!;
        const magnitude =
          item.unit === MovementUnit.CASE ? item.quantity * product.caseSize : item.quantity;

        return {
          id: randomUUID(),
          productId: item.productId,
          locationId: item.locationId ?? locationId,
          quantity: item.quantity,
          unit: item.unit,
          quantityBase: movement.type === MovementType.OUTBOUND ? -magnitude : magnitude,
          productNameSnapshot: product.name,
          brandNameSnapshot: product.brandName,
        };
      }),
    });

    return id;
  }

  private ownProducts(): CatalogProduct[] {
    return this.catalog.filter((product) => product.organizationId === ORGANIZATION_ID);
  }

  private ownMovements(): StoredMovement[] {
    return [...this.movements.values()].filter(
      (movement) => movement.organizationId === ORGANIZATION_ID,
    );
  }

  private confirmedInRange(from: Date, to: Date): StoredMovement[] {
    return this.ownMovements().filter(
      (movement) =>
        movement.status === MovementStatus.CONFIRMED && inRange(movement.occurredAt, from, to),
    );
  }

  private stockRowOf(product: CatalogProduct, locationId: string) {
    const key = stockKey(locationId, product.id);

    return toDto({
      id: product.id,
      name: product.name,
      caseSize: product.caseSize,
      minimumStock: product.minimumStock,
      category: { name: product.categoryName },
      brand: product.brandName ? { name: product.brandName } : null,
      stockLevels: this.stock.has(key) ? [{ quantityBase: this.stock.get(key)! }] : [],
    });
  }

  /** The MovementsRepository surface MovementsService, StockService and DocumentsService use. */
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
          'id' | 'organizationId' | 'status' | 'confirmedAt' | 'cancelledAt' | 'createdAt' | 'items'
        > & { items: MovementLineRow[] },
      ): Promise<string> => {
        const id = randomUUID();
        this.movements.set(id, {
          ...data,
          id,
          organizationId: ORGANIZATION_ID,
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

        if (!movement || movement.organizationId !== ORGANIZATION_ID) {
          return null;
        }

        const { createdByUserId, items, organizationId: _organizationId, ...rest } = movement;

        return {
          ...rest,
          createdBy: authorOf(createdByUserId),
          // Same order as the Prisma select: by product name, outgoing half first.
          items: [...items].sort(
            (a, b) =>
              a.productNameSnapshot.localeCompare(b.productNameSnapshot) ||
              a.quantityBase - b.quantityBase,
          ),
        };
      },

      findPage: async (skip: number, take: number, filters: MovementFilters) => {
        const matching = this.ownMovements()
          .filter(
            (movement) =>
              (!filters.search ||
                movement.code.toLowerCase().includes(filters.search.toLowerCase())) &&
              (!filters.type || movement.type === filters.type) &&
              (!filters.status || movement.status === filters.status) &&
              (!filters.createdByUserId || movement.createdByUserId === filters.createdByUserId) &&
              (!(filters.productId || filters.locationId) ||
                movement.items.some(
                  (item) =>
                    (!filters.productId || item.productId === filters.productId) &&
                    (!filters.locationId || item.locationId === filters.locationId),
                )) &&
              (!filters.from || movement.occurredAt >= filters.from) &&
              (!filters.to || movement.occurredAt <= filters.to),
          )
          .sort(
            (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id),
          );

        return {
          rows: matching.slice(skip, skip + take).map((movement) => ({
            id: movement.id,
            code: movement.code,
            type: movement.type,
            status: movement.status,
            occurredAt: movement.occurredAt,
            note: movement.note,
            createdBy: authorOf(movement.createdByUserId),
            itemCount: movement.items.length,
          })),
          total: matching.length,
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

      updateDraft: async (
        id: string,
        data: { occurredAt?: Date; reason?: string; note?: string },
        items: MovementLineRow[] | undefined,
      ): Promise<void> => {
        const movement = this.movements.get(id);

        if (!movement || movement.status !== MovementStatus.DRAFT) {
          return;
        }

        Object.assign(movement, data);

        if (items) {
          movement.items = items.map((item) => ({ ...item, id: randomUUID() }));
        }
      },

      kardex: async (productId: string, locationId: string, skip: number, take: number) => {
        const lines = this.ownMovements()
          .filter((movement) => movement.status === MovementStatus.CONFIRMED)
          .flatMap((movement) =>
            movement.items
              .filter((item) => item.productId === productId && item.locationId === locationId)
              .map((item) => ({ movement, item })),
          )
          .sort(
            (a, b) =>
              a.movement.occurredAt.getTime() - b.movement.occurredAt.getTime() ||
              a.item.id.localeCompare(b.item.id),
          );

        // bigint on purpose: it is what SUM() OVER returns, and what the service converts.
        let balance = 0n;
        const ledger = lines.map(({ movement, item }) => {
          balance += BigInt(item.quantityBase);
          return {
            id: item.id,
            movementId: movement.id,
            movementCode: movement.code,
            type: movement.type,
            occurredAt: movement.occurredAt,
            quantity: item.quantity,
            unit: item.unit,
            quantityBase: item.quantityBase,
            balanceAfter: balance,
          };
        });

        return { rows: ledger.reverse().slice(skip, skip + take), total: ledger.length };
      },
    };
  }

  stockRepository() {
    return {
      findPage: async (
        skip: number,
        take: number,
        locationId: string,
        filters: { search?: string; categoryId?: string; productIds?: string[] },
      ) => {
        const matching = this.ownProducts()
          .filter(
            (product) =>
              product.isActive &&
              (!filters.search ||
                product.name.toLowerCase().includes(filters.search.toLowerCase())) &&
              (!filters.categoryId || product.categoryId === filters.categoryId) &&
              (!filters.productIds || filters.productIds.includes(product.id)),
          )
          .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

        return {
          rows: matching
            .slice(skip, skip + take)
            .map((product) => this.stockRowOf(product, locationId)),
          total: matching.length,
        };
      },

      findBelowMinimum: async (locationId: string, limit: number) =>
        this.ownProducts()
          .filter((product) => product.isActive && product.minimumStock !== null)
          .map((product) => this.stockRowOf(product, locationId))
          .filter((row) => row.quantityBase <= row.minimumStock!)
          .sort(
            (a, b) =>
              a.quantityBase / a.minimumStock! - b.quantityBase / b.minimumStock! ||
              a.productName.localeCompare(b.productName),
          )
          .slice(0, limit)
          .map(({ isBelowMinimum: _isBelowMinimum, ...row }) => ({
            ...row,
            minimumStock: row.minimumStock!,
          })),

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
      findById: async (id: string) => {
        const product = this.ownProducts().find((candidate) => candidate.id === id);
        return product ? { ...product } : null;
      },

      findMovementTargets: async (ids: string[]) =>
        this.ownProducts().filter((product) => ids.includes(product.id)),
    };
  }

  reportsRepository() {
    return {
      summary: async (from: Date, to: Date) => {
        const movements = this.confirmedInRange(from, to);
        const lines = movements.flatMap((movement) =>
          movement.items.map((item) => ({ type: movement.type, item })),
        );
        const unitsOf = (type: MovementType) =>
          lines
            .filter((line) => line.type === type)
            .reduce((sum, line) => sum + line.item.quantityBase, 0);
        const countOf = (type: MovementType) =>
          movements.filter((movement) => movement.type === type).length;

        return {
          movements: movements.length,
          inboundMovements: countOf(MovementType.INBOUND),
          outboundMovements: countOf(MovementType.OUTBOUND),
          adjustmentMovements: countOf(MovementType.ADJUSTMENT),
          unitsIn: unitsOf(MovementType.INBOUND),
          unitsOut: -unitsOf(MovementType.OUTBOUND),
          unitsAdjusted: unitsOf(MovementType.ADJUSTMENT),
          productsMoved: new Set(lines.map((line) => line.item.productId)).size,
        };
      },

      catalogueSnapshot: async () => {
        const active = this.ownProducts().filter((product) => product.isActive);
        const onHandOf = (productId: string) =>
          [...this.stock.entries()]
            .filter(([key]) => key.endsWith(`:${productId}`))
            .reduce((sum, [, quantity]) => sum + quantity, 0);

        return {
          unitsOnHand: active.reduce((sum, product) => sum + onHandOf(product.id), 0),
          activeProducts: active.length,
          productsBelowMinimum: active.filter(
            (product) =>
              product.minimumStock !== null && onHandOf(product.id) <= product.minimumStock,
          ).length,
        };
      },

      consumption: async (from: Date, to: Date, groupBy: ConsumptionGrouping, limit: number) => {
        const groups = new Map<
          string,
          { id: string; name: string; quantityBase: number; movements: Set<string> }
        >();

        for (const movement of this.confirmedInRange(from, to)) {
          if (movement.type !== MovementType.OUTBOUND) {
            continue;
          }

          for (const item of movement.items) {
            const product = this.catalog.find((candidate) => candidate.id === item.productId)!;
            const [id, name] =
              groupBy === ConsumptionGrouping.Category
                ? [product.categoryId, product.categoryName]
                : groupBy === ConsumptionGrouping.Brand
                  ? [product.brandId!, product.brandName!]
                  : [product.id, product.name];
            const group = groups.get(id) ?? { id, name, quantityBase: 0, movements: new Set() };

            group.quantityBase -= item.quantityBase;
            group.movements.add(movement.id);
            groups.set(id, group);
          }
        }

        return [...groups.values()]
          .filter((group) => group.quantityBase > 0)
          .sort((a, b) => b.quantityBase - a.quantityBase || a.name.localeCompare(b.name))
          .slice(0, limit)
          .map(({ movements, ...group }) => ({ ...group, movementCount: movements.size }));
      },
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
