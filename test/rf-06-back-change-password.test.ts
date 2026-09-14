import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditAction, AuditEntity } from '../src/modules/audit/audit.actions';
import { ProfileService } from '../src/modules/users/profile.service';

describe('ProfileService.changePassword', () => {
  let service: ProfileService;

  let findById: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let verify: ReturnType<typeof vi.fn>;
  let hash: ReturnType<typeof vi.fn>;
  let revokeAllForUser: ReturnType<typeof vi.fn>;
  let record: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findById = vi.fn();
    update = vi.fn();
    verify = vi.fn();
    hash = vi.fn().mockResolvedValue('hash-nuevo');
    revokeAllForUser = vi.fn();
    record = vi.fn();

    const users = {
      update,
    };

    const credentials = {
      findById,
    };

    const passwords = {
      verify,
      hash,
    };

    const tokens = {
      revokeAllForUser,
    };

    const audit = {
      record,
    };

    service = new ProfileService(
      users as any,
      credentials as any,
      passwords as any,
      tokens as any,
      audit as any,
      {} as any,
    );
  });

  it('Camino 1 - usuario no existe, lanza NotFoundException', async () => {
    // Arrange
    findById.mockResolvedValue(null);

    // Act
    const act = service.changePassword('00000000-0000-4000-8000-000000000000', {
      currentPassword: 'cualquiera',
      newPassword: 'NuevaSegura123!abc',
    });

    // Assert
    await expect(act).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('Camino 2 - cuenta sin contraseña, establece la primera sin pedir la actual', async () => {
    // Arrange
    findById.mockResolvedValue({ id: 'user-1', passwordHash: null });

    // Act
    await service.changePassword('user-1', { newPassword: 'NuevaSegura123!abc' });

    // Assert
    expect(verify).not.toHaveBeenCalled();
    expect(hash).toHaveBeenCalledWith('NuevaSegura123!abc');
    expect(update).toHaveBeenCalledWith('user-1', { passwordHash: 'hash-nuevo' });
    expect(revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(record).toHaveBeenCalledWith({
      action: AuditAction.UserPasswordChanged,
      entity: AuditEntity.User,
      entityId: 'user-1',
    });
  });

  it('Camino 3 - cuenta con contraseña y sin currentPassword, lanza BadRequestException', async () => {
    // Arrange
    findById.mockResolvedValue({ id: 'user-1', passwordHash: 'hash-existente' });

    // Act
    const act = service.changePassword('user-1', { newPassword: 'NuevaSegura123!abc' });

    // Assert
    await expect(act).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
    expect(revokeAllForUser).not.toHaveBeenCalled();
  });

  it('Camino 4 - currentPassword incorrecta, lanza UnauthorizedException', async () => {
    // Arrange
    findById.mockResolvedValue({ id: 'user-1', passwordHash: 'hash-existente' });
    verify.mockResolvedValue(false);

    // Act
    const act = service.changePassword('user-1', {
      currentPassword: 'contraseña-incorrecta',
      newPassword: 'NuevaSegura123!abc',
    });

    // Assert
    await expect(act).rejects.toThrow(UnauthorizedException);
    expect(update).not.toHaveBeenCalled();
    expect(revokeAllForUser).not.toHaveBeenCalled();
  });

  it('Camino 5 - currentPassword correcta, actualiza el hash y revoca las sesiones', async () => {
    // Arrange
    findById.mockResolvedValue({ id: 'user-1', passwordHash: 'hash-existente' });
    verify.mockResolvedValue(true);

    // Act
    await service.changePassword('user-1', {
      currentPassword: 'contraseña-correcta',
      newPassword: 'NuevaSegura123!abc',
    });

    // Assert
    expect(verify).toHaveBeenCalledWith('hash-existente', 'contraseña-correcta');
    expect(hash).toHaveBeenCalledWith('NuevaSegura123!abc');
    expect(update).toHaveBeenCalledWith('user-1', { passwordHash: 'hash-nuevo' });
    expect(revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(record).toHaveBeenCalledWith({
      action: AuditAction.UserPasswordChanged,
      entity: AuditEntity.User,
      entityId: 'user-1',
    });
  });
});
