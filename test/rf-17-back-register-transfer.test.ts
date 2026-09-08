import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MovementsService } from '../src/modules/inventory/movements.service';

describe('RF-17 - Registrar un traspaso', () => {
  let service: MovementsService;
  let resolve: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolve = vi.fn();

    const locations = { resolve };

    service = new MovementsService(
      {} as any,
      {} as any,
      locations as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('Camino 1 - movimiento diferente de TRANSFER sin destinationLocationId', async () => {
    // Arrange
    const type = 'INBOUND';
    const locationId = 'location-1';
    const dto = {};

    // Act
    const resultado = await service['resolveDestination'](
      type,

      locationId,
      dto,
    );

    // Assert
    expect(resultado).toBeNull();
  });

  it('Camino 2 - movimiento diferente de TRANSFER con destinationLocationId', async () => {
    // Arrange
    const type = 'INBOUND';
    const locationId = 'location-1';
    const dto = { destinationLocationId: 'location-2' };

    // Act & Assert
    await expect(
      service['resolveDestination'](type, locationId, dto),
    ).rejects.toThrow(BadRequestException);
  });

  it('Camino 3 - TRANSFER sin destinationLocationId', async () => {
    // Arrange
    const type = 'TRANSFER';
    const locationId = 'location-1';
    const dto = {};

    // Act & Assert
    await expect(
      service['resolveDestination'](type, locationId, dto),
    ).rejects.toThrow(BadRequestException);
  });


  it('Camino 4 - TRANSFER con destinationLocationId diferente', async () => {
    // Arrange
    resolve.mockResolvedValue({ id: 'location-2' });
    const type = 'TRANSFER';
    const locationId = 'location-1';
    const dto = { destinationLocationId: 'location-2' };

    // Act
    const resultado = await service['resolveDestination'](
      type,
      locationId,
      dto,
    );

    // Assert
    expect(resolve).toHaveBeenCalledWith('location-2');
    expect(resultado).toEqual({ id: 'location-2' });
  });

  it('Camino 5 - TRANSFER con destinationLocationId igual a locationId', async () => {
    // Arrange
    const type = 'TRANSFER';
    const locationId = 'location-1';
    const dto = { destinationLocationId: 'location-1' };

    // Act & Assert
    await expect(
      service['resolveDestination'](type, locationId, dto),
    ).rejects.toThrow(BadRequestException);
  });
});