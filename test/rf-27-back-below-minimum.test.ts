import { describe, expect, it, vi } from 'vitest';
import { StockService } from '../src/modules/inventory/stock.service';
import type { LocationsService } from '../src/modules/inventory/locations.service';
import type { MovementsRepository } from '../src/modules/inventory/repositories/movements.repository';
import type { StockRepository } from '../src/modules/inventory/repositories/stock.repository';
import type { ProductsService } from '../src/modules/catalog/products.service';

describe('belowMinimum', () => {
  const BODEGA = 'a1b2c3d4-0000-4000-8000-000000000002';

  interface FilaBajoMinimo {
    productId: string;
    productName: string;
    brandName: string | null;
    categoryName: string;
    quantityBase: number;
    caseSize: number;
    minimumStock: number;
  }

  const FILA: FilaBajoMinimo = {
    productId: 'e3f1c0aa-0000-4000-8000-000000000001',
    productName: 'Absolut Blue 750ml',
    brandName: 'Absolut',
    categoryName: 'Vodka',
    quantityBase: 4,
    caseSize: 12,
    minimumStock: 10,
  };

  const OTRA_FILA = {
    ...FILA,
    productId: 'e3f1c0aa-0000-4000-8000-000000000003',
    productName: 'Bacardi Carta Blanca 750ml',
    brandName: null,
    quantityBase: 0,
  };

  const nuevoServicio = (filas: FilaBajoMinimo[]) => {
    const stockRepo = {
      findBelowMinimum: vi.fn().mockResolvedValue(filas),
    } as unknown as StockRepository;
    const locations = { resolve: vi.fn().mockResolvedValue(BODEGA) } as unknown as LocationsService;

    return {
      stock: new StockService(
        stockRepo,
        {} as MovementsRepository,
        locations,
        {} as ProductsService,
      ),
      stockRepo,
    };
  };

  it('Camino 1 - el repositorio no devuelve filas y el arreglo sale vacio', async () => {
    const { stock, stockRepo } = nuevoServicio([]);

    const rows = await stock.belowMinimum({ limit: 8 });

    expect(rows).toEqual([]);
    expect(stockRepo.findBelowMinimum).toHaveBeenCalledWith(BODEGA, 8);
  });

  it('Camino 2 - el repositorio devuelve filas y todas quedan marcadas bajo minimo', async () => {
    const { stock, stockRepo } = nuevoServicio([FILA, OTRA_FILA]);

    const rows = await stock.belowMinimum({ limit: 8 });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.isBelowMinimum)).toBe(true);
    expect(rows[0]).toEqual({ ...FILA, isBelowMinimum: true });
    expect(stockRepo.findBelowMinimum).toHaveBeenCalledWith(BODEGA, 8);
  });
});
