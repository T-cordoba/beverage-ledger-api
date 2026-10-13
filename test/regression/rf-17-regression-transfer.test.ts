import { BadRequestException } from '@nestjs/common';
import { expect } from 'chai';
import { beforeEach, describe, it, vi } from 'vitest';
import { MovementsService } from '../../src/modules/inventory/movements.service';

describe('RF-17 Regression - Register a transfer', () => {
  let service: MovementsService;
  let resolveLocation: ReturnType<typeof vi.fn>;
  let resolveMovementTargets: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolveLocation = vi.fn();
    resolveMovementTargets = vi.fn();

    const locations = { resolve: resolveLocation };
    const products = { resolveMovementTargets };

    service = new MovementsService(
      {} as any,
      {} as any,
      locations as any,
      products as any,
      {} as any,
      {} as any,
    );
  });

  it('resolves a different warehouse as the transfer destination', async () => {
    // Arrange
    resolveLocation.mockResolvedValue({ id: 'warehouse-2' });
    const type = 'TRANSFER';
    const originLocationId = 'warehouse-1';
    const dto = { destinationLocationId: 'warehouse-2' };

    // Act
    const destination = await service['resolveDestination'](type, originLocationId, dto);

    // Assert
    expect(destination, 'resolved transfer destination').to.deep.equal({
      id: 'warehouse-2',
    });
  });

  it('rejects a transfer with no destination location', async () => {
    // Arrange
    const type = 'TRANSFER';
    const originLocationId = 'warehouse-1';
    const dto = {};

    // Act & Assert
    try {
      await service['resolveDestination'](type, originLocationId, dto);
      expect.fail('Expected resolveDestination to throw when destinationLocationId is missing');
    } catch (error) {
      expect(error, 'missing destination location error').to.be.instanceOf(BadRequestException);
    }
  });

  it('rejects a transfer whose destination equals its origin', async () => {
    // Arrange
    const type = 'TRANSFER';
    const originLocationId = 'warehouse-1';
    const dto = { destinationLocationId: 'warehouse-1' };

    // Act & Assert
    try {
      await service['resolveDestination'](type, originLocationId, dto);
      expect.fail('Expected resolveDestination to throw when destination equals origin');
    } catch (error) {
      expect(error, 'destination equal to origin error').to.be.instanceOf(BadRequestException);
    }
  });

  it('splits a 6-bottle transfer into a balanced origin/destination pair', async () => {
    // Arrange
    resolveMovementTargets.mockResolvedValue(
      new Map([
        [
          'product-1',
          { id: 'product-1', name: 'Havana Club 7', caseSize: 12, isActive: true, brandName: 'Havana Club' },
        ],
      ]),
    );
    const type = 'TRANSFER';
    const originLocationId = 'warehouse-1';
    const destinationLocationId = 'warehouse-2';
    const lines = [{ productId: 'product-1', quantity: 6, unit: 'BOTTLE' }];

    // Act
    const result = await service['toLines'](type, originLocationId, destinationLocationId, lines);

    // Assert
    expect(result, 'transfer line count').to.have.lengthOf(2);

    const originLine = result.find((line: any) => line.locationId === originLocationId);
    const destinationLine = result.find((line: any) => line.locationId === destinationLocationId);

    expect(originLine, 'origin line').to.exist;
    expect(destinationLine, 'destination line').to.exist;
    expect(originLine.quantityBase, 'origin quantity base').to.equal(-6);
    expect(destinationLine.quantityBase, 'destination quantity base').to.equal(6);

    const total = result.reduce((sum: number, line: any) => sum + line.quantityBase, 0);
    expect(total, 'net quantity base across both halves').to.equal(0);
  });
});
