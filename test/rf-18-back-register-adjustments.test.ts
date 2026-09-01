
import { BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { MovementsService } from '../src/modules/inventory/movements.service';

describe('RF-18 - Registrar un ajuste', () => {
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

  it('Camino 1 - un ajuste con cantidad cero es rechazado', () => {
    expect(() =>
      movements['assertQuantitySign']('ADJUSTMENT' as any, 0),
    ).toThrow(BadRequestException);
  });

  it('Camino 2 - un ajuste con cantidad diferente de cero es válido', () => {
    expect(() =>
      movements['assertQuantitySign']('ADJUSTMENT' as any, 10),
    ).not.toThrow();
  });

  it('Camino 3 - un movimiento diferente de ajuste con cantidad menor o igual a cero es rechazado', () => {
    expect(() =>
      movements['assertQuantitySign']('INBOUND' as any, 0),
    ).toThrow(BadRequestException);
  });

  it('Camino 4 - un movimiento diferente de ajuste con cantidad positiva es válido', () => {
    expect(() =>
      movements['assertQuantitySign']('INBOUND' as any, 10),
    ).not.toThrow();
  });
});
