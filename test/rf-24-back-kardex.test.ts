import { describe, expect, it, vi } from 'vitest';
import { MovementType, MovementUnit } from '../src/generated/prisma/enums';
import { StockService } from '../src/modules/inventory/stock.service';
import type { LocationsService } from '../src/modules/inventory/locations.service';
import type { MovementsRepository } from '../src/modules/inventory/repositories/movements.repository';
import type { StockRepository } from '../src/modules/inventory/repositories/stock.repository';
import type { ProductsService } from '../src/modules/catalog/products.service';
import type { ProductDto } from '../src/modules/catalog/dto/product.dto';

describe('kardex', () => {
  const PRODUCTO = 'e3f1c0aa-0000-4000-8000-000000000001';
  const BODEGA = 'a1b2c3d4-0000-4000-8000-000000000002';

  const LINEA = {
    id: '11111111-0000-4000-8000-000000000001',
    movementId: '22222222-0000-4000-8000-000000000002',
    movementCode: 'MOV-2026-000042',
    type: MovementType.OUTBOUND,
    occurredAt: new Date('2026-08-20T10:00:00.000Z'),
    quantity: 2,
    unit: MovementUnit.BOTTLE,
    quantityBase: -2,
    balanceAfter: 24n,
  };

  const nuevoServicio = (kardex: () => Promise<{ rows: unknown[]; total: number }>) => {
    const movements = { kardex: vi.fn(kardex) } as unknown as MovementsRepository;
    const locations = { resolve: vi.fn().mockResolvedValue(BODEGA) } as unknown as LocationsService;
    const products = {
      findOne: vi.fn().mockResolvedValue({ id: PRODUCTO } as ProductDto),
    } as unknown as ProductsService;

    return {
      stock: new StockService({} as StockRepository, movements, locations, products),
      movements,
      locations,
      products,
    };
  };

  it('Camino 1 - el producto no tiene lineas en el ledger y la pagina sale vacia', async () => {
    const { stock, movements, products } = nuevoServicio(async () => ({ rows: [], total: 0 }));

    const page = await stock.kardex(PRODUCTO, { page: 1, pageSize: 10 });

    expect(page.data).toEqual([]);
    expect(page.meta.total).toBe(0);
    expect(products.findOne).toHaveBeenCalledWith(PRODUCTO);
    expect(movements.kardex).toHaveBeenCalledWith(PRODUCTO, BODEGA, 0, 10);
  });

  it('Camino 2 - el producto tiene lineas y cada una trae su saldo corrido', async () => {
    const { stock } = nuevoServicio(async () => ({ rows: [LINEA], total: 1 }));

    const page = await stock.kardex(PRODUCTO, { page: 1, pageSize: 10 });

    expect(page.data).toHaveLength(1);
    expect(page.data[0].balanceAfter).toBe(24);
    expect(typeof page.data[0].balanceAfter).toBe('number');
    expect(page.meta.total).toBe(1);
  });
});
