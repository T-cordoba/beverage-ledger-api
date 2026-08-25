import { BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { MovementsService } from '../src/modules/inventory/movements.service';

describe('RF-15 - Registrar una salida', () => {
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

  it('Camino 1 - una salida con cantidad positiva es válida', () => {
    expect(() =>
      movements['assertQuantitySign']('OUTBOUND' as any, 6),
    ).not.toThrow();
  });

  it('Camino 2 - una salida con cantidad cero es rechazada', () => {
    expect(() =>
      movements['assertQuantitySign']('OUTBOUND' as any, 0),
    ).toThrow(BadRequestException);
  });

  it('Camino 3 - una salida con cantidad negativa es rechazada', () => {
    expect(() =>
      movements['assertQuantitySign']('OUTBOUND' as any, -6),
    ).toThrow(BadRequestException);
  });
});