import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { beforeEach, describe, it, vi } from 'vitest';
import { MovementsService } from '../src/modules/inventory/movements.service';

describe('RF-16 - Registrar una entrada', () => {
  let service: MovementsService;
  let resolveMovementTargets: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolveMovementTargets = vi.fn();

    const products = { resolveMovementTargets };

    service = new MovementsService(
      {} as any,
      {} as any,
      {} as any,
      products as any,
      {} as any,
      {} as any,
    );
  });

  it('Camino 1 - producto inexistente', async () => {
    // Arrange
    resolveMovementTargets.mockResolvedValue(new Map());

    // Act & Assert
    try {
      await service['toLines']('INBOUND' as any, 'location-1', null, [
        {
          productId: 'producto-inexistente',

          quantity: 6,
          unit: 'UNIT' as any,
        },
      ]);
      expect.fail('Expected toLines to throw for a missing product');
    } catch (error) {
      expect(error, 'missing product error').to.be.instanceOf(
        BadRequestException,
      );
    }
  });

  it('Camino 2 - TRANSFER sin destinationLocationId', async () => {
    // Arrange
    resolveMovementTargets.mockResolvedValue(
      new Map([
        [
          'producto-1',
          {
            name: 'Producto 1',
            brandName: 'Marca 1',
            caseSize: 12,
          },
        ],
      ]),
    );

    // Act & Assert
    try {
      await service['toLines']('TRANSFER' as any, 'location-1', null, [
        {
          productId: 'producto-1',
          quantity: 6,
          unit: 'UNIT' as any,
        },
      ]);
      expect.fail('Expected toLines to throw when destinationLocationId is missing');
    } catch (error) {
      expect(error, 'missing destination location error').to.be.instanceOf(
        BadRequestException,
      );
    }
  });

  it('Camino 3 - TRANSFER con destinationLocationId', async () => {
    // Arrange
    resolveMovementTargets.mockResolvedValue(
      new Map([
        [
          'producto-1',
          {
            name: 'Producto 1',
            brandName: 'Marca 1',
            caseSize: 12,
          },
        ],
      ]),
    );

    // Act
    const lines = await service['toLines'](
      'TRANSFER' as any,
      'location-1',
      'location-2',
      [
        {
          productId: 'producto-1',
          quantity: 6,
          unit: 'UNIT' as any,
        },
      ],
    );

    // Assert

    expect(lines, 'transfer lines').to.have.lengthOf(2);
    expect(lines[0].locationId, 'transfer origin location').to.equal(
      'location-1',
    );
    expect(lines[0].quantityBase, 'transfer origin quantityBase').to.equal(
      -6,
    );
    expect(lines[1].locationId, 'transfer destination location').to.equal(
      'location-2',
    );
    expect(
      lines[1].quantityBase,
      'transfer destination quantityBase',
    ).to.equal(6);
  });

  it('Camino 4 - OUTBOUND', async () => {
    // Arrange
    resolveMovementTargets.mockResolvedValue(
      new Map([
        [
          'producto-1',
          {
            name: 'Producto 1',
            brandName: 'Marca 1',
            caseSize: 12,
          },
        ],
      ]),
    );

    // Act
    const lines = await service['toLines']('OUTBOUND' as any, 'location-1', null, [
      {
        productId: 'producto-1',
        quantity: 6,
        unit: 'UNIT' as any,
      },
    ]);

    // Assert

    expect(lines, 'outbound lines').to.have.lengthOf(1);
    expect(lines[0].locationId, 'outbound location').to.equal('location-1');
    expect(lines[0].quantityBase, 'outbound quantityBase').to.equal(-6);
  });

  it('Camino 5 - INBOUND', async () => {
    // Arrange
    resolveMovementTargets.mockResolvedValue(
      new Map([
        [
          'producto-1',
          {
            name: 'Producto 1',
            brandName: 'Marca 1',
            caseSize: 12,
          },
        ],
      ]),
    );

    // Act
    const lines = await service['toLines']('INBOUND' as any, 'location-1', null, [
      {
        productId: 'producto-1',
        quantity: 6,
        unit: 'UNIT' as any,
      },
    ]);

    // Assert
    expect(lines, 'inbound lines').to.have.lengthOf(1);
    expect(lines[0].locationId, 'inbound location').to.equal('location-1');

    expect(lines[0].quantityBase, 'inbound quantityBase').to.equal(6);
  });
});