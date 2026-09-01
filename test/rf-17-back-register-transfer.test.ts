
import { BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { MovementsService } from '../src/modules/inventory/movements.service';

describe('RF-17 - Registrar un traspaso', () => {
  let app: INestApplicationContext;
  let movements: MovementsService;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });

    movements = app.get(MovementsService);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('Camino 1 - movimiento diferente de TRANSFER sin destinationLocationId', async () => {
    const resultado = await movements['resolveDestination'](
      'INBOUND',
      'location-1',
      {},
    );

    expect(resultado).toBeNull();
  });

  it('Camino 2 - movimiento diferente de TRANSFER con destinationLocationId', async () => {
    await expect(
      movements['resolveDestination'](
        'INBOUND',
        'location-1',
        {
          destinationLocationId: 'location-2',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('Camino 3 - TRANSFER sin destinationLocationId', async () => {
    await expect(
      movements['resolveDestination'](
        'TRANSFER',
        'location-1',
        {},
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('Camino 4 - TRANSFER con destinationLocationId diferente', async () => {
    const resolveSpy = vi
      .spyOn((movements as any).locations, 'resolve')
      .mockResolvedValue({ id: 'location-2' });

    const resultado = await movements['resolveDestination'](
      'TRANSFER',
      'location-1',
      {
        destinationLocationId: 'location-2',
      },
    );

    expect(resolveSpy).toHaveBeenCalledWith('location-2');
    expect(resultado).toEqual({ id: 'location-2' });
  });

  it('Camino 5 - TRANSFER con destinationLocationId igual a locationId', async () => {
    await expect(
      movements['resolveDestination'](
        'TRANSFER',
        'location-1',
        {
          destinationLocationId: 'location-1',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
