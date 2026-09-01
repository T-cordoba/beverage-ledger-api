import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { ProductsService } from '../src/modules/catalog/products.service';
import type { UpdateProductDto } from '../src/modules/catalog/dto/product.dto';

describe('ProductsService.update', () => {
  let app: INestApplicationContext;
  let prisma: PrismaService;
  let tenant: TenantContextService;
  let products: ProductsService;
  let organizationId = '';
  let userId = '';
  let productoSembradoId = '';
  let productoInactivoId = '';
  let nombreOriginal = '';

  const comoAdministrador = <T>(accion: () => Promise<T>): Promise<T> =>
    tenant.run(undefined, () => {
      tenant.set({ organizationId, userId, role: 'ORG_ADMIN' });
      return accion();
    });

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    prisma = app.get(PrismaService);
    tenant = app.get(TenantContextService);
    products = app.get(ProductsService);

    const usuario = await prisma.user.findFirstOrThrow({
      where: { email: process.env.TEST_USER_EMAIL },
    });
    organizationId = usuario.organizationId;
    userId = usuario.id;

    const categoria = await prisma.category.findFirstOrThrow({ where: { organizationId } });

    nombreOriginal = `Vitest-RF09-${randomUUID()}`;
    const sembrado = await prisma.product.create({
      data: { organizationId, categoryId: categoria.id, name: nombreOriginal, caseSize: 12 },
    });
    productoSembradoId = sembrado.id;

    const inactivo = await prisma.product.create({
      data: {
        organizationId,
        categoryId: categoria.id,
        name: `Vitest-RF09-inactivo-${randomUUID()}`,
        caseSize: 12,
        isActive: false,
      },
    });
    productoInactivoId = inactivo.id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: { id: { in: [productoSembradoId, productoInactivoId] } },
    });
    await app.close();
  });

  it('Camino 1 - dto sin nombre ni desactivacion, producto actualizado sin cambios de nombre', async () => {
    const dto: UpdateProductDto = { origin: 'Escocia' };
    const resultado = await comoAdministrador(() => products.update(productoSembradoId, dto));

    expect(resultado.id).toBe(productoSembradoId);
    expect(resultado.name).toBe(nombreOriginal);
    expect(resultado.isActive).toBe(true);
  });

  it('Camino 2 - dto con nombre igual al actual, no hay cambio de nombre', async () => {
    const dto: UpdateProductDto = { name: nombreOriginal };
    const resultado = await comoAdministrador(() => products.update(productoSembradoId, dto));

    expect(resultado.name).toBe(nombreOriginal);
  });

  it('Camino 3 - dto con nombre distinto al actual, nombre actualizado', async () => {
    const nuevoNombre = `Vitest-RF09-renombrado-${randomUUID()}`;
    const dto: UpdateProductDto = { name: nuevoNombre };
    const resultado = await comoAdministrador(() => products.update(productoSembradoId, dto));

    expect(resultado.name).toBe(nuevoNombre);
    nombreOriginal = nuevoNombre;
  });

  it('Camino 4 - dto con isActive=false pero producto ya inactivo, sin cambio efectivo', async () => {
    const dto: UpdateProductDto = { isActive: false };
    const resultado = await comoAdministrador(() => products.update(productoInactivoId, dto));

    expect(resultado.isActive).toBe(false);
  });

  it('Camino 5 - dto con isActive=false y producto activo, producto desactivado', async () => {
    const dto: UpdateProductDto = { isActive: false };
    const resultado = await comoAdministrador(() => products.update(productoSembradoId, dto));

    expect(resultado.isActive).toBe(false);
  });
});
