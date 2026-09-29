import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { describe, it, vi } from 'vitest';
import { StockService } from '../../src/modules/inventory/stock.service';
import type { ProductsService } from '../../src/modules/catalog/products.service';
import type { LocationsService } from '../../src/modules/inventory/locations.service';
import type { MovementsRepository } from '../../src/modules/inventory/repositories/movements.repository';
import type { StockRepository } from '../../src/modules/inventory/repositories/stock.repository';

const locationId = 'location-1';

const shortage = (productName: string, quantityBase: number) => ({
  productId: productName,
  productName,
  brandName: null,
  categoryName: 'Spirits',
  quantityBase,
  caseSize: 12,
  minimumStock: 10,
});

const buildService = (options: { rows?: unknown[]; resolve?: ReturnType<typeof vi.fn> } = {}) => {
  const stockRepo = { findBelowMinimum: vi.fn().mockResolvedValue(options.rows ?? []) };
  const locations = { resolve: options.resolve ?? vi.fn().mockResolvedValue(locationId) };

  return {
    stock: new StockService(
      stockRepo as unknown as StockRepository,
      {} as MovementsRepository,
      locations as unknown as LocationsService,
      {} as ProductsService,
    ),
    stockRepo,
    locations,
  };
};

describe('RF-27 regression - products below the minimum stock', () => {
  it('the requested location and limit reach the query as they were asked for', async () => {
    const { stock, stockRepo, locations } = buildService();

    await stock.belowMinimum({ limit: 5, locationId });

    expect(locations.resolve.mock.calls, 'location lookups').to.deep.equal([[locationId]]);
    expect(stockRepo.findBelowMinimum.mock.calls, 'query arguments').to.deep.equal([
      [locationId, 5],
    ]);
  });

  it('keeps the ranking the database produced, worst first', async () => {
    const rows = [shortage('Absolut', 0), shortage('Havana', 2), shortage('Jameson', 7)];
    const { stock } = buildService({ rows });

    const levels = await stock.belowMinimum({ limit: 3 });

    expect(
      levels.map((level) => level.productName),
      'ranking',
    ).to.have.ordered.members(['Absolut', 'Havana', 'Jameson']);
  });

  it('flags each row without mutating what the repository returned', async () => {
    const original = shortage('Absolut', 4);
    const { stock } = buildService({ rows: [original] });

    const [level] = await stock.belowMinimum({ limit: 8 });

    expect(level, 'flagged level').to.deep.equal({ ...original, isBelowMinimum: true });
    expect(level, 'flagged level').to.not.equal(original);
    expect(original, 'repository row').to.not.have.property('isBelowMinimum');
  });

  it('an unknown location rejects before the shortlist is queried', async () => {
    const { stock, stockRepo } = buildService({
      resolve: vi.fn().mockRejectedValue(new BadRequestException('That location does not exist')),
    });

    const error = await stock
      .belowMinimum({ limit: 8, locationId: 'location-unknown' })
      .catch((e: unknown) => e);

    expect(error, 'thrown error').to.be.instanceOf(BadRequestException);
    expect(stockRepo.findBelowMinimum.mock.calls, 'queries sent').to.be.empty;
  });
});
