import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsService } from '../src/modules/reports/reports.service';
import type { ReportsRepository } from '../src/modules/reports/repositories/reports.repository';

describe('resolveRange', () => {
  const DIA = 24 * 60 * 60 * 1000;
  const AHORA = new Date('2026-09-01T12:00:00.000Z');

  // resolveRange no consulta nada: solo normaliza las dos fechas del query.
  const nuevoServicio = () => new ReportsService({} as ReportsRepository);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Camino 1 - llegan las dos fechas y el rango se devuelve tal cual', () => {
    // Arrange
    const reports = nuevoServicio();
    const from = new Date('2026-08-01T00:00:00.000Z');
    const to = new Date('2026-08-24T00:00:00.000Z');

    // Act
    const range = reports['resolveRange']({ from, to });

    // Assert
    expect(range).toEqual({ from, to });
  });

  it('Camino 2 - llegan las dos fechas pero el rango esta invertido', () => {
    // Arrange
    const reports = nuevoServicio();
    const from = new Date('2026-08-24T00:00:00.000Z');
    const to = new Date('2026-08-01T00:00:00.000Z');

    // Act
    const resolver = () => reports['resolveRange']({ from, to });

    // Assert
    expect(resolver).toThrow(BadRequestException);
  });

  it('Camino 3 - falta la fecha inicial y se toman treinta dias antes de la final', () => {
    // Arrange
    const reports = nuevoServicio();
    const to = new Date('2026-08-24T00:00:00.000Z');

    // Act
    const range = reports['resolveRange']({ to });

    // Assert
    expect(range.to).toEqual(to);
    expect(range.from).toEqual(new Date(to.getTime() - 30 * DIA));
  });

  it('Camino 4 - falta la fecha final y se toma el instante actual', () => {
    // Arrange
    const reports = nuevoServicio();
    const from = new Date('2026-07-25T00:00:00.000Z');

    // Act
    const range = reports['resolveRange']({ from });

    // Assert
    expect(range.from).toEqual(from);
    expect(range.to).toEqual(AHORA);
  });

  it('Camino 5 - falta la fecha final y la inicial es futura, asi que el rango esta invertido', () => {
    // Arrange
    const reports = nuevoServicio();
    const from = new Date('2026-12-31T00:00:00.000Z');

    // Act
    const resolver = () => reports['resolveRange']({ from });

    // Assert
    expect(resolver).toThrow(BadRequestException);
  });

  it('Camino 6 - no llega ninguna fecha y se toman los ultimos treinta dias', () => {
    // Arrange
    const reports = nuevoServicio();

    // Act
    const range = reports['resolveRange']({});

    // Assert
    expect(range.to).toEqual(AHORA);
    expect(range.from).toEqual(new Date(AHORA.getTime() - 30 * DIA));
  });
});
