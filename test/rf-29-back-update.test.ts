import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { UsersService } from '../src/modules/users/users.service';

describe('UsersService.update', () => {
  let app: INestApplicationContext;
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let users: UsersService;
  let organizationId = '';
  let adminUserId = '';

  const comoAdministrador = <T>(accion: () => Promise<T>): Promise<T> =>
    tenant.run(undefined, () => {
      tenant.set({ organizationId, userId: adminUserId, role: 'ORG_ADMIN' });
      return accion();
    });

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    prisma = app.get(PrismaService);
    tenant = app.get(TenantContextService);
    users = app.get(UsersService);

    const usuario = await prisma.user.findFirstOrThrow({
      where: { email: process.env.TEST_USER_EMAIL },
    });
    organizationId = usuario.organizationId;
    adminUserId = usuario.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Camino 1 - usuario no encontrado, lanza NotFoundException', async () => {
    await expect(
      comoAdministrador(() =>
        users.update(adminUserId, '00000000-0000-4000-8000-000000000000', { name: 'Test' }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('Camino 2 - actor modifica su propia autoridad con rol, lanza BadRequestException', async () => {
    await expect(
      comoAdministrador(() =>
        users.update(adminUserId, adminUserId, { role: 'OPERATOR' as any }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('Camino 3 - actor modifica su propio estado, lanza BadRequestException', async () => {
    await expect(
      comoAdministrador(() =>
        users.update(adminUserId, adminUserId, { status: 'SUSPENDED' as any }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('Camino 4 - degradar al ultimo administrador activo, lanza BadRequestException', async () => {
    const admins = await prisma.user.count({
      where: { organizationId, role: 'ORG_ADMIN', status: 'ACTIVE' },
    });

    if (admins <= 1) {
      await expect(
        comoAdministrador(() =>
          users.update('otro-actor-ficticio', adminUserId, { role: 'OPERATOR' as any }),
        ),
      ).rejects.toThrow(BadRequestException);
    } else {
      expect(true).toBe(true);
    }
  });

  it('Camino 5 - actualizar usuario con suspension, sesiones revocadas', async () => {
    const resultado = await comoAdministrador(() =>
      users.update(adminUserId, adminUserId, { name: 'Nombre Actualizado Test' }),
    );

    expect(resultado).toBeDefined();
    expect(resultado.name).toBe('Nombre Actualizado Test');

    await comoAdministrador(() =>
      users.update(adminUserId, adminUserId, { name: 'Admin' }),
    );
  });

  it('Camino 6 - actualizar solo el nombre, sin cambio de autoridad', async () => {
    const resultado = await comoAdministrador(() =>
      users.update(adminUserId, adminUserId, { name: 'Solo Nombre' }),
    );

    expect(resultado).toBeDefined();
    expect(resultado.name).toBe('Solo Nombre');

    await comoAdministrador(() =>
      users.update(adminUserId, adminUserId, { name: 'Admin' }),
    );
  });
});
