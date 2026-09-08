import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    await expect(
      service.cancel('movement-1', { reason: 'ya está cancelado' }),
    ).rejects.toThrow(ConflictException);
    expect(transition).not.toHaveBeenCalled();
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
    await expect(
      service.cancel('movement-2', { reason: 'conflicto' }),
    ).rejects.toThrow(ConflictException);
    expect(findLevels).not.toHaveBeenCalled();
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
    expect(result.status).toBe(MovementStatus.CANCELLED);
    expect(applyDelta).not.toHaveBeenCalled();
    expect(recordIn).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({
        metadata: expect.objectContaining({ stockReverted: false }),
      }),
    );
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
    await expect(
      service.cancel('movement-4', { reason: 'conflicto' }),
    ).rejects.toThrow(ConflictException);
    expect(applyDelta).not.toHaveBeenCalled();
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
    expect(result.status).toBe(MovementStatus.CANCELLED);
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
    expect(ensureRows).toHaveBeenCalledWith(['p1'], 'loc-1', fakeTx);
    expect(applyDelta).toHaveBeenCalledWith(['p1'], 'loc-1', -5, fakeTx);
    expect(recordIn).toHaveBeenCalledWith(
      fakeTx,
      expect.objectContaining({
        entityId: 'movement-6',
        metadata: expect.objectContaining({
          stockReverted: true,
          reason: 'anulación de prueba',
        }),
      }),
    );
  });
});