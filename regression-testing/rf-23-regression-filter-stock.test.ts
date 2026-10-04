import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { describe, it, vi } from 'vitest';
import { LocationsService } from '../src/modules/inventory/locations.service';
import { StockService } from '../src/modules/inventory/stock.service';
import type { AuditService } from '../src/modules/audit/audit.service';
import type { ProductsService } from '../src/modules/catalog/products.service';
import type { LocationsRepository } from '../src/modules/inventory/repositories/locations.repository';
import type { MovementsRepository } from '../src/modules/inventory/repositories/movements.repository';
import type { StockRepository } from '../src/modules/inventory/repositories/stock.repository';

const defaultLocation = 'location-default';
const otherLocation = 'location-other';

const buildService = (options: { locationExists?: boolean; total?: number } = {}) => {
  const locationsRepo = {
    exists: vi.fn().mockResolvedValue(options.locationExists ?? true),
    findDefaultId: vi.fn().mockResolvedValue(defaultLocation),
  };
  const stockRepo = {
    findPage: vi.fn().mockResolvedValue({ rows: [], total: options.total ?? 0 }),
  };
  const locations = new LocationsService(
    locationsRepo as unknown as LocationsRepository,
    {} as AuditService,
  );

  return {
    stock: new StockService(
      stockRepo as unknown as StockRepository,
      {} as MovementsRepository,
      locations,
      {} as ProductsService,
    ),
    locationsRepo,
    stockRepo,
  };
};

describe('RF-23 regression - filter the stock levels', () => {
  it('search and category reach the query unchanged, and page 3 skips twenty rows', async () => {
    const { stock, stockRepo } = buildService({ total: 25 });

    await stock.list({ page: 3, pageSize: 10, search: 'ron', categoryId: 'category-1' });

    expect(stockRepo.findPage.mock.calls, 'query arguments').to.deep.equal([
      [20, 10, defaultLocation, { search: 'ron', categoryId: 'category-1', productIds: undefined }],
    ]);
  });

  it('a location from another organization stops the query before it runs', async () => {
    const { stock, stockRepo } = buildService({ locationExists: false });

    const error = await stock
      .list({ page: 1, pageSize: 10, locationId: otherLocation })
      .catch((e: unknown) => e);

    expect(error, 'thrown error')
      .to.be.instanceOf(BadRequestException)
      .and.to.have.property('message', 'That location does not exist');
    expect(stockRepo.findPage.mock.calls, 'queries sent').to.be.empty;
  });

  it('an empty location filter falls back to the default location', async () => {
    const { stock, stockRepo, locationsRepo } = buildService();

    await stock.list({ page: 1, pageSize: 10, locationId: '' });

    expect(locationsRepo.exists.mock.calls, 'existence checks').to.be.empty;
    expect(stockRepo.findPage.mock.calls[0], 'query arguments').to.include(defaultLocation);
  });

  it('a filter that matches nothing is still one empty page, not zero pages', async () => {
    const { stock } = buildService({ total: 0 });

    const page = await stock.list({ page: 1, pageSize: 10, search: 'no such product' });

    expect(page.data, 'rows').to.be.an('array').that.is.empty;
    expect(page.meta, 'page meta').to.include({ total: 0, count: 0, pageCount: 1 });
  });
});
