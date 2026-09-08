import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MovementType, MovementUnit } from '../src/generated/prisma/enums';
import { MovementsService } from '../src/modules/inventory/movements.service';

describe('RF-15 - Registrar una salida', () => {
  let service: MovementsService;
  let resolveMovementTargets: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolveMovementTargets = vi.fn().mockResolvedValue(
      new Map([
        [
          'producto-1',
          {
            name: 'Producto de prueba',
            brandName: 'Marca de prueba',
            caseSize: 12,
          },
        ],
      ]),
    );

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

  it('Camino 1 - una salida con cantidad positiva es válida', () => {
    // Arrange
    const type = MovementType.OUTBOUND;
    const quantity = 1;

    // Act & Assert
    expect(() => service['assertQuantitySign'](type, quantity)).not.toThrow();
  });

  it('Camino 2 - una salida con cantidad cero es rechazada', () => {
    // Arrange
    const type = MovementType.OUTBOUND;
    const quantity = 0;

    // Act & Assert
    expect(() => service['assertQuantitySign'](type, quantity)).toThrow(
      BadRequestException,
    );
  });

  it('Camino 3 - una salida con cantidad negativa es rechazada', () => {
    // Arrange
    const type = MovementType.OUTBOUND;
    const quantity = -1;

    // Act & Assert
    expect(() => service['assertQuantitySign'](type, quantity)).toThrow(
      BadRequestException,
    );
  });

  it('Camino 4 - una salida por botellas genera quantityBase negativa', async () => {
    // Arrange
    const items = [
      {
        productId: 'producto-1',
        quantity: 2,
        unit: MovementUnit.BOTTLE,
      },
    ];

    // Act
    const result = await service['toLines'](
      MovementType.OUTBOUND,
      'ubicacion-1',
      null,
      items,
    );

    // Assert
    expect(result).toEqual([
      {
        productId: 'producto-1',
        quantity: 2,
        unit: MovementUnit.BOTTLE,
        productNameSnapshot: 'Producto de prueba',
        brandNameSnapshot: 'Marca de prueba',
        locationId: 'ubicacion-1',
        quantityBase: -2,
      },
    ]);
    expect(resolveMovementTargets).toHaveBeenCalledTimes(1);
  });

  it('Camino 5 - una salida por cajas convierte la cantidad a unidades base', async () => {
    // Arrange
    const items = [
      {
        productId: 'producto-1',
        quantity: 2,
        unit: MovementUnit.CASE,
      },
    ];

    // Act
    const result = await service['toLines'](
      MovementType.OUTBOUND,
      'ubicacion-1',
      null,
      items,
    );

    // Assert
    expect(result).toEqual([
      {
        productId: 'producto-1',
        quantity: 2,
        unit: MovementUnit.CASE,
        productNameSnapshot: 'Producto de prueba',
        brandNameSnapshot: 'Marca de prueba',
        locationId: 'ubicacion-1',
        quantityBase: -24,
      },
    ]);
    expect(resolveMovementTargets).toHaveBeenCalledTimes(1);
  });
});