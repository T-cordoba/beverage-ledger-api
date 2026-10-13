import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { beforeEach, describe, it } from 'vitest';
import { MovementsService } from '../../src/modules/inventory/movements.service';

describe('RF-18 Regression - Register an adjustment', () => {
  let service: MovementsService;

  beforeEach(() => {
    service = new MovementsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('rejects an adjustment with a zero quantity', () => {
    // Arrange
    const type = 'ADJUSTMENT' as any;
    const quantity = 0;

    // Act & Assert
    expect(
      () => service['assertQuantitySign'](type, quantity),
      'zero adjustment quantity',
    ).to.throw(BadRequestException);
  });

  it('accepts an adjustment with a positive quantity', () => {
    // Arrange
    const type = 'ADJUSTMENT' as any;
    const quantity = 10;

    // Act & Assert
    expect(
      () => service['assertQuantitySign'](type, quantity),
      'positive adjustment quantity',
    ).to.not.throw();
  });

  it('accepts an adjustment with a negative quantity', () => {
    // Arrange
    const type = 'ADJUSTMENT' as any;
    const quantity = -10;

    // Act & Assert
    expect(
      () => service['assertQuantitySign'](type, quantity),
      'negative adjustment quantity',
    ).to.not.throw();
  });

  it('rejects an adjustment with no reason', () => {
    // Arrange
    const type = 'ADJUSTMENT' as any;
    const reason = undefined;

    // Act & Assert
    expect(
      () => service['assertReason'](type, reason),
      'missing adjustment reason',
    ).to.throw(BadRequestException);
  });

  it('rejects an adjustment with a blank reason', () => {
    // Arrange
    const type = 'ADJUSTMENT' as any;
    const reason = '   ';

    // Act & Assert
    expect(
      () => service['assertReason'](type, reason),
      'blank adjustment reason',
    ).to.throw(BadRequestException);
  });
});
