import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../src/generated/prisma/enums';
import { AuditRepository } from '../src/modules/audit/repositories/audit.repository';
import { StockService } from '../src/modules/inventory/stock.service';
import { InvitationsService } from '../src/modules/invitations/invitations.service';
import { ProfileService } from '../src/modules/users/profile.service';
import { UsersService } from '../src/modules/users/users.service';

/**
 * The read paths of the services already under coverage. They carry no Prisma of
 * their own, so a double per collaborator is enough to drive them.
 */
describe('UsersService', () => {
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let service: UsersService;

  const usuario = { id: 'usuario-1', email: 'alguien@ejemplo.com', role: UserRole.MANAGER };

  beforeEach(() => {
    users = { findPage: vi.fn(), findById: vi.fn() };
    service = new UsersService(users as any, {} as any, {} as any);
  });

  describe('list', () => {
    it('Camino 1 - salta las filas de la pagina pedida y arma la pagina', async () => {
      users.findPage.mockResolvedValue({ rows: [usuario], total: 12 });

      const pagina = await service.list({ page: 2, pageSize: 5 } as any);

      expect(users.findPage).toHaveBeenCalledWith(5, 5);
      expect(pagina.meta).toMatchObject({ page: 2, pageSize: 5, total: 12, pageCount: 3 });
      expect(pagina.data).toEqual([usuario]);
    });
  });

  describe('findOne', () => {
    it('Camino 1 - el usuario no existe y lanza NotFoundException', async () => {
      users.findById.mockResolvedValue(null);

      await expect(service.findOne('usuario-1')).rejects.toThrow(NotFoundException);
    });

    it('Camino 2 - el usuario existe y lo devuelve', async () => {
      users.findById.mockResolvedValue(usuario);

      await expect(service.findOne('usuario-1')).resolves.toBe(usuario);
    });
  });

  describe('assertAssignable', () => {
    it('Camino 1 - el rol es asignable y no lanza nada', () => {
      expect(() => service['assertAssignable'](UserRole.MANAGER)).not.toThrow();
    });

    it('Camino 2 - PLATFORM_ADMIN no se reparte y lanza BadRequestException', () => {
      expect(() => service['assertAssignable'](UserRole.PLATFORM_ADMIN)).toThrow(
        BadRequestException,
      );
    });
  });
});

describe('InvitationsService.preview', () => {
  let invitations: Record<string, ReturnType<typeof vi.fn>>;
  let service: InvitationsService;

  beforeEach(() => {
    invitations = { findRedeemableByHash: vi.fn() };
    service = new InvitationsService(invitations as any, {} as any, {} as any);
  });

  it('Camino 1 - el token no es canjeable y lanza NotFoundException', async () => {
    invitations.findRedeemableByHash.mockResolvedValue(null);

    await expect(service.preview('token-invalido')).rejects.toThrow(NotFoundException);
  });

  it('Camino 2 - el token es canjeable y devuelve solo lo publico', async () => {
    const expiresAt = new Date('2026-04-01T00:00:00.000Z');
    invitations.findRedeemableByHash.mockResolvedValue({
      id: 'invitacion-1',
      tokenHash: 'no-debe-salir',
      email: 'invitado@ejemplo.com',
      role: UserRole.OPERATOR,
      organizationName: 'Bar de prueba',
      expiresAt,
    });

    await expect(service.preview('token-valido')).resolves.toEqual({
      email: 'invitado@ejemplo.com',
      role: UserRole.OPERATOR,
      organizationName: 'Bar de prueba',
      expiresAt,
    });
  });
});

describe('StockService.list', () => {
  it('Camino 1 - resuelve la bodega y pagina las existencias de esa bodega', async () => {
    const stock = { findPage: vi.fn().mockResolvedValue({ rows: [], total: 0 }) };
    const locations = { resolve: vi.fn().mockResolvedValue('bodega-por-defecto') };
    const service = new StockService(stock as any, {} as any, locations as any, {} as any);

    const pagina = await service.list({ page: 1, pageSize: 20, search: 'absolut' } as any);

    expect(locations.resolve).toHaveBeenCalledWith(undefined);
    expect(stock.findPage).toHaveBeenCalledWith(
      0,
      20,
      'bodega-por-defecto',
      expect.objectContaining({ search: 'absolut' }),
    );
    // An empty list is still one page: "page 1 of 0" reads like a bug.
    expect(pagina.meta).toMatchObject({ total: 0, pageCount: 1, count: 0 });
  });
});

describe('AuditRepository.insert', () => {
  const fila = {
    organizationId: 'organizacion-1',
    userId: 'usuario-1',
    action: 'movement.created',
    entity: 'movement',
    entityId: 'movimiento-1',
    // undefined is what AuditMetadata allows and Prisma's JSON input rejects.
    metadata: { type: 'OUTBOUND', lines: 2, reason: undefined },
    ipAddress: null,
  };

  it('Camino 1 - sin transaccion escribe con el cliente base y limpia los undefined', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const prisma = { auditLog: { create } };
    const repository = new AuditRepository(prisma as any, {} as any);

    await repository.insert(fila as any);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'organizacion-1',
        metadata: { type: 'OUTBOUND', lines: 2 },
      }),
    });
  });

  it('Camino 2 - con transaccion escribe con ella y no con el cliente base', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const createEnTransaccion = vi.fn().mockResolvedValue(undefined);
    const repository = new AuditRepository({ auditLog: { create } } as any, {} as any);

    await repository.insert(fila as any, { auditLog: { create: createEnTransaccion } } as any);

    expect(createEnTransaccion).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('ProfileService.updateProfile', () => {
  it('Camino 1 - guarda los datos propios y devuelve el usuario ya actualizado', async () => {
    const propio = { id: 'usuario-1', email: 'alguien@ejemplo.com', role: UserRole.MANAGER };
    const update = vi.fn();
    const findOne = vi.fn().mockResolvedValue(propio);

    const service = new ProfileService(
      { update } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { findOne } as any,
    );

    const actualizado = await service.updateProfile('usuario-1', { name: 'Nombre Nuevo' });

    expect(update).toHaveBeenCalledWith('usuario-1', { name: 'Nombre Nuevo' });
    expect(findOne).toHaveBeenCalledWith('usuario-1');
    expect(actualizado).toBe(propio);
  });
});
