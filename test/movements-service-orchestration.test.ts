import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MovementStatus,
  MovementType,
  MovementUnit,
  UserRole,
} from '../src/generated/prisma/enums';
import { MovementsService } from '../src/modules/inventory/movements.service';

/**
 * Drives the public methods, which the RF tests reach only through their private
 * helpers. Every collaborator is a double: the orchestration is what is under
 * test, not Prisma.
 */
describe('MovementsService - orquestacion', () => {
  const fakeTx = {} as any;

  let movements: Record<string, ReturnType<typeof vi.fn>>;
  let stock: Record<string, ReturnType<typeof vi.fn>>;
  let locations: Record<string, ReturnType<typeof vi.fn>>;
  let products: Record<string, ReturnType<typeof vi.fn>>;
  let audit: Record<string, ReturnType<typeof vi.fn>>;
  let tenant: { userId: string; role: UserRole };
  let service: MovementsService;

  const linea = (overrides: Record<string, unknown> = {}) => ({
    productId: 'producto-1',
    locationId: 'bodega-1',
    quantityBase: -12,
    ...overrides,
  });

  const movimiento = (overrides: Record<string, unknown> = {}) => ({
    id: 'movimiento-1',
    code: 'MOV-2026-000007',
    type: MovementType.OUTBOUND,
    status: MovementStatus.DRAFT,
    locationId: 'bodega-1',
    destinationLocationId: null,
    items: [linea()],
    ...overrides,
  });

  beforeEach(() => {
    movements = {
      findPage: vi.fn(),
      findById: vi.fn(),
      runInTransaction: vi.fn(async (cb: any) => cb(fakeTx)),
      nextSequence: vi.fn().mockResolvedValue(7),
      create: vi.fn().mockResolvedValue('movimiento-1'),
      updateDraft: vi.fn().mockResolvedValue(undefined),
      transition: vi.fn().mockResolvedValue(true),
    };
    stock = {
      findLevels: vi.fn().mockResolvedValue([]),
      ensureRows: vi.fn().mockResolvedValue(undefined),
      applyDelta: vi.fn(),
    };
    locations = { resolve: vi.fn(async (id?: string) => id ?? 'bodega-por-defecto') };
    products = {
      resolveMovementTargets: vi.fn().mockResolvedValue(
        new Map([
          ['producto-1', { name: 'Absolut Blue 750ml', brandName: 'Absolut', caseSize: 12 }],
          ['producto-2', { name: 'Johnnie Walker Red', brandName: 'Johnnie Walker', caseSize: 6 }],
        ]),
      ),
    };
    audit = { recordIn: vi.fn().mockResolvedValue(undefined) };
    tenant = { userId: 'usuario-1', role: UserRole.ORG_ADMIN };

    service = new MovementsService(
      movements as any,
      stock as any,
      locations as any,
      products as any,
      audit as any,
      tenant as any,
    );
  });

  describe('list', () => {
    it('Camino 1 - traslada los filtros al repositorio y arma la pagina', async () => {
      movements.findPage.mockResolvedValue({ rows: [movimiento()], total: 1 });

      const pagina = await service.list({
        page: 2,
        pageSize: 10,
        type: MovementType.OUTBOUND,
        search: 'absolut',
      } as any);

      expect(movements.findPage).toHaveBeenCalledWith(
        10,
        10,
        expect.objectContaining({ search: 'absolut', type: MovementType.OUTBOUND }),
      );
      expect(pagina.meta).toMatchObject({ page: 2, pageSize: 10, total: 1, pageCount: 1 });
    });
  });

  describe('findOne', () => {
    it('Camino 1 - el movimiento no existe y lanza NotFoundException', async () => {
      movements.findById.mockResolvedValue(null);

      await expect(service.findOne('movimiento-1')).rejects.toThrow(NotFoundException);
    });

    it('Camino 2 - el movimiento existe y lo devuelve', async () => {
      const esperado = movimiento();
      movements.findById.mockResolvedValue(esperado);

      await expect(service.findOne('movimiento-1')).resolves.toBe(esperado);
    });
  });

  describe('create', () => {
    it('Camino 1 - abre el borrador, numera el codigo y deja la traza de auditoria', async () => {
      movements.findById.mockResolvedValue(movimiento());

      await service.create({
        type: MovementType.OUTBOUND,
        locationId: 'bodega-1',
        occurredAt: new Date('2026-03-01T10:00:00.000Z'),
        note: 'Reposicion de barra',
        items: [{ productId: 'producto-1', unit: MovementUnit.CASE, quantity: 1 }],
      } as any);

      expect(movements.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'MOV-2026-000007',
          type: MovementType.OUTBOUND,
          locationId: 'bodega-1',
          destinationLocationId: null,
          createdByUserId: 'usuario-1',
          reason: null,
          items: [expect.objectContaining({ quantityBase: -12, locationId: 'bodega-1' })],
        }),
        fakeTx,
      );
      expect(audit.recordIn).toHaveBeenCalledOnce();
    });

    it('Camino 2 - el traspaso escribe las dos mitades, una por bodega', async () => {
      movements.findById.mockResolvedValue(movimiento({ type: MovementType.TRANSFER }));

      await service.create({
        type: MovementType.TRANSFER,
        locationId: 'bodega-1',
        destinationLocationId: 'bodega-2',
        items: [{ productId: 'producto-1', unit: MovementUnit.BOTTLE, quantity: 5 }],
      } as any);

      expect(movements.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({ locationId: 'bodega-1', quantityBase: -5 }),
            expect.objectContaining({ locationId: 'bodega-2', quantityBase: 5 }),
          ],
        }),
        fakeTx,
      );
    });

    it('Camino 3 - el rol no puede registrar ese tipo y lanza ForbiddenException', async () => {
      tenant.role = UserRole.OPERATOR;

      await expect(
        service.create({
          type: MovementType.INBOUND,
          items: [{ productId: 'producto-1', unit: MovementUnit.BOTTLE, quantity: 1 }],
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Camino 4 - el ajuste llega sin motivo y lanza BadRequestException', async () => {
      await expect(
        service.create({
          type: MovementType.ADJUSTMENT,
          reason: '   ',
          items: [{ productId: 'producto-1', unit: MovementUnit.BOTTLE, quantity: -1 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('Camino 1 - reemplaza lineas, fecha, motivo y nota del borrador', async () => {
      movements.findById.mockResolvedValue(movimiento({ type: MovementType.ADJUSTMENT }));

      await service.update('movimiento-1', {
        reason: 'Conteo fisico',
        note: 'Turno noche',
        occurredAt: new Date('2026-03-01T10:00:00.000Z'),
        items: [{ productId: 'producto-1', unit: MovementUnit.BOTTLE, quantity: -3 }],
      } as any);

      expect(movements.updateDraft).toHaveBeenCalledWith(
        'movimiento-1',
        expect.objectContaining({ reason: 'Conteo fisico', note: 'Turno noche' }),
        [expect.objectContaining({ quantityBase: -3 })],
        fakeTx,
      );
    });

    it('Camino 2 - el parche viene vacio y no toca lineas ni fecha', async () => {
      movements.findById.mockResolvedValue(movimiento());

      await service.update('movimiento-1', {} as any);

      expect(movements.updateDraft).toHaveBeenCalledWith('movimiento-1', {}, undefined, fakeTx);
    });

    it('Camino 3 - el movimiento ya esta confirmado y lanza ConflictException', async () => {
      movements.findById.mockResolvedValue(movimiento({ status: MovementStatus.CONFIRMED }));

      await expect(service.update('movimiento-1', {} as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('confirm', () => {
    it('Camino 1 - hay existencias, aplica los deltas y cierra el movimiento', async () => {
      movements.findById.mockResolvedValue(movimiento());
      stock.findLevels.mockResolvedValue([{ productId: 'producto-1', quantityBase: 24 }]);
      stock.applyDelta.mockResolvedValue(1);

      await service.confirm('movimiento-1');

      expect(stock.ensureRows).toHaveBeenCalledWith(['producto-1'], 'bodega-1', fakeTx);
      expect(stock.applyDelta).toHaveBeenCalledWith(['producto-1'], 'bodega-1', -12, fakeTx);
      expect(audit.recordIn).toHaveBeenCalledOnce();
    });

    it('Camino 2 - dos productos comparten delta y viajan en la misma sentencia', async () => {
      movements.findById.mockResolvedValue(
        movimiento({ items: [linea(), linea({ productId: 'producto-2' })] }),
      );
      stock.findLevels.mockResolvedValue([
        { productId: 'producto-1', quantityBase: 24 },
        { productId: 'producto-2', quantityBase: 24 },
      ]);
      stock.applyDelta.mockResolvedValue(2);

      await service.confirm('movimiento-1');

      expect(stock.applyDelta).toHaveBeenCalledOnce();
      expect(stock.applyDelta).toHaveBeenCalledWith(
        ['producto-1', 'producto-2'],
        'bodega-1',
        -12,
        fakeTx,
      );
    });

    it('Camino 3 - las lineas del producto se anulan entre si y no se toca el stock', async () => {
      movements.findById.mockResolvedValue(
        movimiento({
          type: MovementType.ADJUSTMENT,
          items: [linea({ quantityBase: 5 }), linea({ quantityBase: -5 })],
        }),
      );

      await service.confirm('movimiento-1');

      expect(stock.applyDelta).not.toHaveBeenCalled();
      expect(movements.transition).toHaveBeenCalledOnce();
    });

    it('Camino 4 - el stock no alcanza y lanza BadRequestException nombrando el faltante', async () => {
      movements.findById.mockResolvedValue(movimiento());
      stock.findLevels.mockResolvedValue([{ productId: 'producto-1', quantityBase: 4 }]);

      await expect(service.confirm('movimiento-1')).rejects.toThrow(
        /Not enough stock for: producto-1/,
      );
      expect(movements.transition).not.toHaveBeenCalled();
    });

    it('Camino 5 - otro lo confirmo primero y lanza ConflictException', async () => {
      movements.findById.mockResolvedValue(movimiento());
      stock.findLevels.mockResolvedValue([{ productId: 'producto-1', quantityBase: 24 }]);
      movements.transition.mockResolvedValue(false);

      await expect(service.confirm('movimiento-1')).rejects.toThrow(ConflictException);
    });

    it('Camino 6 - el stock se movio bajo la transaccion y lanza ConflictException', async () => {
      movements.findById.mockResolvedValue(movimiento());
      stock.findLevels.mockResolvedValue([{ productId: 'producto-1', quantityBase: 24 }]);
      stock.applyDelta.mockResolvedValue(0);

      await expect(service.confirm('movimiento-1')).rejects.toThrow(
        /Stock changed while the movement was being applied/,
      );
    });
  });
});
