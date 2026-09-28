import { ConflictException } from '@nestjs/common';
import { expect } from 'chai';
import { beforeEach, describe, it, vi } from 'vitest';
import { MovementStatus } from '../src/generated/prisma/enums';
import { MovementsService } from '../src/modules/inventory/movements.service';

describe('RF-20 - Anular un movimiento confirmado', () => {
  let service: MovementsService;
  let findById: ReturnType<typeof vi.fn>;
  let transition: ReturnType<typeof vi.fn>;
  let runInTransaction: ReturnType<typeof vi.fn>;
  let findLevels: ReturnType<typeof vi.fn>;
  let ensureRows: ReturnType<typeof vi.fn>;
  let applyDelta: ReturnType<typeof vi.fn>;
  let recordIn: ReturnType<typeof vi.fn>;

  const fakeTx = {} as any;

  beforeEach(() => {
    findById = vi.fn();
    transition = vi.fn();
    runInTransaction = vi.fn(async (cb: any) => cb(fakeTx));
    findLevels = vi.fn();
    ensureRows = vi.fn().mockResolvedValue(undefined);
    applyDelta = vi.fn();
    recordIn = vi.fn().mockResolvedValue(undefined);

    const movements = { findById, transition, runInTransaction };
    const stock = { findLevels, ensureRows, applyDelta };
    const audit = { recordIn };

    service = new MovementsService(
      movements as any,
      stock as any,
      {} as any,
      {} as any,
      audit as any,
      {} as any,
    );
  });

  it('Camino 1 - movimiento ya cancelado', async () => {
    // Arrange
    findById.mockResolvedValue({
      id: 'movement-1',
      status: MovementStatus.CANCELLED,
      code: 'M-1',
      items: [],
    });

    // Act & Assert
    try {
      await service.cancel('movement-1', { reason: 'ya está cancelado' });
      expect.fail(
        'Expected cancel to throw for an already cancelled movement',
      );
    } catch (error) {
      expect(error, 'already cancelled error').to.be.instanceOf(
        ConflictException,
      );
    }
    expect(transition.mock.calls, 'transition calls').to.be.empty;
  });

  it('Camino 2 - movimiento no confirmado y transición no reclamada', async () => {
    // Arrange
    findById.mockResolvedValue({
      id: 'movement-2',
      status: MovementStatus.DRAFT,
      code: 'M-2',
      items: [],
    });
    transition.mockResolvedValue(false);

    // Act & Assert
    try {
      await service.cancel('movement-2', { reason: 'conflicto' });
      expect.fail(
        'Expected cancel to throw when the transition is not claimed',
      );
    } catch (error) {
      expect(error, 'unclaimed transition error').to.be.instanceOf(
        ConflictException,
      );
    }
    expect(findLevels.mock.calls, 'findLevels calls').to.be.empty;
  });

  it('Camino 3 - movimiento no confirmado y transición reclamada', async () => {
    // Arrange
    findById
      .mockResolvedValueOnce({
        id: 'movement-3',
        status: MovementStatus.DRAFT,
        code: 'M-3',
        items: [],
      })
      .mockResolvedValueOnce({
        id: 'movement-3',
        status: MovementStatus.CANCELLED,
        code: 'M-3',
        items: [],
      });
    transition.mockResolvedValue(true);

    // Act
    const result = await service.cancel('movement-3', { reason: 'ok' });

    // Assert
    expect(result.status, 'movement status').to.equal(
      MovementStatus.CANCELLED,
    );
    expect(applyDelta.mock.calls, 'stock reversal').to.be.empty;
    expect(recordIn.mock.calls.length, 'recordIn call count').to.equal(1);
    const [recordInTx, recordInPayload] = recordIn.mock.calls[0];
    expect(recordInTx, 'audit transaction').to.equal(fakeTx);
    expect(
      recordInPayload.metadata.stockReverted,
      'stock reverted flag',
    ).to.equal(false);
  });

  it('Camino 4 - movimiento confirmado y transición no reclamada', async () => {
    // Arrange
    findById.mockResolvedValue({
      id: 'movement-4',
      status: MovementStatus.CONFIRMED,
      code: 'M-4',
      items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: 10 }],
    });
    findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 20 }]);
    transition.mockResolvedValue(false);

    // Act & Assert
    try {
      await service.cancel('movement-4', { reason: 'conflicto' });
      expect.fail(
        'Expected cancel to throw when a confirmed movement transition is not claimed',
      );
    } catch (error) {
      expect(error, 'unclaimed confirmed transition error').to.be.instanceOf(
        ConflictException,
      );
    }
    expect(applyDelta.mock.calls, 'stock reversal').to.be.empty;
  });

  it('Camino 5 - movimiento confirmado y transición reclamada', async () => {
    // Arrange
    findById
      .mockResolvedValueOnce({
        id: 'movement-5',
        status: MovementStatus.CONFIRMED,
        code: 'M-5',
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: 5 }],
      })
      .mockResolvedValueOnce({
        id: 'movement-5',
        status: MovementStatus.CANCELLED,
        code: 'M-5',
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: 5 }],
      });
    findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 10 }]);
    transition.mockResolvedValue(true);
    applyDelta.mockResolvedValue(1);

    // Act
    const result = await service.cancel('movement-5', { reason: 'ok' });

    // Assert
    expect(result.status, 'movement status').to.equal(
      MovementStatus.CANCELLED,
    );
  });

  it('Camino 6 - movimiento confirmado, se revierten los cambios y se registra la anulación', async () => {
    // Arrange
    findById.mockResolvedValue({
      id: 'movement-6',
      status: MovementStatus.CONFIRMED,
      code: 'M-6',
      items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: 5 }],
    });
    findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 10 }]);
    transition.mockResolvedValue(true);
    applyDelta.mockResolvedValue(1);

    // Act
    await service.cancel('movement-6', { reason: 'anulación de prueba' });

    // Assert
    expect(ensureRows.mock.calls, 'ensureRows call arguments').to.deep.equal([
      [['p1'], 'loc-1', fakeTx],
    ]);
    expect(applyDelta.mock.calls, 'applyDelta call arguments').to.deep.equal([
      [['p1'], 'loc-1', -5, fakeTx],
    ]);
    expect(recordIn.mock.calls.length, 'recordIn call count').to.equal(1);
    const [recordInTx, recordInPayload] = recordIn.mock.calls[0];
    expect(recordInTx, 'audit transaction').to.equal(fakeTx);
    expect(recordInPayload.entityId, 'audit entity id').to.equal(
      'movement-6',
    );
    expect(
      recordInPayload.metadata.stockReverted,
      'stock reverted flag',
    ).to.equal(true);
    expect(recordInPayload.metadata.reason, 'cancellation reason').to.equal(
      'anulación de prueba',
    );
  });
});