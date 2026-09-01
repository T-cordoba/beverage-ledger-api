
import { BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { MovementsService } from '../src/modules/inventory/movements.service';

describe('RF-16 - Registrar una entrada', () => {
  let app: INestApplicationContext;
  let movements: MovementsService;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });

    movements = app.get(MovementsService);

    vi.spyOn(
      (movements as any).products,
      'resolveMovementTargets',
    );
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('Camino 1 - producto inexistente', async () => {
    vi.spyOn(
      (movements as any).products,
      'resolveMovementTargets',
    ).mockResolvedValue(new Map());

    await expect(
      movements['toLines'](
        'INBOUND' as any,
        'location-1',
        null,
        [
          {
            productId: 'producto-inexistente',
            quantity: 6,
            unit: 'UNIT' as any,
          },
        ],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('Camino 2 - TRANSFER sin destinationLocationId', async () => {
    vi.spyOn(
      (movements as any).products,
      'resolveMovementTargets',
    ).mockResolvedValue(
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

    await expect(
      movements['toLines'](
        'TRANSFER' as any,
        'location-1',
        null,
        [
          {
            productId: 'producto-1',
            quantity: 6,
            unit: 'UNIT' as any,
          },
        ],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('Camino 3 - TRANSFER con destinationLocationId', async () => {
    vi.spyOn(
      (movements as any).products,
      'resolveMovementTargets',
    ).mockResolvedValue(
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

    const lines = await movements['toLines'](
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

    expect(lines).toHaveLength(2);
    expect(lines[0].locationId).toBe('location-1');
    expect(lines[0].quantityBase).toBe(-6);
    expect(lines[1].locationId).toBe('location-2');
    expect(lines[1].quantityBase).toBe(6);
  });

  it('Camino 4 - OUTBOUND', async () => {
    vi.spyOn(
      (movements as any).products,
      'resolveMovementTargets',
    ).mockResolvedValue(
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

    const lines = await movements['toLines'](
      'OUTBOUND' as any,
      'location-1',
      null,
      [
        {
          productId: 'producto-1',
          quantity: 6,
          unit: 'UNIT' as any,
        },
      ],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].locationId).toBe('location-1');
    expect(lines[0].quantityBase).toBe(-6);
  });

  it('Camino 5 - INBOUND', async () => {
    vi.spyOn(
      (movements as any).products,
      'resolveMovementTargets',
    ).mockResolvedValue(
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

    const lines = await movements['toLines'](
      'INBOUND' as any,
      'location-1',
      null,
      [
        {
          productId: 'producto-1',
          quantity: 6,
          unit: 'UNIT' as any,
        },
      ],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].locationId).toBe('location-1');
    expect(lines[0].quantityBase).toBe(6);
  });
});

