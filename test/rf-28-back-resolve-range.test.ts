import { BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { ReportsService } from '../src/modules/reports/reports.service';

/**
 * RF-28 - BACK - resolveRange(query)
 * Un test por cada camino de la tabla de docs/testing/RF-28-reporte-consumo.md.
 * El service sale del contenedor de Nest, que es de donde sale en produccion.
 * resolveRange es privado, asi que se llama con corchetes.
 */
describe('resolveRange', () => {
  let app: INestApplicationContext;
  let reports: ReportsService;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    reports = app.get(ReportsService);
  });

  afterAll(async () => {
    await app.close();
  });

  const DIA = 24 * 60 * 60 * 1000;

  it('Camino 1 - llegan las dos fechas y el rango se devuelve tal cual', () => {
    const from = new Date('2026-08-01');
    const to = new Date('2026-08-24');

    expect(reports['resolveRange']({ from, to })).toEqual({ from, to });
  });

  it('Camino 2 - llegan las dos fechas pero el rango esta invertido', () => {
    const from = new Date('2026-08-24');
    const to = new Date('2026-08-01');

    expect(() => reports['resolveRange']({ from, to })).toThrow(BadRequestException);
  });

  it('Camino 3 - falta la fecha inicial y se toman treinta dias antes de la final', () => {
    const to = new Date('2026-08-24');

    const range = reports['resolveRange']({ to });

    expect(range.to).toEqual(to);
    expect(to.getTime() - range.from.getTime()).toBe(30 * DIA);
  });

  it('Camino 4 - falta la fecha final y se toma el instante actual', () => {
    const from = new Date('2026-07-25');

    const range = reports['resolveRange']({ from });

    expect(range.from).toEqual(from);
    expect(range.to.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('Camino 5 - falta la fecha final y la inicial es futura, asi que el rango esta invertido', () => {
    const from = new Date('2026-12-31');

    expect(() => reports['resolveRange']({ from })).toThrow(BadRequestException);
  });

  it('Camino 6 - no llega ninguna fecha y se toman los ultimos treinta dias', () => {
    const range = reports['resolveRange']({});

    expect(range.to.getTime() - range.from.getTime()).toBe(30 * DIA);
  });
});
