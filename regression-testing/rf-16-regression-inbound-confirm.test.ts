import { ConflictException, ForbiddenException } from '@nestjs/common';
import { expect } from 'chai';
import { describe, it } from 'vitest';
import { MovementStatus, MovementType, UserRole } from '../src/generated/prisma/enums';
import { buildMovementsHarness, storedMovement } from './support/movements-harness';

describe('RF-16 regression - Confirm an inbound movement', () => {
  it('confirming a 36-bottle inbound with no prior stock row creates it and adds 36', async () => {
    // Arrange
    const h = buildMovementsHarness();
    h.movements.findById.mockResolvedValue(
      storedMovement({
        type: MovementType.INBOUND,
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: 36 }],
      }),
    );
    h.stock.findLevels.mockResolvedValue([]);

    // Act
    await h.service.confirm('movement-1');

    // Assert
    expect(h.stock.ensureRows.mock.calls, 'stock row ensured').to.deep.equal([[['p1'], 'loc-1', h.tx]]);
    expect(h.stock.applyDelta.mock.calls, 'stock delta').to.deep.equal([[['p1'], 'loc-1', 36, h.tx]]);
  });

  it('an operator may not confirm an inbound', async () => {
    // Arrange
    const h = buildMovementsHarness(UserRole.OPERATOR);
    h.movements.findById.mockResolvedValue(
      storedMovement({
        type: MovementType.INBOUND,
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: 36 }],
      }),
    );

    // Act & Assert
    try {
      await h.service.confirm('movement-1');
      expect.fail('Expected confirm to reject an inbound confirmed by an operator');
    } catch (error) {
      expect(error, 'missing permission error').to.be.instanceOf(ForbiddenException);
    }
    expect(h.stock.applyDelta.mock.calls, 'stock writes').to.be.empty;
  });

  it('a cancelled inbound cannot be confirmed', async () => {
    // Arrange
    const h = buildMovementsHarness();
    h.movements.findById.mockResolvedValue(
      storedMovement({
        type: MovementType.INBOUND,
        status: MovementStatus.CANCELLED,
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: 36 }],
      }),
    );

    // Act & Assert
    try {
      await h.service.confirm('movement-1');
      expect.fail('Expected confirm to reject a cancelled inbound');
    } catch (error) {
      expect(error, 'not a draft error').to.be.instanceOf(ConflictException);
    }
    expect(h.stock.applyDelta.mock.calls, 'stock writes').to.be.empty;
  });
});
