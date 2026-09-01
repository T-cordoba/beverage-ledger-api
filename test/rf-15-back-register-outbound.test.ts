
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MovementType, MovementUnit } from '../src/generated/prisma/enums';
import { MovementsService } from '../src/modules/inventory/movements.service';

describe('RF-15 - Registrar una salida', () => {
  const products = {
    resolveMovementTargets: async () =>
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
  };

  const service = new MovementsService(
    {} as any,
    {} as any,
    {} as any,
    products as any,
    {} as any,
    {} as any,
  );

  it('Camino 1 - una salida con cantidad positiva es válida', () => {
    expect(() =>
      service['assertQuantitySign'](MovementType.OUTBOUND, 1),
    ).not.toThrow();
  });

  it('Camino 2 - una salida con cantidad cero es rechazada', () => {
    expect(() =>
      service['assertQuantitySign'](MovementType.OUTBOUND, 0),
    ).toThrow(BadRequestException);
  });

  it('Camino 3 - una salida con cantidad negativa es rechazada', () => {
    expect(() =>
      service['assertQuantitySign'](MovementType.OUTBOUND, -1),
    ).toThrow(BadRequestException);
  });

  it('Camino 4 - una salida por botellas genera quantityBase negativa', async () => {
    const result = await service['toLines'](
      MovementType.OUTBOUND,
      'ubicacion-1',
      null,
      [
        {
          productId: 'producto-1',
          quantity: 2,
          unit: MovementUnit.BOTTLE,
        },
      ],
    );

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
  });

  it('Camino 5 - una salida por cajas convierte la cantidad a unidades base', async () => {
    const result = await service['toLines'](
      MovementType.OUTBOUND,
      'ubicacion-1',
      null,
      [
        {
          productId: 'producto-1',
          quantity: 2,
          unit: MovementUnit.CASE,
        },
      ],
    );

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
  });
});

