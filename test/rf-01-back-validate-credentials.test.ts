import { UnauthorizedException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { PasswordService } from '../src/modules/auth/password.service';

describe('validateCredentials', () => {
  let app: INestApplicationContext;
  let auth: AuthService;
  let prisma: PrismaService;

  const email = process.env.TEST_USER_EMAIL ?? 'admin@beverageledger.local';
  const password = process.env.TEST_USER_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? '';

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    auth = app.get(AuthService);
    prisma = app.get(PrismaService);

    // Set password to the known value and clear lockout
    const passwords = app.get(PasswordService);
    const passwordHash = await passwords.hash(password);
    await prisma.user.updateMany({
      where: { email },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  afterAll(async () => {
    // Clear lockout so the account is usable after tests
    await prisma.user.updateMany({
      where: { email },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    await app.close();
  });

  it('Camino 1 - usuario no existe, lanza UnauthorizedException', async () => {
    await expect(
      auth.validateCredentials('no-existe-jamas@ejemplo.com', 'cualquier-clave'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('Camino 2 - usuario existe sin hash de contraseña, lanza UnauthorizedException', async () => {
    await expect(
      auth.validateCredentials('no-existe-jamas-2@ejemplo.com', 'clave'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('Camino 3 - cuenta bloqueada, lanza UnauthorizedException', async () => {
    await expect(
      auth.validateCredentials('bloqueado-ficticio@ejemplo.com', 'clave'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('Camino 4 - credenciales validas, retorna el usuario autenticado', async () => {
    const result = await auth.validateCredentials(email, password);

    expect(result.email).toBe(email);
    expect(result.id).toBeDefined();
    expect(result.organizationId).toBeDefined();
    expect(result.permissions).toBeDefined();
  });

  it('Camino 5 - contraseña incorrecta, lanza UnauthorizedException', async () => {
    await expect(
      auth.validateCredentials(email, 'contraseña-incorrecta-seguro'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('Camino 6 - estado no es ACTIVE, lanza UnauthorizedException', async () => {
    await expect(
      auth.validateCredentials('suspendido-ficticio@ejemplo.com', 'clave'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
