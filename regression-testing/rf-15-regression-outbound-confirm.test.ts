import { BadRequestException, ConflictException } from '@nestjs/common';
import { expect } from 'chai';
import { beforeEach, describe, it } from 'vitest';
import { MovementStatus, MovementType, UserRole } from '../src/generated/prisma/enums';
import { buildMovementsHarness, storedMovement, type MovementsHarness } from './support/movements-harness';

describe('RF-15 regression - Confirm an outbound movement', () => {
  let h: MovementsHarness;

  beforeEach(() => {
    // An operator is the narrowest role allowed to record an outbound.
    h = buildMovementsHarness(UserRole.OPERATOR);
  });

  it('confirming a 12-bottle outbound with 20 on hand subtracts 12 from stock', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(
      storedMovement({
        type: MovementType.OUTBOUND,
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: -12 }],
      }),
    );
    h.stock.findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 20 }]);

    // Act
    await h.service.confirm('movement-1');

    // Assert
    expect(h.movements.transition.mock.calls[0].slice(0, 3), 'draft to confirmed').to.deep.equal([
      'movement-1',
      MovementStatus.DRAFT,
      MovementStatus.CONFIRMED,
    ]);
    expect(h.stock.applyDelta.mock.calls, 'stock delta').to.deep.equal([[['p1'], 'loc-1', -12, h.tx]]);
  });

  it('an outbound that empties the stock exactly is allowed', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(
      storedMovement({
        type: MovementType.OUTBOUND,
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: -12 }],
      }),
    );
    h.stock.findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 12 }]);

    // Act
    await h.service.confirm('movement-1');

    // Assert
    expect(h.stock.applyDelta.mock.calls, 'stock delta down to zero').to.deep.equal([
      [['p1'], 'loc-1', -12, h.tx],
    ]);
  });

  it('an outbound beyond the stock on hand is rejected and stock is left untouched', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(
      storedMovement({
        type: MovementType.OUTBOUND,
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: -12 }],
      }),
    );
    h.stock.findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 5 }]);

    // Act & Assert
    try {
      await h.service.confirm('movement-1');
      expect.fail('Expected confirm to reject an outbound that would leave negative stock');
    } catch (error) {
      expect(error, 'insufficient stock error').to.be.instanceOf(BadRequestException);
      expect((error as Error).message, 'names the short product').to.contain('p1 (on hand 5, needs 12)');
    }
    expect(h.movements.transition.mock.calls, 'status change').to.be.empty;
    expect(h.stock.applyDelta.mock.calls, 'stock writes').to.be.empty;
  });

  it('an already confirmed outbound cannot be confirmed twice', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(
      storedMovement({
        type: MovementType.OUTBOUND,
        status: MovementStatus.CONFIRMED,
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: -12 }],
      }),
    );

    // Act & Assert
    try {
      await h.service.confirm('movement-1');
      expect.fail('Expected confirm to reject a movement that is no longer a draft');
    } catch (error) {
      expect(error, 'double confirm error').to.be.instanceOf(ConflictException);
    }
    expect(h.stock.applyDelta.mock.calls, 'stock writes').to.be.empty;
  });
});
