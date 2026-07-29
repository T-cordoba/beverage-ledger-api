import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { MovementStatus, MovementType, MovementUnit } from '../src/generated/prisma/enums';
import { seedProducts } from './data/products';

/**
 * Seeds the database. Idempotent.
 *
 *   npm run db:seed        catalogue with stock at ZERO, like a new business
 *   npm run db:seed:demo   plus an opening movement and simulated history
 */

const DEMO = process.env.SEED_MODE === 'demo';

const ORGANIZATION = {
  slug: 'demo',
  name: 'Beverage Ledger Demo',
  legalName: 'Beverage Ledger Demo S.A.S.',
  timezone: 'America/Bogota',
};

const ADMIN = {
  email: 'admin@beverageledger.local',
  name: 'Administrador',
};

const DEFAULT_LOCATION = 'Bodega principal';
const OUTBOUND_MOVEMENTS = 40;

/** Deterministic PRNG so demo data is identical on every machine. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260728);
const randomInt = (min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[randomInt(0, items.length - 1)] as T;

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const movementCode = (year: number, sequence: number): string =>
  `MOV-${year}-${String(sequence).padStart(6, '0')}`;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log(`Seeding in ${DEMO ? 'DEMO' : 'minimal'} mode...`);

  const organization = await prisma.organization.upsert({
    where: { slug: ORGANIZATION.slug },
    update: {},
    create: ORGANIZATION,
  });

  const location = await prisma.location.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: DEFAULT_LOCATION } },
    update: {},
    create: { organizationId: organization.id, name: DEFAULT_LOCATION, isDefault: true },
  });

  // No passwordHash: it gets set once the auth module exists. Until then this
  // user only serves as the author of movements.
  const admin = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: ADMIN.email } },
    update: {},
    create: {
      organizationId: organization.id,
      email: ADMIN.email,
      name: ADMIN.name,
      role: 'ORG_ADMIN',
      status: 'INVITED',
    },
  });

  console.log(`  organization ${organization.name} · location ${location.name}`);

  const categoryNames = [...new Set(seedProducts.map((product) => product.category))];
  const categoryIdByName = new Map<string, string>();

  for (const [index, name] of categoryNames.entries()) {
    const category = await prisma.category.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug: slugify(name) } },
      update: {},
      create: {
        organizationId: organization.id,
        name,
        slug: slugify(name),
        sortOrder: index,
      },
    });
    categoryIdByName.set(name, category.id);
  }

  const brandNames = [
    ...new Set(seedProducts.map((product) => product.brand).filter((brand) => brand !== null)),
  ];
  const brandIdByName = new Map<string, string>();

  for (const name of brandNames) {
    const brand = await prisma.brand.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug: slugify(name) } },
      update: {},
      create: { organizationId: organization.id, name, slug: slugify(name) },
    });
    brandIdByName.set(name, brand.id);
  }

  console.log(`  ${categoryNames.length} categories · ${brandNames.length} brands`);

  for (const seedProduct of seedProducts) {
    const categoryId = categoryIdByName.get(seedProduct.category);
    if (!categoryId) {
      throw new Error(`Category was not seeded: ${seedProduct.category}`);
    }

    const product = await prisma.product.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: seedProduct.name } },
      update: {},
      create: {
        organizationId: organization.id,
        categoryId,
        brandId: seedProduct.brand ? (brandIdByName.get(seedProduct.brand) ?? null) : null,
        name: seedProduct.name,
        subcategory: seedProduct.subcategory,
        abv: seedProduct.abv,
        origin: seedProduct.origin,
        age: seedProduct.age,
      },
    });

    await prisma.stockLevel.upsert({
      where: { productId_locationId: { productId: product.id, locationId: location.id } },
      update: {},
      create: {
        organizationId: organization.id,
        productId: product.id,
        locationId: location.id,
        quantityBase: 0,
      },
    });
  }

  console.log(`  ${seedProducts.length} products · stock at zero`);

  if (!DEMO) {
    console.log('Done. Empty inventory, like a freshly created business.');
    return;
  }

  const existingMovements = await prisma.movement.count({
    where: { organizationId: organization.id },
  });

  if (existingMovements > 0) {
    console.log(`${existingMovements} movements already exist: not regenerating.`);
    return;
  }

  const products = await prisma.product.findMany({
    where: { organizationId: organization.id },
    select: { id: true, name: true, caseSize: true, brand: { select: { name: true } } },
  });

  const year = new Date().getFullYear();
  let sequence = 0;

  async function createConfirmedMovement(
    type: MovementType,
    occurredAt: Date,
    lines: {
      productId: string;
      name: string;
      brandName: string | null;
      quantity: number;
      unit: MovementUnit;
      caseSize: number;
    }[],
    note: string,
  ): Promise<void> {
    sequence += 1;
    const code = movementCode(year, sequence);
    const sign = type === MovementType.OUTBOUND ? -1 : 1;

    // Grouped by delta because the opening movement has 215 lines, and one
    // update per line blows past the transaction timeout against a remote
    // database. Grouped, it is one query per distinct delta.
    const productIdsByDelta = new Map<number, string[]>();

    for (const line of lines) {
      const delta =
        sign * (line.unit === MovementUnit.CASE ? line.quantity * line.caseSize : line.quantity);
      const bucket = productIdsByDelta.get(delta);

      if (bucket) {
        bucket.push(line.productId);
      } else {
        productIdsByDelta.set(delta, [line.productId]);
      }
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.movement.create({
          data: {
            organizationId: organization.id,
            code,
            type,
            status: MovementStatus.CONFIRMED,
            locationId: location.id,
            occurredAt,
            note,
            createdByUserId: admin.id,
            confirmedAt: occurredAt,
            items: {
              create: lines.map((line) => ({
                productId: line.productId,
                quantity: line.quantity,
                unit: line.unit,
                quantityBase:
                  line.unit === MovementUnit.CASE ? line.quantity * line.caseSize : line.quantity,
                productNameSnapshot: line.name,
                brandNameSnapshot: line.brandName,
              })),
            },
          },
        });

        for (const [delta, ids] of productIdsByDelta) {
          await tx.stockLevel.updateMany({
            where: { productId: { in: ids }, locationId: location.id },
            data: { quantityBase: { increment: delta } },
          });
        }
      },
      { timeout: 30_000, maxWait: 15_000 },
    );
  }

  const openingDate = new Date();
  openingDate.setMonth(openingDate.getMonth() - 6);

  await createConfirmedMovement(
    MovementType.INBOUND,
    openingDate,
    products.map((product) => ({
      productId: product.id,
      name: product.name,
      brandName: product.brand?.name ?? null,
      quantity: randomInt(2, 8),
      unit: MovementUnit.CASE,
      caseSize: product.caseSize,
    })),
    'Inventario de apertura',
  );

  console.log(`  opening movement with ${products.length} lines`);

  for (let index = 0; index < OUTBOUND_MOVEMENTS; index++) {
    const occurredAt = new Date();
    occurredAt.setDate(occurredAt.getDate() - randomInt(1, 175));
    occurredAt.setHours(randomInt(10, 23), randomInt(0, 59), 0, 0);

    const lineCount = randomInt(2, 9);
    const chosen = new Map<string, (typeof products)[number]>();
    while (chosen.size < lineCount) {
      const product = pick(products);
      chosen.set(product.id, product);
    }

    await createConfirmedMovement(
      MovementType.OUTBOUND,
      occurredAt,
      [...chosen.values()].map((product) => ({
        productId: product.id,
        name: product.name,
        brandName: product.brand?.name ?? null,
        quantity: randomInt(1, 4),
        unit: MovementUnit.BOTTLE,
        caseSize: product.caseSize,
      })),
      'Despacho a barra',
    );
  }

  const totalStock = await prisma.stockLevel.aggregate({
    where: { organizationId: organization.id },
    _sum: { quantityBase: true },
  });

  console.log(`  ${OUTBOUND_MOVEMENTS} simulated outbound movements`);
  console.log(`Done. Total stock: ${totalStock._sum.quantityBase ?? 0} units.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
