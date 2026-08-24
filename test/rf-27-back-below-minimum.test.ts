import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { StockService } from '../src/modules/inventory/stock.service';

/**
 * RF-27 - BACK - belowMinimum(query)
 * Un test por cada camino de la tabla de docs/testing/RF-27-bajo-minimo.md.
 * Consulta la base de datos de verdad. El contexto de organizacion lo abre el
 * propio test, que es lo que en produccion hace el guard de autenticacion.
 */
describe('belowMinimum', () => {
  let app: INestApplicationContext;
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let stock: StockService;

  let organizationId = '';
  let userId = '';
  let productoSembrado = '';

  // Abre el contexto de la organizacion alrededor de la llamada al service.
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

    // Un producto con minimo y sin existencias esta bajo su minimo por
    // definicion, asi que el camino 2 no depende de como este el inventario. El
    // nombre lleva un identificador unico porque (organizationId, name) es unico.
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
    // Solo se borra lo que este test creo.
    await prisma.product.delete({ where: { id: productoSembrado } });
    await app.close();
  });

  it('Camino 1 - el repositorio no devuelve filas y el arreglo sale vacio', async () => {
    // Con limite cero la consulta no puede devolver nada, asi que el ciclo no entra.
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
