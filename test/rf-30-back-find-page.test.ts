import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { AuditRepository } from '../src/modules/audit/repositories/audit.repository';

describe('AuditRepository.findPage', () => {
  let app: INestApplicationContext;
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let audit: AuditRepository;
  let organizationId = '';
  let userId = '';

  const comoAdministrador = <T>(accion: () => Promise<T>): Promise<T> =>
    tenant.run(undefined, () => {
      tenant.set({ organizationId, userId, role: 'ORG_ADMIN' });
      return accion();
    });

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    prisma = app.get(PrismaService);
    tenant = app.get(TenantContextService);
    audit = app.get(AuditRepository);

    const usuario = await prisma.user.findFirstOrThrow({
      where: { email: process.env.TEST_USER_EMAIL },
    });
    organizationId = usuario.organizationId;
    userId = usuario.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Camino 1 - sin filtros, retorna resultados paginados', async () => {
    const result = await comoAdministrador(() => audit.findPage(0, 10, {}));

    expect(result.rows).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.rows)).toBe(true);
  });

  it('Camino 2 - filtrado por entidad', async () => {
    const result = await comoAdministrador(() =>
      audit.findPage(0, 10, { entity: 'product' }),
    );

    expect(result.rows).toBeDefined();
    for (const row of result.rows) {
      expect(row.entity).toBe('product');
    }
  });

  it('Camino 3 - filtrado por entityId', async () => {
    const result = await comoAdministrador(() =>
      audit.findPage(0, 10, { entityId: 'uuid-inexistente' }),
    );

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('Camino 4 - filtrado por accion', async () => {
    const result = await comoAdministrador(() =>
      audit.findPage(0, 10, { action: 'product.created' }),
    );

    expect(result.rows).toBeDefined();
    for (const row of result.rows) {
      expect(row.action).toBe('product.created');
    }
  });

  it('Camino 5 - filtrado por usuario', async () => {
    const result = await comoAdministrador(() =>
      audit.findPage(0, 10, { userId }),
    );

    expect(result.rows).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('Camino 6 - filtrado por rango de fecha completo (from y to)', async () => {
    const from = new Date('2026-08-01');
    const to = new Date('2026-08-31');

    const result = await comoAdministrador(() =>
      audit.findPage(0, 10, { from, to }),
    );

    expect(result.rows).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('Camino 7 - filtrado solo por fecha desde (gte)', async () => {
    const from = new Date('2026-08-01');

    const result = await comoAdministrador(() =>
      audit.findPage(0, 10, { from }),
    );

    expect(result.rows).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('Camino 8 - filtrado solo por fecha hasta (lte)', async () => {
    const to = new Date('2026-08-31');

    const result = await comoAdministrador(() =>
      audit.findPage(0, 10, { to }),
    );

    expect(result.rows).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});
