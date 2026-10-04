import { randomUUID } from 'node:crypto';
import {
  MovementStatus,
  MovementType,
  MovementUnit,
  UserRole,
  UserStatus,
} from '../../src/generated/prisma/enums';

/**
 * In-memory stand-in for PrismaService with TWO organizations.
 *
 * Unlike the api-testing ledger, which replaces the repositories, this replaces
 * only the Prisma client: the production repositories (and therefore
 * BaseRepository.scopedWhere, the tenant isolation) run for real on top of it.
 *
 * The filter is deliberately dumb: it applies exactly the `where` it is given
 * and nothing else. If a repository forgot `organizationId`, rows from the other
 * tenant would come back, and the cross-tenant tests would catch it. Any filter
 * operator it does not understand throws instead of matching silently.
 */

export const ORG_A = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a';
export const ORG_B = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';

export const USERS = {
  OPERATOR: {
    id: '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
    organizationId: ORG_A,
    role: UserRole.OPERATOR,
    status: UserStatus.ACTIVE,
    name: 'Olga Operator',
    email: 'olga.operator@licorera-a.test',
  },
  MANAGER: {
    id: '2a2a2a2a-2a2a-4a2a-8a2a-2a2a2a2a2a2a',
    organizationId: ORG_A,
    role: UserRole.MANAGER,
    status: UserStatus.ACTIVE,
    name: 'Mario Manager',
    email: 'mario.manager@licorera-a.test',
  },
  SUSPENDED_MANAGER: {
    id: '3a3a3a3a-3a3a-4a3a-8a3a-3a3a3a3a3a3a',
    organizationId: ORG_A,
    role: UserRole.MANAGER,
    status: UserStatus.SUSPENDED,
    name: 'Sara Suspended',
    email: 'sara.suspended@licorera-a.test',
  },
  /** Manager of the OTHER organization: the victim in cross-tenant tests. */
  MANAGER_B: {
    id: '4b4b4b4b-4b4b-4b4b-8b4b-4b4b4b4b4b4b',
    organizationId: ORG_B,
    role: UserRole.MANAGER,
    status: UserStatus.ACTIVE,
    name: 'Beatriz Manager',
    email: 'beatriz.manager@licorera-b.test',
  },
} as const;

export type TestUser = (typeof USERS)[keyof typeof USERS];

/** Present in every user row so a leak of it is detectable. Never a real hash. */
export const FAKE_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c2VjdXJpdHktc3VpdGU$ZmFrZQ';

export const LOCATIONS = {
  A_MAIN: '5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a',
  A_BAR: '6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6a6a',
  B_MAIN: '5b5b5b5b-5b5b-4b5b-8b5b-5b5b5b5b5b5b',
} as const;

export const PRODUCTS = {
  /** Organization A, case of 12. */
  A_RUM: '7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a',
  /** Organization B, case of 6. */
  B_VODKA: '7b7b7b7b-7b7b-4b7b-8b7b-7b7b7b7b7b7b',
} as const;

/** Organization B's confirmed movement, seeded: the target of IDOR attempts. */
export const B_MOVEMENT = {
  id: '9b9b9b9b-9b9b-4b9b-8b9b-9b9b9b9b9b9b',
  code: 'MOV-2026-000777',
};

export const INITIAL_STOCK: Record<string, Record<string, number>> = {
  [LOCATIONS.A_MAIN]: { [PRODUCTS.A_RUM]: 100 },
  [LOCATIONS.A_BAR]: { [PRODUCTS.A_RUM]: 5 },
  [LOCATIONS.B_MAIN]: { [PRODUCTS.B_VODKA]: 50 },
};

type Row = Record<string, any>;
type Where = Record<string, unknown> | undefined;
type Select = Record<string, unknown> | undefined;

