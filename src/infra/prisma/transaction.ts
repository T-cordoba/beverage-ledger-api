import type { Prisma } from '../../generated/prisma/client';

/**
 * The client Prisma hands to a `$transaction` callback.
 *
 * Repositories accept it so a caller can enlist their write in a transaction it
 * owns — which is how a stock update and the movement that caused it commit or
 * roll back together.
 */
export type PrismaTransaction = Prisma.TransactionClient;
