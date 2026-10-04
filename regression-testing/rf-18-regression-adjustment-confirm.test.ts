import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { beforeEach, describe, it } from 'vitest';
import { MovementType, MovementUnit } from '../src/generated/prisma/enums';
import { buildMovementsHarness, storedMovement, type MovementsHarness } from './support/movements-harness';

const adjustmentOf = (quantityBase: number) =>
  storedMovement({
    type: MovementType.ADJUSTMENT,
    items: [{ productId: 'p1', locationId: 'loc-1', quantityBase }],
  });

describe('RF-18 regression - Confirm an adjustment', () => {
  let h: MovementsHarness;

  beforeEach(() => {
    h = buildMovementsHarness();
  });

  it('a negative adjustment in cases keeps its sign once converted to base units', async () => {
    // Arrange
    h.products.resolveMovementTargets.mockResolvedValue(
      new Map([['p1', { name: 'Test product', brandName: 'Test brand', caseSize: 6 }]]),
    );

    // Act
    const lines = await h.service['toLines'](MovementType.ADJUSTMENT, 'loc-1', null, [
      { productId: 'p1', quantity: -2, unit: MovementUnit.CASE },
    ]);

    // Assert
    expect(lines.map((line) => line.quantityBase), 'signed base quantity').to.deep.equal([-12]);
  });

  it('confirming a positive adjustment adds it to stock', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(adjustmentOf(4));

    // Act
    await h.service.confirm('movement-1');

    // Assert
    expect(h.stock.applyDelta.mock.calls, 'stock delta').to.deep.equal([[['p1'], 'loc-1', 4, h.tx]]);
  });

  it('confirming a negative adjustment subtracts it from stock', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(adjustmentOf(-3));
    h.stock.findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 10 }]);

    // Act
    await h.service.confirm('movement-1');

    // Assert
    expect(h.stock.applyDelta.mock.calls, 'stock delta').to.deep.equal([[['p1'], 'loc-1', -3, h.tx]]);
  });

  it('a negative adjustment that empties the stock exactly is allowed', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(adjustmentOf(-10));
    h.stock.findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 10 }]);

    // Act
    await h.service.confirm('movement-1');

    // Assert
    expect(h.stock.applyDelta.mock.calls, 'stock delta down to zero').to.deep.equal([
      [['p1'], 'loc-1', -10, h.tx],
    ]);
  });

  it('a negative adjustment beyond the stock on hand is rejected', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(adjustmentOf(-11));
    h.stock.findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 10 }]);

    // Act & Assert
    try {
      await h.service.confirm('movement-1');
      expect.fail('Expected confirm to reject an adjustment that would leave negative stock');
    } catch (error) {
      expect(error, 'insufficient stock error').to.be.instanceOf(BadRequestException);
    }
    expect(h.stock.applyDelta.mock.calls, 'stock writes').to.be.empty;
  });
});