interface State {
  organizations: Row[];
  users: Row[];
  locations: Row[];
  products: Row[];
  stockLevels: Row[];
  movements: Row[];
  movementItems: Row[];
  auditLogs: Row[];
  counters: Row[];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

const same = (a: unknown, b: unknown): boolean =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;

function matches(row: Row, where: Where): boolean {
  for (const [key, condition] of Object.entries(where ?? {})) {
    if (condition === undefined) {
      continue;
    }

    if (!isPlainObject(condition)) {
      if (!same(row[key], condition)) return false;
      continue;
    }

    for (const [operator, operand] of Object.entries(condition)) {
      switch (operator) {
        case 'in':
          if (!(operand as unknown[]).some((value) => same(row[key], value))) return false;
          break;
        case 'gte':
          if (!(row[key] >= (operand as number))) return false;
          break;
        case 'not':
          if (same(row[key], operand)) return false;
          break;
        default:
          throw new Error(`fake-prisma: unsupported filter ${key}.${operator}`);
      }
    }
  }

  return true;
}

function pick(row: Row, select: Select): Row {
  if (!select) return { ...row };

  const out: Row = {};
  for (const [key, wanted] of Object.entries(select)) {
    if (wanted === true) out[key] = row[key];
  }
  return out;
}

function seed(): State {
  const created = new Date('2026-01-01T00:00:00Z');

  return {
    organizations: [
      {
        id: ORG_A,
        name: 'Licorera A',
        slug: 'licorera-a',
        legalName: 'Licorera A S.A.S.',
        logoUrl: null,
        timezone: 'America/Bogota',
        createdAt: created,
      },
      {
        id: ORG_B,
        name: 'Licorera B',
        slug: 'licorera-b',
        legalName: 'Licorera B S.A.S.',
        logoUrl: null,
        timezone: 'America/Bogota',
        createdAt: created,
      },
    ],
    users: Object.values(USERS).map((user) => ({
      ...user,
      avatarUrl: null,
      passwordHash: FAKE_PASSWORD_HASH,
      failedLoginAttempts: 0,
      lockedUntil: null,
    })),
    locations: [
      { id: LOCATIONS.A_MAIN, organizationId: ORG_A, name: 'Bodega A', isDefault: true, createdAt: created },
      { id: LOCATIONS.A_BAR, organizationId: ORG_A, name: 'Barra A', isDefault: false, createdAt: created },
      { id: LOCATIONS.B_MAIN, organizationId: ORG_B, name: 'Bodega B', isDefault: true, createdAt: created },
    ],
    products: [
      { id: PRODUCTS.A_RUM, organizationId: ORG_A, name: 'Ron A', caseSize: 12, isActive: true, brandName: 'Marca A' },
      { id: PRODUCTS.B_VODKA, organizationId: ORG_B, name: 'Vodka Secreto B', caseSize: 6, isActive: true, brandName: 'Marca B' },
    ],
    stockLevels: Object.entries(INITIAL_STOCK).flatMap(([locationId, byProduct]) =>
      Object.entries(byProduct).map(([productId, quantityBase]) => ({
        organizationId: locationId === LOCATIONS.B_MAIN ? ORG_B : ORG_A,
        productId,
        locationId,
        quantityBase,
      })),
    ),
    movements: [
      {
        id: B_MOVEMENT.id,
        organizationId: ORG_B,
        code: B_MOVEMENT.code,
        type: MovementType.OUTBOUND,
        status: MovementStatus.CONFIRMED,
        locationId: LOCATIONS.B_MAIN,
        destinationLocationId: null,
        occurredAt: created,
        reason: null,
        note: 'Venta confidencial de B',
        createdByUserId: USERS.MANAGER_B.id,
        confirmedAt: created,
        cancelledAt: null,
        createdAt: created,
      },
    ],
    movementItems: [
      {
        id: randomUUID(),
        movementId: B_MOVEMENT.id,
        productId: PRODUCTS.B_VODKA,
        locationId: LOCATIONS.B_MAIN,
        quantity: 10,
        unit: MovementUnit.BOTTLE,
        quantityBase: -10,
        productNameSnapshot: 'Vodka Secreto B',
        brandNameSnapshot: 'Marca B',
      },
    ],
    auditLogs: [],
    counters: [],
  };
}

export class FakePrisma {
  state: State = seed();
  private readonly faults = new Map<string, Error>();
  private queue: Promise<unknown> = Promise.resolve();

  reset(): void {
    this.state = seed();
    this.faults.clear();
  }

  /** The next call to `model.method` throws `error` (simulated infrastructure failure). */
  failNext(operation: string, error: Error): void {
    this.faults.set(operation, error);
  }

  stockOf(locationId: string, productId: string): number {
    return (
      this.state.stockLevels.find((s) => s.locationId === locationId && s.productId === productId)
        ?.quantityBase ?? 0
    );
  }

  movementById(id: string): Row | undefined {
    return this.state.movements.find((m) => m.id === id);
  }

  private trip(operation: string): void {
    const error = this.faults.get(operation);
    if (error) {
      this.faults.delete(operation);
      throw error;
    }
  }

  /**
   * Interactive transactions are serialized and rolled back on error, like the
   * row locks and atomic commit PostgreSQL gives the real repositories. Without
   * the rollback a failure after `transition` would leave half a movement behind
   * and the "nothing changed" assertions would be meaningless.
   */
  $transaction(work: unknown): Promise<unknown> {
    if (Array.isArray(work)) {
      return Promise.all(work);
    }

    const run = async () => {
      const snapshot = structuredClone(this.state);
      try {
        return await (work as (tx: FakePrisma) => Promise<unknown>)(this);
      } catch (error) {
        this.state = snapshot;
        throw error;
      }
    };

    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Only the movement counter uses raw SQL on the paths under test. */
  async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
    this.trip('$queryRaw');
    const sql = strings.join('?');

    if (!sql.includes('movement_counters')) {
      throw new Error('fake-prisma: unsupported raw query');
    }

    const [organizationId, year] = values as [string, number];
    let counter = this.state.counters.find((c) => c.organizationId === organizationId && c.year === year);

    if (!counter) {
      counter = { organizationId, year, next: 1 };
      this.state.counters.push(counter);
    }

    const sequence = counter.next;
    counter.next += 1;
    return [{ sequence }];
  }

