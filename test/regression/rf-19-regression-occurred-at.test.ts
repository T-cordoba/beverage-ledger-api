import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { MovementsService } from '../../src/modules/inventory/movements.service';
import type { AuditService } from '../../src/modules/audit/audit.service';
import type { ProductsService } from '../../src/modules/catalog/products.service';
import type { TenantContextService } from '../../src/common/tenant/tenant-context.service';
import type { LocationsService } from '../../src/modules/inventory/locations.service';
import type { MovementsRepository } from '../../src/modules/inventory/repositories/movements.repository';
import type { StockRepository } from '../../src/modules/inventory/repositories/stock.repository';

const now = new Date('2026-09-01T12:00:00.000Z');

const buildService = () =>
  new MovementsService(
    {} as MovementsRepository,
    {} as StockRepository,
    {} as LocationsService,
    {} as ProductsService,
    {} as AuditService,
    {} as TenantContextService,
  );

describe('RF-19 regression - date of a saved draft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('the current instant itself is accepted, not treated as the future', () => {
    const service = buildService();
    const exactlyNow = new Date(now);

    const resolve = () => service['resolveOccurredAt'](exactlyNow);

    expect(resolve, 'dating the movement now').to.not.throw();
    expect(resolve(), 'resolved date').to.equal(exactlyNow);
  });

  it('a single millisecond into the future is rejected with a readable reason', () => {
    const service = buildService();
    const justAhead = new Date(now.getTime() + 1);

    const resolve = () => service['resolveOccurredAt'](justAhead);

    expect(resolve, 'dating the movement ahead')
      .to.throw(BadRequestException, 'A movement cannot be dated in the future')
      .with.nested.property('response.statusCode', 400);
  });

  it('a back-dated count from last year is still accepted', () => {
    const service = buildService();
    const lastYear = new Date('2025-12-31T23:59:59.000Z');

    const resolved = service['resolveOccurredAt'](lastYear);

    expect(resolved.getTime(), 'resolved instant').to.be.below(now.getTime());
    expect(resolved, 'resolved date').to.equal(lastYear);
  });

  it('a draft saved without a date is stamped at the moment it is captured', () => {
    const service = buildService();

    const resolved = service['resolveOccurredAt'](undefined);

    expect(resolved, 'resolved date').to.be.an.instanceOf(Date).and.deep.equal(now);
  });
});
