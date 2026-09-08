
import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service';
import { UserStatus } from '../src/generated/prisma/enums';

describe('validateCredentials', () => {
  let auth: AuthService;
  let findByEmail: ReturnType<typeof vi.fn>;
  let verify: ReturnType<typeof vi.fn>;
  let verifyDecoy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findByEmail = vi.fn();
    verify = vi.fn();
    verifyDecoy = vi.fn();

    auth = new AuthService(
      {
        findByEmail,
        markLoginSucceeded: vi.fn(),
        markLoginFailed: vi.fn(),
      } as any,
      {
        verify,
        verifyDecoy,
      } as any,
      {} as any,
      {
        record: vi.fn(),
      } as any,
      {
        get: vi.fn().mockReturnValue({
          maxAttempts: 5,
          lockoutMinutes: 15,
        }),
      } as any,
    );
  });

  it('Camino 1 - usuario no existe, lanza UnauthorizedException', async () => {
    // Arrange
    findByEmail.mockResolvedValue(null);

    // Act
    const resultado = auth.validateCredentials(
      'no-existe-jamas@ejemplo.com',
      'cualquier-clave',
    );

    // Assert
    await expect(resultado).rejects.toThrow(UnauthorizedException);
    expect(verifyDecoy).toHaveBeenCalledWith('cualquier-clave');
  });

  it('Camino 2 - usuario existe sin hash de contraseña, lanza UnauthorizedException', async () => {
    // Arrange
    findByEmail.mockResolvedValue({
      id: 'user-2',
      email: 'usuario@example.com',
      passwordHash: null,
      lockedUntil: null,
      failedLoginAttempts: 0,
      status: UserStatus.ACTIVE,
    });

    // Act
    const resultado = auth.validateCredentials(
      'usuario@example.com',
      'clave',
    );

    // Assert
    await expect(resultado).rejects.toThrow(UnauthorizedException);
    expect(verifyDecoy).toHaveBeenCalledWith('clave');
  });

  it('Camino 3 - cuenta bloqueada, lanza UnauthorizedException', async () => {
    // Arrange
    findByEmail.mockResolvedValue({
      id: 'user-3',
      email: 'bloqueado@example.com',
      passwordHash: 'hash',
      lockedUntil: new Date('2099-01-01T00:00:00.000Z'),
      failedLoginAttempts: 5,
      status: UserStatus.ACTIVE,
    });

    // Act
    const resultado = auth.validateCredentials(
      'bloqueado@example.com',
      'clave',
    );

    // Assert
    await expect(resultado).rejects.toThrow(UnauthorizedException);
    expect(verifyDecoy).toHaveBeenCalledWith('clave');
  });

  it('Camino 4 - credenciales validas, retorna el usuario autenticado', async () => {
    // Arrange
    findByEmail.mockResolvedValue({
      id: 'user-4',
      organizationId: 'organization-1',
      email: 'usuario@example.com',
      name: 'Usuario',
      role: 'ADMIN',
      avatarUrl: null,
      status: UserStatus.ACTIVE,
      passwordHash: 'hash',
      lockedUntil: null,
      failedLoginAttempts: 0,
    });

    verify.mockResolvedValue(true);

    // Act
    const resultado = await auth.validateCredentials(
      'usuario@example.com',
      'clave',
    );

    // Assert
    expect(resultado.email).toBe('usuario@example.com');
    expect(resultado.id).toBe('user-4');
    expect(resultado.organizationId).toBe('organization-1');
  });

  it('Camino 5 - contraseña incorrecta, lanza UnauthorizedException', async () => {
    // Arrange
    findByEmail.mockResolvedValue({
      id: 'user-5',
      organizationId: 'organization-1',
      email: 'usuario@example.com',
      name: 'Usuario',
      role: 'ADMIN',
      avatarUrl: null,
      status: UserStatus.ACTIVE,
      passwordHash: 'hash',
      lockedUntil: null,
      failedLoginAttempts: 0,
    });

    verify.mockResolvedValue(false);

    // Act
    const resultado = auth.validateCredentials(
      'usuario@example.com',
      'contraseña-incorrecta-seguro',
    );

    // Assert
    await expect(resultado).rejects.toThrow(UnauthorizedException);
  });

  it('Camino 6 - estado no es ACTIVE, lanza UnauthorizedException', async () => {
    // Arrange
    findByEmail.mockResolvedValue({
      id: 'user-6',
      organizationId: 'organization-1',
      email: 'suspendido@example.com',
      name: 'Usuario',
      role: 'ADMIN',
      avatarUrl: null,
      status: UserStatus.SUSPENDED,
      passwordHash: 'hash',
      lockedUntil: null,
      failedLoginAttempts: 0,
    });

    verify.mockResolvedValue(true);

    // Act
    const resultado = auth.validateCredentials(
      'suspendido@example.com',
      'clave',
    );

    // Assert
    await expect(resultado).rejects.toThrow(UnauthorizedException);
  });
});