  get organization() {
    return {
      findUnique: async ({ where, select }: { where: Where; select?: Select }) => {
        this.trip('organization.findUnique');
        const row = this.state.organizations.find((o) => matches(o, where));
        return row ? pick(row, select) : null;
      },
    };
  }

  get user() {
    return {
      findUnique: async ({ where, select }: { where: Where; select?: Select }) => {
        this.trip('user.findUnique');
        const row = this.state.users.find((u) => matches(u, where));
        return row ? pick(row, select) : null;
      },
    };
  }

  get location() {
    return {
      findFirst: async ({ where, select }: { where: Where; select?: Select }) => {
        this.trip('location.findFirst');
        const row = this.state.locations.find((l) => matches(l, where));
        return row ? pick(row, select) : null;
      },
    };
  }

  get product() {
    return {
      findMany: async ({ where }: { where: Where }) => {
        this.trip('product.findMany');
        return this.state.products
          .filter((p) => matches(p, where))
          .map((p) => ({
            id: p.id,
            name: p.name,
            caseSize: p.caseSize,
            isActive: p.isActive,
            brand: p.brandName ? { name: p.brandName } : null,
          }));
      },
    };
  }

  get stockLevel() {
    return {
      findMany: async ({ where, select }: { where: Where; select?: Select }) => {
        this.trip('stockLevel.findMany');
        return this.state.stockLevels.filter((s) => matches(s, where)).map((s) => pick(s, select));
      },
      createMany: async ({ data }: { data: Row[]; skipDuplicates?: boolean }) => {
        this.trip('stockLevel.createMany');
        let count = 0;
        for (const row of data) {
          const exists = this.state.stockLevels.some(
            (s) => s.productId === row.productId && s.locationId === row.locationId,
          );
          if (!exists) {
            this.state.stockLevels.push({ ...row });
            count += 1;
          }
        }
        return { count };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Where;
        data: { quantityBase: { increment: number } };
      }) => {
        this.trip('stockLevel.updateMany');
        const rows = this.state.stockLevels.filter((s) => matches(s, where));
        for (const row of rows) row.quantityBase += data.quantityBase.increment;
        return { count: rows.length };
      },
    };
  }

  get movement() {
    const project = (row: Row, select: Select): Row => {
      const out = pick(row, select);
      if (select?.createdBy) {
        const author = this.state.users.find((u) => u.id === row.createdByUserId)!;
        out.createdBy = { id: author.id, name: author.name };
      }
      if (select?.items) {
        const itemSelect = (select.items as { select?: Select }).select;
        out.items = this.state.movementItems
          .filter((i) => i.movementId === row.id)
          .sort(
            (a, b) =>
              a.productNameSnapshot.localeCompare(b.productNameSnapshot) ||
              a.quantityBase - b.quantityBase,
          )
          .map((i) => pick(i, itemSelect));
      }
      return out;
    };

    return {
      create: async ({ data }: { data: Row }) => {
        this.trip('movement.create');
        const { items, ...movement } = data;
        const id = randomUUID();
        this.state.movements.push({
          ...movement,
          id,
          confirmedAt: null,
          cancelledAt: null,
          createdAt: new Date(),
        });
        for (const item of items.create as Row[]) {
          this.state.movementItems.push({ ...item, id: randomUUID(), movementId: id });
        }
        return { id };
      },
      findFirst: async ({ where, select }: { where: Where; select?: Select }) => {
        this.trip('movement.findFirst');
        const row = this.state.movements.find((m) => matches(m, where));
        return row ? project(row, select) : null;
      },
      updateMany: async ({ where, data }: { where: Where; data: Row }) => {
        this.trip('movement.updateMany');
        const rows = this.state.movements.filter((m) => matches(m, where));
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      },
    };
  }

  get movementItem() {
    return {
      deleteMany: async ({ where }: { where: Where }) => {
        const before = this.state.movementItems.length;
        this.state.movementItems = this.state.movementItems.filter((i) => !matches(i, where));
        return { count: before - this.state.movementItems.length };
      },
      createMany: async ({ data }: { data: Row[] }) => {
        for (const item of data) this.state.movementItems.push({ ...item, id: randomUUID() });
        return { count: data.length };
      },
    };
  }

  get auditLog() {
    return {
      create: async ({ data }: { data: Row }) => {
        this.trip('auditLog.create');
        this.state.auditLogs.push({ ...data, id: randomUUID(), createdAt: new Date() });
        return data;
      },
    };
  }
}

export { MovementStatus, MovementType, MovementUnit, UserRole };
