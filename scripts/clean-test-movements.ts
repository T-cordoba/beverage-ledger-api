import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Removes what the white-box path tests left in the database.
 *
 * The API exposes no DELETE for a movement on purpose, the ledger is immutable,
 * so the tests can only void the drafts they open. Voided drafts never touched
 * stock, which is why deleting them here unbalances nothing.
 */

const TEST_NOTE = 'vitest';
const SEEDED_PRODUCT_PREFIX = 'Vitest ';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const movements = await prisma.movement.findMany({
    where: { note: TEST_NOTE, status: { in: ['DRAFT', 'CANCELLED'] } },
    select: { id: true, code: true, status: true },
  });

  console.log(`${movements.length} movement(s) to delete`);
  for (const movement of movements) console.log(`  ${movement.code} ${movement.status}`);

  // The lines go with it: movement_items cascades on the movement.
  await prisma.movement.deleteMany({ where: { id: { in: movements.map((one) => one.id) } } });

  // A run that died halfway leaves its seeded product behind. One that finished
  // deleted its own, so this is normally a no-op.
  const products = await prisma.product.deleteMany({
    where: {
      name: { startsWith: SEEDED_PRODUCT_PREFIX },
      movementItems: { none: {} },
      stockLevels: { none: {} },
    },
  });

  console.log(`${products.count} seeded product(s) deleted`);

  await prisma.$disconnect();
}

void main();
