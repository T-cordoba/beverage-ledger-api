import { BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { MovementsService } from '../src/modules/inventory/movements.service';

/**
 * RF-19 - BACK - resolveOccurredAt(occurredAt)
 * Un test por cada camino de la tabla de docs/testing/RF-19-borrador-movimiento.md.
 * El metodo es privado, asi que se llama con corchetes.
 */
describe('resolveOccurredAt', () => {
  let app: INestApplicationContext;
  let movements: MovementsService;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    movements = app.get(MovementsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Camino 1 - llega una fecha pasada y se devuelve tal cual', () => {
    const fecha = new Date('2026-08-20');

    expect(movements['resolveOccurredAt'](fecha)).toEqual(fecha);
  });

  it('Camino 2 - llega una fecha futura y se rechaza', () => {
    const futura = new Date('2026-12-31');

    expect(() => movements['resolveOccurredAt'](futura)).toThrow(BadRequestException);
  });

  it('Camino 3 - no llega fecha y se toma el instante actual', () => {
    const antes = Date.now();

    const resuelta = movements['resolveOccurredAt'](undefined);

    expect(resuelta.getTime()).toBeGreaterThanOrEqual(antes);
    expect(resuelta.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
