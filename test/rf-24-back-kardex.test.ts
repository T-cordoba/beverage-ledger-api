import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { StockService } from '../src/modules/inventory/stock.service';

describe('kardex', () => {
  let app: INestApplicationContext;
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let stock: StockService;

  let organizationId = '';
  let userId = '';

  let productoSinMovimientos = '';
  let productoConMovimientos = '';
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

    const conMovimientos = await prisma.product.findFirstOrThrow({
      where: { organizationId, movementItems: { some: { movement: { status: 'CONFIRMED' } } } },
    });

    productoConMovimientos = conMovimientos.id;

    const sinMovimientos = await prisma.product.findFirst({
      where: { organizationId, movementItems: { none: {} } },
    });

    if (sinMovimientos) {
      productoSinMovimientos = sinMovimientos.id;
      return;
    }

    const categoria = await prisma.category.findFirstOrThrow({ where: { organizationId } });

    const sembrado = await prisma.product.create({
      data: {
        organizationId,
        categoryId: categoria.id,
        name: `Vitest ${randomUUID()}`,
        caseSize: 12,
      },
    });

    productoSinMovimientos = sembrado.id;
    productoSembrado = sembrado.id;
  });

  afterAll(async () => {
    if (productoSembrado) {
      await prisma.product.delete({ where: { id: productoSembrado } });
    }

    await app.close();
  });

  it('Camino 1 - el producto no tiene lineas en el ledger y la pagina sale vacia', async () => {
    const page = await comoAdministrador(() =>
      stock.kardex(productoSinMovimientos, { page: 1, pageSize: 10 }),
    );

    expect(page.data).toEqual([]);
    expect(page.meta.total).toBe(0);
  });

  it('Camino 2 - el producto tiene lineas y cada una trae su saldo corrido', async () => {
    const page = await comoAdministrador(() =>
      stock.kardex(productoConMovimientos, { page: 1, pageSize: 10 }),
    );

    expect(page.data.length).toBeGreaterThan(0);
    expect(typeof page.data[0].balanceAfter).toBe('number');
  });
});
