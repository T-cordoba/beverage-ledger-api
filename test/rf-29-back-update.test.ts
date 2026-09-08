import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersService } from '../src/modules/users/users.service';
import { UserRole, UserStatus } from '../src/generated/prisma/enums';

describe('UsersService.update', () => {
  let service: UsersService;

  let findById: ReturnType<typeof vi.fn>;
  let countAdmins: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let revokeAllForUser: ReturnType<typeof vi.fn>;
  let record: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findById = vi.fn();
    countAdmins = vi.fn();
    update = vi.fn();
    revokeAllForUser = vi.fn();
    record = vi.fn();

    const users = {
      findById,
      countAdmins,
      update,
    };

    const credentials = {};
    const passwords = {};
    
    const tokens = {
      revokeAllForUser,
    };

    const audit = {
      record,
    };

    service = new UsersService(
      users as any,
      credentials as any,
      passwords as any,
      tokens as any,
      audit as any,
    );
  });

  it('Camino 1 - usuario no encontrado, lanza NotFoundException', async () => {
    // Arrange
    findById.mockResolvedValue(null);

    // Act & Assert
    await expect(
      service.update(
        'admin-1',
        '00000000-0000-4000-8000-000000000000',
        { name: 'Test' },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('Camino 2 - actor modifica su propia autoridad con rol, lanza BadRequestException', async () => {
    // Arrange
    findById.mockResolvedValue({
      id: 'admin-1',
      role: UserRole.ORG_ADMIN,
      status: UserStatus.ACTIVE,
    });

    // Act & Assert
    await expect(
      service.update(
        'admin-1',
        'admin-1',
        { role: UserRole.OPERATOR },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('Camino 3 - actor modifica su propio estado, lanza BadRequestException', async () => {
    // Arrange
    findById.mockResolvedValue({
      id: 'admin-1',
      role: UserRole.ORG_ADMIN,
      status: UserStatus.ACTIVE,
    });

    // Act & Assert
    await expect(
      service.update(
        'admin-1',
        'admin-1',
        { status: UserStatus.SUSPENDED },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('Camino 4 - degradar al último administrador activo, lanza BadRequestException', async () => {
    // Arrange
    findById.mockResolvedValue({
      id: 'admin-1',
      role: UserRole.ORG_ADMIN,
      status: UserStatus.ACTIVE,
    });

    countAdmins.mockResolvedValue(1);

    // Act & Assert
    await expect(
      service.update(
        'otro-actor',
        'admin-1',
        { role: UserRole.OPERATOR },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(countAdmins).toHaveBeenCalledTimes(1);
  });

  it('Camino 5 - actualizar usuario con suspensión, revoca sesiones', async () => {
    // Arrange
    findById
      .mockResolvedValueOnce({
        id: 'user-1',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        role: UserRole.OPERATOR,
        status: UserStatus.SUSPENDED,
        name: 'Usuario Actualizado',
      });

    const dto = {
      name: 'Usuario Actualizado',
      status: UserStatus.SUSPENDED,
    };

    // Act
    const resultado = await service.update('admin-1', 'user-1', dto);

    // Assert
    expect(update).toHaveBeenCalledWith('user-1', dto);
    expect(revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(record).toHaveBeenCalled();
    expect(resultado.name).toBe('Usuario Actualizado');
  });

  it('Camino 6 - actualizar solo el nombre, sin cambio de autoridad', async () => {
    // Arrange
    findById
      .mockResolvedValueOnce({
        id: 'user-1',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
        name: 'Usuario',
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
        name: 'Solo Nombre',
      });

    const dto = {
      name: 'Solo Nombre',
    };

    // Act
    const resultado = await service.update('admin-1', 'user-1', dto);

    // Assert
    expect(update).toHaveBeenCalledWith('user-1', dto);
    expect(revokeAllForUser).not.toHaveBeenCalled();
    expect(resultado.name).toBe('Solo Nombre');
  });
});