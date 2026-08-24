import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { StockService } from '../src/modules/inventory/stock.service';

describe('belowMinimum', () => {
  let app: INestApplicationContext;
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let stock: StockService;

  let organizationId = '';
  let userId = '';
  let productoSembrado = '';

  const comoAdministrador = <T>(accion: () => Promise<T>): Promise<T> =>
    tenant.run(undefined, () => {
      tenant.set({ organizationId, userId, role: 'ORG_ADMIN' });
      return accion();
    });

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    prisma = app.get(PrismaService);
    tenant = app.get(TenantContextService);
    stock = app.get(StockService);

    const usuario = await prisma.user.findFirstOrThrow({
      where: { email: process.env.TEST_USER_EMAIL },
    });

    organizationId = usuario.organizationId;
    userId = usuario.id;

    const categoria = await prisma.category.findFirstOrThrow({ where: { organizationId } });

    const sembrado = await prisma.product.create({
      data: {
        organizationId,
        categoryId: categoria.id,
        name: `Vitest ${randomUUID()}`,
        caseSize: 12,
        minimumStock: 10,
      },
    });

    productoSembrado = sembrado.id;
  });

  afterAll(async () => {
    await prisma.product.delete({ where: { id: productoSembrado } });
    await app.close();
  });

  it('Camino 1 - el repositorio no devuelve filas y el arreglo sale vacio', async () => {
    const rows = await comoAdministrador(() => stock.belowMinimum({ limit: 0 }));

    expect(rows).toEqual([]);
  });

  it('Camino 2 - el repositorio devuelve filas y todas quedan marcadas bajo minimo', async () => {
    const rows = await comoAdministrador(() => stock.belowMinimum({ limit: 8 }));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(8);
    expect(rows.every((row) => row.isBelowMinimum)).toBe(true);
  });
});
