import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CredentialsService } from '../src/modules/auth/credentials.service';
import { UserStatus } from '../src/generated/prisma/enums';

/**
 * El conteo de intentos, que RF-01 no recorre: sus caminos llegan hasta el
 * rechazo, no hasta el intento que agota el presupuesto y bloquea la cuenta.
 */
describe('CredentialsService - bloqueo por intentos fallidos', () => {
  const AHORA = new Date('2026-09-01T12:00:00.000Z');
  const MAX_INTENTOS = 5;
  const MINUTOS_BLOQUEO = 15;

  let auth: CredentialsService;
  let findByEmail: ReturnType<typeof vi.fn>;
  let markLoginFailed: ReturnType<typeof vi.fn>;

  const usuarioCon = (failedLoginAttempts: number) => ({
    id: 'user-1',
    organizationId: 'org-1',
    email: 'usuario@example.com',
    passwordHash: 'hash',
    lockedUntil: null,
    failedLoginAttempts,
    status: UserStatus.ACTIVE,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);

    findByEmail = vi.fn();
    markLoginFailed = vi.fn();

    auth = new CredentialsService(
      {
        findByEmail,
        markLoginSucceeded: vi.fn(),
        markLoginFailed,
      } as any,
      {
        verify: vi.fn().mockResolvedValue(false),
        verifyDecoy: vi.fn(),
      } as any,
      {
        record: vi.fn(),
      } as any,
      {
        get: vi.fn().mockReturnValue({
          maxAttempts: MAX_INTENTOS,
          lockoutMinutes: MINUTOS_BLOQUEO,
        }),
      } as any,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('por debajo del tope, suma el intento y no bloquea', async () => {
    // Arrange
    findByEmail.mockResolvedValue(usuarioCon(1));

    // Act
    const resultado = auth.validateCredentials('usuario@example.com', 'clave');

    // Assert
    await expect(resultado).rejects.toThrow(UnauthorizedException);
    expect(markLoginFailed).toHaveBeenCalledWith('user-1', 2, null);
  });

  it('al alcanzar el tope, reinicia el conteo y bloquea la cuenta', async () => {
    // Arrange: un intento mas deja la cuenta en el maximo
    findByEmail.mockResolvedValue(usuarioCon(MAX_INTENTOS - 1));

    // Act
    const resultado = auth.validateCredentials('usuario@example.com', 'clave');

    // Assert
    await expect(resultado).rejects.toThrow(UnauthorizedException);
    expect(markLoginFailed).toHaveBeenCalledWith(
      'user-1',
      0,
      new Date(AHORA.getTime() + MINUTOS_BLOQUEO * 60_000),
    );
  });
});
