import { vi } from 'vitest';
import { MovementStatus, MovementType, UserRole } from '../../src/generated/prisma/enums';
import { MovementsService } from '../../src/modules/inventory/movements.service';

type Mock = ReturnType<typeof vi.fn>;

export interface MovementsHarness {
  service: MovementsService;
  tx: object;
  movements: Record<'findById' | 'runInTransaction' | 'nextSequence' | 'create' | 'transition', Mock>;
  stock: Record<'findLevels' | 'ensureRows' | 'applyDelta', Mock>;
  locations: Record<'resolve', Mock>;
  products: Record<'resolveMovementTargets', Mock>;
  audit: Record<'recordIn', Mock>;
  tenant: { userId: string; role: UserRole };
}

/**
 * A fresh MovementsService over doubles that behave like a healthy database:
 * every transition is claimed and every guarded stock UPDATE moves all its rows.
 * Each test builds its own, so nothing leaks between them (FIRST: Independent).
 */
export function buildMovementsHarness(role: UserRole = UserRole.MANAGER): MovementsHarness {
  const tx = {};
  const movements = {
    findById: vi.fn(),
    runInTransaction: vi.fn(async (cb: (tx: object) => unknown) => cb(tx)),
    nextSequence: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue('movement-1'),
    transition: vi.fn().mockResolvedValue(true),
  };
  const stock = {
    findLevels: vi.fn().mockResolvedValue([]),
    ensureRows: vi.fn().mockResolvedValue(undefined),
    applyDelta: vi.fn(async (ids: string[]) => ids.length),
  };
  const locations = { resolve: vi.fn(async (id: string) => id) };
  const products = { resolveMovementTargets: vi.fn() };
  const audit = { recordIn: vi.fn().mockResolvedValue(undefined) };
  const tenant = { userId: 'user-1', role };

  const service = new MovementsService(
    movements as any,
    stock as any,
    locations as any,
    products as any,
    audit as any,
    tenant as any,
  );

  return { service, tx, movements, stock, locations, products, audit, tenant };
}

/** A stored movement as the repository returns it. */
export function storedMovement(overrides: {
  type: MovementType;
  status?: MovementStatus;
  items: { productId: string; locationId: string; quantityBase: number }[];
  destinationLocationId?: string | null;
}) {
  return {
    id: 'movement-1',
    code: 'MOV-2026-000001',
    locationId: overrides.items[0]?.locationId ?? 'loc-1',
    destinationLocationId: overrides.destinationLocationId ?? null,
    status: MovementStatus.DRAFT,
    ...overrides,
  };
}
