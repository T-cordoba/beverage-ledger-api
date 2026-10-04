import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { beforeEach, describe, it } from 'vitest';
import { MovementType, MovementUnit } from '../src/generated/prisma/enums';
import { buildMovementsHarness, storedMovement, type MovementsHarness } from './support/movements-harness';

const transferOf = (quantityBase: number) =>
  storedMovement({
    type: MovementType.TRANSFER,
    destinationLocationId: 'warehouse-2',
    items: [
      { productId: 'p1', locationId: 'warehouse-1', quantityBase: -quantityBase },
      { productId: 'p1', locationId: 'warehouse-2', quantityBase },
    ],
  });

describe('RF-17 regression - Create and confirm a transfer', () => {
  let h: MovementsHarness;

  beforeEach(() => {
    h = buildMovementsHarness();
  });

  it('creating a transfer stores both halves and the destination location', async () => {
    // Arrange
    h.products.resolveMovementTargets.mockResolvedValue(
      new Map([['p1', { name: 'Havana Club 7', brandName: 'Havana Club', caseSize: 12 }]]),
    );
    h.movements.findById.mockResolvedValue(transferOf(12));

    // Act
    await h.service.create({
      type: MovementType.TRANSFER,
      locationId: 'warehouse-1',
      destinationLocationId: 'warehouse-2',
      items: [{ productId: 'p1', quantity: 1, unit: MovementUnit.CASE }],
    } as any);

    // Assert
    const stored = h.movements.create.mock.calls[0][0];
    expect(stored.destinationLocationId, 'destination').to.equal('warehouse-2');
    expect(
      stored.items.map((line: any) => [line.locationId, line.quantityBase]),
      'origin and destination halves',
    ).to.deep.equal([
      ['warehouse-1', -12],
      ['warehouse-2', 12],
    ]);
  });

  it('confirming a 6-bottle transfer takes 6 from the origin and adds 6 to the destination', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(transferOf(6));
    h.stock.findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 10 }]);

    // Act
    await h.service.confirm('movement-1');

    // Assert
    expect(h.stock.applyDelta.mock.calls, 'stock deltas per location').to.deep.equal([
      [['p1'], 'warehouse-1', -6, h.tx],
      [['p1'], 'warehouse-2', 6, h.tx],
    ]);
    const net = h.stock.applyDelta.mock.calls.reduce((sum, call) => sum + (call[2] as number), 0);
    expect(net, 'total inventory is unchanged').to.equal(0);
  });

  it('a transfer beyond the origin stock is rejected and neither location changes', async () => {
    // Arrange
    h.movements.findById.mockResolvedValue(transferOf(6));
    h.stock.findLevels.mockImplementation(async (_ids: string[], locationId: string) =>
      locationId === 'warehouse-1' ? [{ productId: 'p1', quantityBase: 4 }] : [],
    );

    // Act & Assert
    try {
      await h.service.confirm('movement-1');
      expect.fail('Expected confirm to reject a transfer the origin cannot cover');
    } catch (error) {
      expect(error, 'insufficient origin stock error').to.be.instanceOf(BadRequestException);
    }
    expect(h.stock.applyDelta.mock.calls, 'stock writes').to.be.empty;
  });
});
