import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MovementsService } from '../src/modules/inventory/movements.service';
import type { LocationsService } from '../src/modules/inventory/locations.service';
import type { MovementsRepository } from '../src/modules/inventory/repositories/movements.repository';
import type { StockRepository } from '../src/modules/inventory/repositories/stock.repository';
import type { ProductsService } from '../src/modules/catalog/products.service';
import type { AuditService } from '../src/modules/audit/audit.service';
import type { TenantContextService } from '../src/common/tenant/tenant-context.service';

describe('resolveOccurredAt', () => {
  const AHORA = new Date('2026-09-01T12:00:00.000Z');

  const nuevoServicio = () =>
    new MovementsService(
      {} as MovementsRepository,
      {} as StockRepository,
      {} as LocationsService,
      {} as ProductsService,
      {} as AuditService,
      {} as TenantContextService,
    );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Camino 1 - llega una fecha pasada y se devuelve tal cual', () => {
    const movements = nuevoServicio();
    const fecha = new Date('2026-08-20T00:00:00.000Z');

    const resuelta = movements['resolveOccurredAt'](fecha);

    expect(resuelta).toEqual(fecha);
  });

  it('Camino 2 - llega una fecha futura y se rechaza', () => {
    const movements = nuevoServicio();
    const futura = new Date('2026-12-31T00:00:00.000Z');

    const resolver = () => movements['resolveOccurredAt'](futura);

    expect(resolver).toThrow(BadRequestException);
  });

  it('Camino 3 - no llega fecha y se toma el instante actual', () => {
    const movements = nuevoServicio();

    const resuelta = movements['resolveOccurredAt'](undefined);

    expect(resuelta).toEqual(AHORA);
  });
});
