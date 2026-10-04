import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { beforeEach, describe, it } from 'vitest';
import { MovementStatus, MovementType } from '../src/generated/prisma/enums';
import { buildMovementsHarness, storedMovement, type MovementsHarness } from './support/movements-harness';

describe('RF-20 regression - Cancelling reverts each movement type', () => {
  let h: MovementsHarness;

  beforeEach(() => {
    h = buildMovementsHarness();
  });

  it('cancelling a confirmed outbound gives the 12 bottles back to stock', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(
      storedMovement({
        type: MovementType.OUTBOUND,
        status: MovementStatus.CONFIRMED,
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: -12 }],
      }),
    );

    // Act
    await h.service.cancel('movement-1', { reason: 'sale returned' });

    // Assert
    expect(h.stock.applyDelta.mock.calls, 'reversal delta').to.deep.equal([[['p1'], 'loc-1', 12, h.tx]]);
    expect(h.audit.recordIn.mock.calls[0][1].metadata, 'audit metadata').to.include({
      stockReverted: true,
      reason: 'sale returned',
    });
  });

  it('cancelling a confirmed transfer moves the stock back between both locations', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(
      storedMovement({
        type: MovementType.TRANSFER,
        status: MovementStatus.CONFIRMED,
        destinationLocationId: 'warehouse-2',
        items: [
          { productId: 'p1', locationId: 'warehouse-1', quantityBase: -6 },
          { productId: 'p1', locationId: 'warehouse-2', quantityBase: 6 },
        ],
      }),
    );
    h.stock.findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 6 }]);

    // Act
    await h.service.cancel('movement-1', { reason: 'sent to the wrong warehouse' });

    // Assert
    expect(h.stock.applyDelta.mock.calls, 'reversal deltas').to.deep.equal([
      [['p1'], 'warehouse-1', 6, h.tx],
      [['p1'], 'warehouse-2', -6, h.tx],
    ]);
  });

  it('cancelling a confirmed inbound whose goods already went out is rejected', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(
      storedMovement({
        type: MovementType.INBOUND,
        status: MovementStatus.CONFIRMED,
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: 10 }],
      }),
    );
    h.stock.findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 4 }]);

    // Act & Assert
    try {
      await h.service.cancel('movement-1', { reason: 'wrong supplier' });
      expect.fail('Expected cancel to reject a reversal that would leave negative stock');
    } catch (error) {
      expect(error, 'insufficient stock error').to.be.instanceOf(BadRequestException);
    }
    expect(h.movements.transition.mock.calls, 'status change').to.be.empty;
    expect(h.stock.applyDelta.mock.calls, 'stock writes').to.be.empty;
  });
});
