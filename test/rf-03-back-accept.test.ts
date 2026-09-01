import { NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { createOpaqueToken, fingerprint } from '../src/common/utils/opaque-token';
import { InvitationsService } from '../src/modules/invitations/invitations.service';

describe('InvitationsService.accept', () => {
  let app: INestApplicationContext;
  let prisma: PrismaService;
  let invitations: InvitationsService;

  let organizationId = '';
  let userId = '';

  const invitationIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    prisma = app.get(PrismaService);
    invitations = app.get(InvitationsService);

    const usuario = await prisma.user.findFirstOrThrow({
      where: { email: process.env.TEST_USER_EMAIL },
    });

    organizationId = usuario.organizationId;
    userId = usuario.id;
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (invitationIds.length > 0) {
      await prisma.invitation.deleteMany({ where: { id: { in: invitationIds } } });
    }
    await app.close();
  });

  it('Camino 1 - token invalido lanza NotFoundException', async () => {
    await expect(
      invitations.accept({
        token: 'token-inexistente-completamente-invalido',
        name: 'Nadie',
        password: 'Contraseña123!',
      }),
    ).rejects.toThrow('no longer valid');
  });

  it('Camino 2 - email ya existe en la organizacion lanza ConflictException', async () => {
    const token = createOpaqueToken();

    const inv = await prisma.invitation.create({
      data: {
        organizationId,
        email: process.env.TEST_USER_EMAIL as string,
        role: 'OPERATOR',
        tokenHash: fingerprint(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedByUserId: userId,
      },
    });
    invitationIds.push(inv.id);

    await expect(
      invitations.accept({
        token,
        name: 'Usuario Duplicado',
        password: 'Contraseña123!',
      }),
    ).rejects.toThrow('already belongs to a member');
  });

  it('Camino 3 - segunda aceptacion del mismo token lanza excepcion (proxy de condicion de carrera)', async () => {
    const emailUnico = `vitest-race-${randomUUID()}@example.com`;
    const token = createOpaqueToken();

    const inv = await prisma.invitation.create({
      data: {
        organizationId,
        email: emailUnico,
        role: 'OPERATOR',
        tokenHash: fingerprint(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedByUserId: userId,
      },
    });
    invitationIds.push(inv.id);

    const usuario = await invitations.accept({
      token,
      name: 'Usuario Carrera',
      password: 'Contraseña123!',
    });
    userIds.push(usuario.id);

    await expect(
      invitations.accept({
        token,
        name: 'Usuario Carrera Bis',
        password: 'Contraseña123!',
      }),
    ).rejects.toThrow('no longer valid');
  });

  it('Camino 4 - invitacion valida crea el usuario y devuelve AuthenticatedUser', async () => {
    const emailUnico = `vitest-accept-${randomUUID()}@example.com`;
    const token = createOpaqueToken();

    const inv = await prisma.invitation.create({
      data: {
        organizationId,
        email: emailUnico,
        role: 'OPERATOR',
        tokenHash: fingerprint(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedByUserId: userId,
      },
    });
    invitationIds.push(inv.id);

    const resultado = await invitations.accept({
      token,
      name: '  Ana Restrepo  ',
      password: 'Contraseña123!',
    });

    userIds.push(resultado.id);

    expect(resultado.id).toBeTruthy();
    expect(resultado.email).toBe(emailUnico);
    expect(resultado.name).toBe('Ana Restrepo');
    expect(resultado.organizationId).toBe(organizationId);
    expect(resultado.role).toBe('OPERATOR');
    expect(resultado.permissions).toBeDefined();
    expect(Array.isArray(resultado.permissions)).toBe(true);
  });
});
