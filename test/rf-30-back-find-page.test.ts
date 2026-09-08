
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditRepository } from '../src/modules/audit/repositories/audit.repository';

describe('AuditRepository.findPage', () => {
  let audit: AuditRepository;

  let findMany: ReturnType<typeof vi.fn>;
  let count: ReturnType<typeof vi.fn>;
  let transaction: ReturnType<typeof vi.fn>;
  let scopedWhere: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findMany = vi.fn();
    count = vi.fn();
    transaction = vi.fn();
    scopedWhere = vi.fn();

    const prisma = {
      auditLog: {
        findMany,
        count,
      },
      $transaction: transaction,
    };

    const tenant = {};

    audit = new AuditRepository(
      prisma as any,
      tenant as any,
    );

    vi.spyOn(audit as any, 'scopedWhere').mockImplementation(
      scopedWhere,
    );

    scopedWhere.mockImplementation((where: unknown) => where);
  });

  it('Camino 1 - sin filtros, retorna resultados paginados', async () => {
    // Arrange
    const rows = [{ id: 'audit-1' }];

    transaction.mockResolvedValue([rows, 1]);

    // Act
    const result = await audit.findPage(0, 10, {});

    // Assert
    expect(result).toEqual({
      rows,
      total: 1,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
      }),
    );
    expect(count).toHaveBeenCalled();
  });

  it('Camino 2 - filtrado por entidad', async () => {
    // Arrange
    const rows = [{ id: 'audit-1', entity: 'product' }];

    transaction.mockResolvedValue([rows, 1]);

    // Act
    const result = await audit.findPage(
      0,
      10,
      { entity: 'product' },
    );

    // Assert
    expect(result.rows).toEqual(rows);
    expect(result.total).toBe(1);

    expect(scopedWhere).toHaveBeenCalledWith({
      entity: 'product',
    });
  });

  it('Camino 3 - filtrado por entityId', async () => {
    // Arrange
    transaction.mockResolvedValue([[], 0]);

    // Act
    const result = await audit.findPage(
      0,
      10,
      { entityId: 'uuid-inexistente' },
    );

    // Assert
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);

    expect(scopedWhere).toHaveBeenCalledWith({
      entityId: 'uuid-inexistente',
    });
  });

  it('Camino 4 - filtrado por accion', async () => {
    // Arrange
    const rows = [{ id: 'audit-1', action: 'product.created' }];

    transaction.mockResolvedValue([rows, 1]);

    // Act
    const result = await audit.findPage(
      0,
      10,
      { action: 'product.created' },
    );

    // Assert
    expect(result.rows).toEqual(rows);
    expect(result.total).toBe(1);

    expect(scopedWhere).toHaveBeenCalledWith({
      action: 'product.created',
    });
  });

  it('Camino 5 - filtrado por usuario', async () => {
    // Arrange
    const rows = [{ id: 'audit-1', userId: 'user-1' }];

    transaction.mockResolvedValue([rows, 1]);

    // Act
    const result = await audit.findPage(
      0,
      10,
      { userId: 'user-1' },
    );

    // Assert
    expect(result.rows).toEqual(rows);
    expect(result.total).toBe(1);

    expect(scopedWhere).toHaveBeenCalledWith({
      userId: 'user-1',
    });
  });

  it('Camino 6 - filtrado por rango de fecha completo (from y to)', async () => {
    // Arrange
    const from = new Date('2026-08-01');
    const to = new Date('2026-08-31');

    transaction.mockResolvedValue([[{ id: 'audit-1' }], 1]);

    // Act
    const result = await audit.findPage(
      0,
      10,
      { from, to },
    );

    // Assert
    expect(result.total).toBe(1);

    expect(scopedWhere).toHaveBeenCalledWith({
      createdAt: {
        gte: from,
        lte: to,
      },
    });
  });

  it('Camino 7 - filtrado solo por fecha desde (gte)', async () => {
    // Arrange
    const from = new Date('2026-08-01');

    transaction.mockResolvedValue([[{ id: 'audit-1' }], 1]);

    // Act
    const result = await audit.findPage(
      0,
      10,
      { from },
    );

    // Assert
    expect(result.total).toBe(1);

    expect(scopedWhere).toHaveBeenCalledWith({
      createdAt: {
        gte: from,
      },
    });
  });

  it('Camino 8 - filtrado solo por fecha hasta (lte)', async () => {
    // Arrange
    const to = new Date('2026-08-31');

    transaction.mockResolvedValue([[{ id: 'audit-1' }], 1]);

    // Act
    const result = await audit.findPage(
      0,
      10,
      { to },
    );

    // Assert
    expect(result.total).toBe(1);

    expect(scopedWhere).toHaveBeenCalledWith({
      createdAt: {
        lte: to,
      },
    });
  });
});
