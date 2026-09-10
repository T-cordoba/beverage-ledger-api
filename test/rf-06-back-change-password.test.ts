import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/modules/users/users.service';

describe('UsersService.changePassword', () => {
  let app: INestApplicationContext;
  let users: UsersService;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    users = app.get(UsersService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Camino 1 - usuario no existe, lanza NotFoundException', async () => {
    // Arrange
    vi.spyOn((users as any).credentials, 'findById').mockResolvedValue(null);

    // Act & Assert
    await expect(
      users.changePassword('00000000-0000-4000-8000-000000000000', {
        currentPassword: 'cualquiera',
        newPassword: 'NuevaSegura123!abc',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('Camino 2 - usuario sin passwordHash, establece contraseña directamente', async () => {
    // Arrange
    vi.spyOn((users as any).credentials, 'findById').mockResolvedValue({
      id: 'user-1',
      passwordHash: null,
    });
    vi.spyOn((users as any).passwords, 'hash').mockResolvedValue('hash-nuevo');
    vi.spyOn((users as any).users, 'update').mockResolvedValue(undefined);
    vi.spyOn((users as any).tokens, 'revokeAllForUser').mockResolvedValue(undefined);
    vi.spyOn((users as any).audit, 'record').mockResolvedValue(undefined);

    // Act & Assert — should not throw
    await expect(
      users.changePassword('user-1', {
        newPassword: 'NuevaSegura123!abc',
      }),
    ).resolves.toBeUndefined();

    expect((users as any).passwords.hash).toHaveBeenCalledWith('NuevaSegura123!abc');
    expect((users as any).users.update).toHaveBeenCalledWith('user-1', { passwordHash: 'hash-nuevo' });
    expect((users as any).tokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('Camino 3 - tiene passwordHash pero no envia currentPassword, lanza BadRequestException', async () => {
    // Arrange
    vi.spyOn((users as any).credentials, 'findById').mockResolvedValue({
      id: 'user-1',
      passwordHash: 'hash-existente',
    });

    // Act & Assert
    await expect(
      users.changePassword('user-1', {
        newPassword: 'NuevaSegura123!abc',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Camino 4 - currentPassword incorrecta, lanza UnauthorizedException', async () => {
    // Arrange
    vi.spyOn((users as any).credentials, 'findById').mockResolvedValue({
      id: 'user-1',
      passwordHash: 'hash-existente',
    });
    vi.spyOn((users as any).passwords, 'verify').mockResolvedValue(false);

    // Act & Assert
    await expect(
      users.changePassword('user-1', {
        currentPassword: 'contraseña-incorrecta',
        newPassword: 'NuevaSegura123!abc',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('Camino 5 - currentPassword correcta, actualiza hash y revoca tokens', async () => {
    // Arrange
    vi.spyOn((users as any).credentials, 'findById').mockResolvedValue({
      id: 'user-1',
      passwordHash: 'hash-existente',
    });
    vi.spyOn((users as any).passwords, 'verify').mockResolvedValue(true);
    vi.spyOn((users as any).passwords, 'hash').mockResolvedValue('hash-nuevo');
    vi.spyOn((users as any).users, 'update').mockResolvedValue(undefined);
    vi.spyOn((users as any).tokens, 'revokeAllForUser').mockResolvedValue(undefined);
    vi.spyOn((users as any).audit, 'record').mockResolvedValue(undefined);

    // Act & Assert — should not throw
    await expect(
      users.changePassword('user-1', {
        currentPassword: 'contraseña-correcta',
        newPassword: 'NuevaSegura123!abc',
      }),
    ).resolves.toBeUndefined();

    expect((users as any).passwords.verify).toHaveBeenCalledWith('hash-existente', 'contraseña-correcta');
    expect((users as any).passwords.hash).toHaveBeenCalledWith('NuevaSegura123!abc');
    expect((users as any).users.update).toHaveBeenCalledWith('user-1', { passwordHash: 'hash-nuevo' });
    expect((users as any).tokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
  });
});
