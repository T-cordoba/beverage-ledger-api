import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { beforeEach, describe, it, vi } from 'vitest';
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
    expect(resultado, 'non-transfer resolved destination').to.be.null;
  });

  it('Camino 2 - movimiento diferente de TRANSFER con destinationLocationId', async () => {
    // Arrange
    const type = 'INBOUND';
    const locationId = 'location-1';
    const dto = { destinationLocationId: 'location-2' };

    // Act & Assert
    try {
      await service['resolveDestination'](type, locationId, dto);
      expect.fail(
        'Expected resolveDestination to throw for a non-transfer movement with destinationLocationId',
      );
    } catch (error) {
      expect(
        error,
        'non-transfer with destination error',
      ).to.be.instanceOf(BadRequestException);
    }
  });

  it('Camino 3 - TRANSFER sin destinationLocationId', async () => {
    // Arrange
    const type = 'TRANSFER';
    const locationId = 'location-1';
    const dto = {};

    // Act & Assert
    try {
      await service['resolveDestination'](type, locationId, dto);
      expect.fail(
        'Expected resolveDestination to throw when destinationLocationId is missing',
      );
    } catch (error) {
      expect(error, 'missing destination location error').to.be.instanceOf(
        BadRequestException,
      );
    }
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
    expect(resolve.mock.calls, 'resolve call arguments').to.deep.equal([
      ['location-2'],
    ]);
    expect(resultado, 'resolved destination').to.deep.equal({
      id: 'location-2',
    });
  });

  it('Camino 5 - TRANSFER con destinationLocationId igual a locationId', async () => {
    // Arrange
    const type = 'TRANSFER';
    const locationId = 'location-1';
    const dto = { destinationLocationId: 'location-1' };

    // Act & Assert
    try {
      await service['resolveDestination'](type, locationId, dto);
      expect.fail(
        'Expected resolveDestination to throw when destinationLocationId equals locationId',
      );
    } catch (error) {
      expect(error, 'destination equal to origin error').to.be.instanceOf(
        BadRequestException,
      );
    }
  });
});