import { BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
    await app.close();
  });

  it('Camino 1 - un traspaso con cantidad positiva es válido', () => {
    expect(() =>
      movements['assertQuantitySign']('TRANSFER', 6),
    ).not.toThrow();
  });

  it('Camino 2 - un traspaso con cantidad cero es rechazado', () => {
    expect(() =>
      movements['assertQuantitySign']('TRANSFER', 0),
    ).toThrow(BadRequestException);
  });

  it('Camino 3 - un traspaso con cantidad negativa es rechazado', () => {
    expect(() =>
      movements['assertQuantitySign']('TRANSFER', -6),
    ).toThrow(BadRequestException);
  });

  it('Camino 4 - una fecha futura es rechazada', () => {
    const futura = new Date('2026-12-31');

    expect(() =>
      movements['resolveOccurredAt'](futura),
    ).toThrow(BadRequestException);
  });

  it('Camino 5 - una fecha pasada es válida', () => {
    const fecha = new Date('2026-08-20');

    expect(
      movements['resolveOccurredAt'](fecha),
    ).toEqual(fecha);
  });

  it('Camino 6 - si no se proporciona fecha se toma la actual', () => {
    const antes = Date.now();

    const resultado = movements['resolveOccurredAt'](undefined);

    expect(resultado.getTime()).toBeGreaterThanOrEqual(antes);
    expect(resultado.getTime()).toBeLessThanOrEqual(Date.now());
  });
});