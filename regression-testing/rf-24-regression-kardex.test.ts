import { NotFoundException } from '@nestjs/common';
import { expect } from 'chai';
import { describe, it, vi } from 'vitest';
import { MovementType, MovementUnit } from '../src/generated/prisma/enums';
import { StockService } from '../src/modules/inventory/stock.service';
import type { ProductsService } from '../src/modules/catalog/products.service';
import type { LocationsService } from '../src/modules/inventory/locations.service';
import type { MovementsRepository } from '../src/modules/inventory/repositories/movements.repository';
import type { StockRepository } from '../src/modules/inventory/repositories/stock.repository';

const productId = 'product-1';
const locationId = 'location-1';

const line = {
  id: 'line-1',
  movementId: 'movement-1',
  movementCode: 'MOV-2026-000042',
  type: MovementType.INBOUND,
  occurredAt: new Date('2026-08-20T10:00:00.000Z'),
  quantity: 2,
  unit: MovementUnit.CASE,
  quantityBase: 24,
  balanceAfter: 24n,
};

const buildService = (options: {
  rows?: unknown[];
  total?: number;
  findOne?: ReturnType<typeof vi.fn>;
}) => {
  const movementsRepo = {
    kardex: vi.fn().mockResolvedValue({ rows: options.rows ?? [], total: options.total ?? 0 }),
  };
  const locations = { resolve: vi.fn().mockResolvedValue(locationId) };
  const products = { findOne: options.findOne ?? vi.fn().mockResolvedValue({ id: productId }) };

  return {
    stock: new StockService(
      {} as StockRepository,
      movementsRepo as unknown as MovementsRepository,
      locations as unknown as LocationsService,
      products as unknown as ProductsService,
    ),
    movementsRepo,
    locations,
  };
};

describe('RF-24 regression - product kardex', () => {
  it('a running balance past the 32-bit range still arrives as an exact number', async () => {
    const { stock } = buildService({ rows: [{ ...line, balanceAfter: 5_000_000_000n }], total: 1 });

    const page = await stock.kardex(productId, { page: 1, pageSize: 10 });

    expect(page.data[0].balanceAfter, 'balance')
      .to.be.a('number')
      .and.to.equal(5_000_000_000)
      .and.to.satisfy(Number.isSafeInteger);
  });

  it('a product from another organization stops before the ledger is read', async () => {
    const { stock, movementsRepo, locations } = buildService({
      findOne: vi.fn().mockRejectedValue(new NotFoundException('Product not found')),
    });

    const error = await stock.kardex(productId, { page: 1, pageSize: 10 }).catch((e: unknown) => e);

    expect(error, 'thrown error').to.be.instanceOf(NotFoundException);
    expect(locations.resolve.mock.calls, 'location lookups').to.be.empty;
    expect(movementsRepo.kardex.mock.calls, 'ledger reads').to.be.empty;
  });

  it('page 3 skips twenty lines and the pager counts three pages', async () => {
    const { stock, movementsRepo } = buildService({ rows: [line], total: 25 });

    const page = await stock.kardex(productId, { page: 3, pageSize: 10 });

    expect(movementsRepo.kardex.mock.calls, 'ledger query').to.deep.equal([
      [productId, locationId, 20, 10],
    ]);
    expect(page.meta, 'page meta').to.deep.equal({
      page: 3,
      pageSize: 10,
      total: 25,
      pageCount: 3,
      count: 1,
    });
  });

  it('only the balance is converted, every other field of the line passes through untouched', async () => {
    const { stock } = buildService({ rows: [line], total: 1 });

    const page = await stock.kardex(productId, { page: 1, pageSize: 10 });

    const { balanceAfter: _balance, ...untouched } = line;
    expect(page.data[0], 'kardex entry').to.have.all.keys(...Object.keys(line));
    expect(page.data[0], 'kardex entry').to.deep.include(untouched);
  });
});
