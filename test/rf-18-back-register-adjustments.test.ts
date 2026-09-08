import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { MovementsService } from '../src/modules/inventory/movements.service';

describe('RF-18 - Registrar un ajuste', () => {
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

  it('Camino 1 - un ajuste con cantidad cero es rechazado', () => {
    // Arrange
    const type = 'ADJUSTMENT' as any;
    const quantity = 0;

    // Act & Assert
    expect(() => service['assertQuantitySign'](type, quantity)).toThrow(
      BadRequestException,
    );
  });

  it('Camino 2 - un ajuste con cantidad diferente de cero es válido', () => {
    // Arrange
    const type = 'ADJUSTMENT' as any;
    const quantity = 10;

    // Act & Assert
    expect(() =>
      service['assertQuantitySign'](type, quantity),
    ).not.toThrow();
  });

  it('Camino 3 - un movimiento diferente de ajuste con cantidad menor o igual a cero es rechazado', () => {
    // Arrange
    const type = 'INBOUND' as any;
    const quantity = 0;

    // Act & Assert
    expect(() => service['assertQuantitySign'](type, quantity)).toThrow(
      BadRequestException,
    );
  });

  it('Camino 4 - un movimiento diferente de ajuste con cantidad positiva es válido', () => {
    // Arrange
    const type = 'INBOUND' as any;
    const quantity = 10;

    // Act & Assert
    expect(() =>
      service['assertQuantitySign'](type, quantity),
    ).not.toThrow();
  });
});