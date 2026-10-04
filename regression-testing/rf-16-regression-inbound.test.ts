import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { describe, it, vi } from 'vitest';
import { MovementType, MovementUnit } from '../src/generated/prisma/enums';
import { MovementsService } from '../src/modules/inventory/movements.service';

/**
 * Builds a fresh MovementsService wired to its own mocks, so each test owns
 * its data and no state leaks between tests (FIRST: Independent).
 */
function buildService(resolveMovementTargets: ReturnType<typeof vi.fn>): MovementsService {
  const products = { resolveMovementTargets };

  return new MovementsService({} as any, {} as any, {} as any, products as any, {} as any, {} as any);
}

describe('RF-16 regression - Register an inbound movement', () => {
  it('a 6-bottle inbound produces a single line with quantityBase 6', async () => {
    // Arrange
    const resolveMovementTargets = vi.fn().mockResolvedValue(
      new Map([
        [
          'product-1',
          {
            name: 'Test product',
            brandName: 'Test brand',
            caseSize: 12,
          },
        ],
      ]),
    );
    const service = buildService(resolveMovementTargets);
    const items = [
      {
        productId: 'product-1',
        quantity: 6,
        unit: MovementUnit.BOTTLE,
      },
    ];

    // Act
    const result = await service['toLines'](MovementType.INBOUND, 'location-1', null, items);

    // Assert
    expect(result, 'inbound line by bottle').to.deep.equal([
      {
        productId: 'product-1',
        quantity: 6,
        unit: MovementUnit.BOTTLE,
        productNameSnapshot: 'Test product',
        brandNameSnapshot: 'Test brand',
        locationId: 'location-1',
        quantityBase: 6,
      },
    ]);
  });

  it('a 3-case inbound converts to base units as quantityBase 36', async () => {
    // Arrange
    const resolveMovementTargets = vi.fn().mockResolvedValue(
      new Map([
        [
          'product-1',
          {
            name: 'Test product',
            brandName: 'Test brand',
            caseSize: 12,
          },
        ],
      ]),
    );
    const service = buildService(resolveMovementTargets);
    const items = [
      {
        productId: 'product-1',
        quantity: 3,
        unit: MovementUnit.CASE,
      },
    ];

    // Act
    const result = await service['toLines'](MovementType.INBOUND, 'location-1', null, items);

    // Assert
    expect(result, 'inbound line by case').to.deep.equal([
      {
        productId: 'product-1',
        quantity: 3,
        unit: MovementUnit.CASE,
        productNameSnapshot: 'Test product',
        brandNameSnapshot: 'Test brand',
        locationId: 'location-1',
        quantityBase: 36,
      },
    ]);
  });

  it('an inbound with zero quantity is rejected', () => {
    // Arrange
    const resolveMovementTargets = vi.fn();
    const service = buildService(resolveMovementTargets);
    const type = MovementType.INBOUND;
    const quantity = 0;

    // Act & Assert
    expect(
      () => service['assertQuantitySign'](type, quantity),
      'zero inbound quantity is rejected',
    ).to.throw(BadRequestException);
  });

  it('an inbound naming a destination location is rejected', async () => {
    // Arrange
    const resolveMovementTargets = vi.fn();
    const service = buildService(resolveMovementTargets);
    const type = MovementType.INBOUND;
    const dto = { destinationLocationId: 'location-2' };

    // Act & Assert
    try {
      await service['resolveDestination'](type, 'location-1', dto);
      expect.fail('Expected resolveDestination to throw for an inbound with a destination location');
    } catch (error) {
      expect(error, 'inbound with destination location error').to.be.instanceOf(BadRequestException);
    }
  });
});
