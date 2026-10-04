import { expect } from 'chai';
import { describe, it } from 'vitest';
import { toDto, type StockProductRow } from '../src/modules/inventory/repositories/stock.mapper';

const row = (overrides: Partial<StockProductRow> = {}): StockProductRow => ({
  id: 'product-1',
  name: 'Havana Club 7 Años',
  caseSize: 12,
  minimumStock: 10,
  category: { name: 'Rum' },
  brand: { name: 'Havana Club' },
  stockLevels: [{ quantityBase: 40 }],
  ...overrides,
});

describe('RF-22 regression - current stock levels', () => {
  it('stock sitting exactly at the minimum already counts as below it', () => {
    const atMinimum = row({ stockLevels: [{ quantityBase: 10 }], minimumStock: 10 });

    const level = toDto(atMinimum);

    expect(level.isBelowMinimum, 'at the threshold').to.equal(true);
  });

  it('a minimum of zero is a real threshold, not a missing one', () => {
    const zeroMinimum = row({ stockLevels: [], minimumStock: 0 });

    const level = toDto(zeroMinimum);

    expect(level, 'level').to.include({ quantityBase: 0, minimumStock: 0, isBelowMinimum: true });
  });

  it('answers with exactly the fields of the API contract and nothing of the database row', () => {
    const fromDatabase = row();

    const level = toDto(fromDatabase);

    expect(level, 'stock level').to.have.all.keys(
      'productId',
      'productName',
      'brandName',
      'categoryName',
      'quantityBase',
      'caseSize',
      'minimumStock',
      'isBelowMinimum',
    );
    expect(level, 'stock level').to.not.have.any.keys('stockLevels', 'brand', 'category', 'id');
  });

  it('flattens the related names into plain strings', () => {
    const withRelations = row();

    const level = toDto(withRelations);

    expect(level, 'names').to.deep.include({ brandName: 'Havana Club', categoryName: 'Rum' });
    expect(level.brandName, 'brand name').to.be.a('string');
  });
});
