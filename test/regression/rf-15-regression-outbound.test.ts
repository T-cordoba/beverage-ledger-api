import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { describe, it, vi } from 'vitest';
import { MovementType, MovementUnit } from '../../src/generated/prisma/enums';
import { MovementsService } from '../../src/modules/inventory/movements.service';

/**
 * Builds a fresh MovementsService wired to its own mocks, so each test owns
 * its data and no state leaks between tests (FIRST: Independent).
 */
function buildService(resolveMovementTargets: ReturnType<typeof vi.fn>): MovementsService {
  const products = { resolveMovementTargets };

  return new MovementsService({} as any, {} as any, {} as any, products as any, {} as any, {} as any);
}

describe('RF-15 regression - Register an outbound movement', () => {
  it('a 2-bottle outbound produces a single line with quantityBase -2', async () => {
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
        quantity: 2,
        unit: MovementUnit.BOTTLE,
      },
    ];

    // Act
    const result = await service['toLines'](MovementType.OUTBOUND, 'location-1', null, items);

    // Assert
    expect(result, 'outbound line by bottle').to.deep.equal([
      {
        productId: 'product-1',
        quantity: 2,
        unit: MovementUnit.BOTTLE,
        productNameSnapshot: 'Test product',
        brandNameSnapshot: 'Test brand',
        locationId: 'location-1',
        quantityBase: -2,
      },
    ]);
  });

  it('a 2-case outbound converts to base units as quantityBase -24', async () => {
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
        quantity: 2,
        unit: MovementUnit.CASE,
      },
    ];

    // Act
    const result = await service['toLines'](MovementType.OUTBOUND, 'location-1', null, items);

    // Assert
    expect(result, 'outbound line by case').to.deep.equal([
      {
        productId: 'product-1',
        quantity: 2,
        unit: MovementUnit.CASE,
        productNameSnapshot: 'Test product',
        brandNameSnapshot: 'Test brand',
        locationId: 'location-1',
        quantityBase: -24,
      },
    ]);
  });

  it('an outbound with zero quantity is rejected', () => {
    // Arrange
    const resolveMovementTargets = vi.fn();
    const service = buildService(resolveMovementTargets);
    const type = MovementType.OUTBOUND;
    const quantity = 0;

    // Act & Assert
    expect(
      () => service['assertQuantitySign'](type, quantity),
      'zero outbound quantity is rejected',
    ).to.throw(BadRequestException);
  });

  it('an outbound with negative quantity is rejected', () => {
    // Arrange
    const resolveMovementTargets = vi.fn();
    const service = buildService(resolveMovementTargets);
    const type = MovementType.OUTBOUND;
    const quantity = -3;

    // Act & Assert
    expect(
      () => service['assertQuantitySign'](type, quantity),
      'negative outbound quantity is rejected',
    ).to.throw(BadRequestException);
  });
});
