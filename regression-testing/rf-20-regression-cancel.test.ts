import { ConflictException } from '@nestjs/common';
import { expect } from 'chai';
import { beforeEach, describe, it, vi } from 'vitest';
import { MovementStatus } from '../src/generated/prisma/enums';
import { MovementsService } from '../src/modules/inventory/movements.service';

/**
 * Builds a fresh MovementsService wired to its own mocks, so each test owns
 * its data and no state leaks between tests (FIRST: Independent).
 */
function buildService(mocks: {
  findById: ReturnType<typeof vi.fn>;
  transition: ReturnType<typeof vi.fn>;
  runInTransaction: ReturnType<typeof vi.fn>;
  findLevels: ReturnType<typeof vi.fn>;
  ensureRows: ReturnType<typeof vi.fn>;
  applyDelta: ReturnType<typeof vi.fn>;
  recordIn: ReturnType<typeof vi.fn>;
}): MovementsService {
  const movements = {
    findById: mocks.findById,
    transition: mocks.transition,
    runInTransaction: mocks.runInTransaction,
  };
  const stock = {
    findLevels: mocks.findLevels,
    ensureRows: mocks.ensureRows,
    applyDelta: mocks.applyDelta,
  };
  const audit = { recordIn: mocks.recordIn };

  return new MovementsService(
    movements as any,
    stock as any,
    {} as any,
    {} as any,
    audit as any,
    {} as any,
  );
}

describe('RF-20 regression - Cancel a confirmed movement', () => {
  const fakeTx = {} as any;
  let findById: ReturnType<typeof vi.fn>;
  let transition: ReturnType<typeof vi.fn>;
  let runInTransaction: ReturnType<typeof vi.fn>;
  let findLevels: ReturnType<typeof vi.fn>;
  let ensureRows: ReturnType<typeof vi.fn>;
  let applyDelta: ReturnType<typeof vi.fn>;
  let recordIn: ReturnType<typeof vi.fn>;
  let service: MovementsService;

  beforeEach(() => {
    findById = vi.fn();
    transition = vi.fn();
    runInTransaction = vi.fn(async (cb: any) => cb(fakeTx));
    findLevels = vi.fn();
    ensureRows = vi.fn().mockResolvedValue(undefined);
    applyDelta = vi.fn();
    recordIn = vi.fn().mockResolvedValue(undefined);

    service = buildService({
      findById,
      transition,
      runInTransaction,
      findLevels,
      ensureRows,
      applyDelta,
      recordIn,
    });
  });

  it('cancelling an already cancelled movement throws ConflictException', async () => {
    // Arrange
    findById.mockResolvedValue({
      id: 'movement-1',
      status: MovementStatus.CANCELLED,
      code: 'M-1',
      items: [],
    });

    // Act & Assert
    try {
      await service.cancel('movement-1', { reason: 'already cancelled' });
      expect.fail('Expected cancel to throw for an already cancelled movement');
    } catch (error) {
      expect(error, 'already cancelled error').to.be.instanceOf(ConflictException);
    }
    expect(applyDelta.mock.calls, 'stock reversal on an already cancelled movement').to.be.empty;
  });

  it('cancelling a confirmed +5 movement reverts the stock with a -5 delta', async () => {
    // Arrange
    findById
      .mockResolvedValueOnce({
        id: 'movement-2',
        status: MovementStatus.CONFIRMED,
        code: 'M-2',
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: 5 }],
      })
      .mockResolvedValueOnce({
        id: 'movement-2',
        status: MovementStatus.CANCELLED,
        code: 'M-2',
        items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: 5 }],
      });
    findLevels.mockResolvedValue([{ productId: 'p1', quantityBase: 10 }]);
    transition.mockResolvedValue(true);
    applyDelta.mockResolvedValue(1);

    // Act
    await service.cancel('movement-2', { reason: 'reverting a confirmed inbound' });

    // Assert
    expect(applyDelta.mock.calls, 'applyDelta call arguments').to.deep.equal([
      [['p1'], 'loc-1', -5, fakeTx],
    ]);
  });

  it('cancelling a draft movement never touches the stock', async () => {
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
    const result = await service.cancel('movement-3', { reason: 'discarding a draft' });

    // Assert
    expect(result.status, 'cancelled draft status').to.equal(MovementStatus.CANCELLED);
    expect(applyDelta.mock.calls, 'stock reversal on a draft').to.be.empty;
  });

  it('cancelling a confirmed movement whose transition is not claimed throws ConflictException', async () => {
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
      await service.cancel('movement-4', { reason: 'concurrent cancellation' });
      expect.fail('Expected cancel to throw when a confirmed movement transition is not claimed');
    } catch (error) {
      expect(error, 'unclaimed confirmed transition error').to.be.instanceOf(ConflictException);
    }
    expect(applyDelta.mock.calls, 'stock reversal on an unclaimed transition').to.be.empty;
  });
});
