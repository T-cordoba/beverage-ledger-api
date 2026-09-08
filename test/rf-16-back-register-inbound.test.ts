import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    await expect(
      service['toLines']('INBOUND' as any, 'location-1', null, [
        {
          productId: 'producto-inexistente',

          quantity: 6,
          unit: 'UNIT' as any,
        },
      ]),
    ).rejects.toThrow(BadRequestException);
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
    await expect(
      service['toLines']('TRANSFER' as any, 'location-1', null, [
        {
          productId: 'producto-1',
          quantity: 6,
          unit: 'UNIT' as any,
        },
      ]),
    ).rejects.toThrow(BadRequestException);

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

    expect(lines).toHaveLength(2);
    expect(lines[0].locationId).toBe('location-1');
    expect(lines[0].quantityBase).toBe(-6);
    expect(lines[1].locationId).toBe('location-2');
    expect(lines[1].quantityBase).toBe(6);
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

    expect(lines).toHaveLength(1);
    expect(lines[0].locationId).toBe('location-1');
    expect(lines[0].quantityBase).toBe(-6);
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
    expect(lines).toHaveLength(1);
    expect(lines[0].locationId).toBe('location-1');

    expect(lines[0].quantityBase).toBe(6);
  });
});