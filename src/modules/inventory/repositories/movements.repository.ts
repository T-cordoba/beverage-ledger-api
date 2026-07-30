import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { Prisma } from '../../../generated/prisma/client';
import { MovementStatus, MovementType, MovementUnit } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { PrismaTransaction } from '../../../infra/prisma/transaction';

const MOVEMENT = {
  id: true,
  code: true,
  type: true,
  status: true,
  locationId: true,
  occurredAt: true,
  reason: true,
  note: true,
  confirmedAt: true,
  cancelledAt: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      unit: true,
      quantityBase: true,
      productNameSnapshot: true,
      brandNameSnapshot: true,
    },
    orderBy: { productNameSnapshot: 'asc' as const },
  },
} as const;

const MOVEMENT_SUMMARY = {
  id: true,
  code: true,
  type: true,
  status: true,
  occurredAt: true,
  note: true,
  createdBy: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} as const;

export interface MovementLineRow {
  productId: string;
  quantity: number;
  unit: MovementUnit;
  quantityBase: number;
  productNameSnapshot: string;
  brandNameSnapshot: string | null;
}

export interface MovementFilters {
  search?: string;
  type?: MovementType;
  status?: MovementStatus;
  productId?: string;
  createdByUserId?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class MovementsRepository extends BaseRepository {
  constructor(prisma: PrismaService, tenant: TenantContextService) {
    super(prisma, tenant);
  }

  /**
   * Draws the next number for the year, atomically.
   *
   * A single INSERT ... ON CONFLICT DO UPDATE takes the row lock, so two
   * concurrent movements queue instead of colliding on the unique code. Called
   * inside the creating transaction, which is what keeps the series gapless.
   *
   * The first draw of a year seeds itself from the highest code already on the
   * ledger rather than from 1. Movements predate this table — the demo seed
   * numbers its own — and starting over would collide on the unique code. That is
   * what the code format is parsed for; it is the documented MOV-YYYY-NNNNNN.
   */
  async nextSequence(year: number, tx: PrismaTransaction): Promise<number> {
    const rows = await tx.$queryRaw<{ sequence: number }[]>`
      INSERT INTO movement_counters (organization_id, year, next_sequence)
      VALUES (
        ${this.organizationId}::uuid,
        ${year},
        (
          SELECT COALESCE(MAX(SPLIT_PART(code, '-', 3)::integer), 0) + 2
          FROM movements
          WHERE organization_id = ${this.organizationId}::uuid
            AND code LIKE 'MOV-' || ${year} || '-%'
        )
      )
      ON CONFLICT (organization_id, year)
      DO UPDATE SET next_sequence = movement_counters.next_sequence + 1
      RETURNING next_sequence - 1 AS sequence
    `;

    const sequence = rows[0]?.sequence;

    if (sequence === undefined) {
      throw new Error('The movement counter returned no sequence');
    }

    return sequence;
  }

  async create(
    data: {
      code: string;
      type: MovementType;
      locationId: string;
      occurredAt: Date;
      reason: string | null;
      note: string | null;
      createdByUserId: string;
      items: MovementLineRow[];
    },
    tx: PrismaTransaction,
  ): Promise<string> {
    const { items, ...movement } = data;

    const created = await tx.movement.create({
      data: {
        ...this.scopedData(movement),
        status: MovementStatus.DRAFT,
        items: { create: items },
      },
      select: { id: true },
    });

    return created.id;
  }

  findById(id: string) {
    return this.prisma.movement.findFirst({
      where: this.scopedWhere({ id }),
      select: MOVEMENT,
    });
  }

  /** Fetches one extra row: that is how the caller knows another page exists. */
  async findPage(limit: number, cursor: string | undefined, filters: MovementFilters) {
    const rows = await this.prisma.movement.findMany({
      where: this.scopedWhere({
        ...(filters.search
          ? { code: { contains: filters.search, mode: 'insensitive' as const } }
          : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.createdByUserId ? { createdByUserId: filters.createdByUserId } : {}),
        ...(filters.productId ? { items: { some: { productId: filters.productId } } } : {}),
        ...(filters.from || filters.to
          ? {
              occurredAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      }),
      select: MOVEMENT_SUMMARY,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return rows.map(({ _count, ...row }) => ({ ...row, itemCount: _count.items }));
  }

  /**
   * Moves the movement out of `from` only if it is still there, and reports
   * whether it was the one to do it.
   *
   * Compare-and-set rather than read-then-write: two requests confirming the same
   * draft would otherwise both pass the status check and apply the stock delta
   * twice.
   */
  async transition(
    id: string,
    from: MovementStatus,
    to: MovementStatus,
    stamp: { confirmedAt?: Date; cancelledAt?: Date },
    tx: PrismaTransaction,
  ): Promise<boolean> {
    const result = await tx.movement.updateMany({
      where: this.scopedWhere({ id, status: from }),
      data: { status: to, ...stamp },
    });

    return result.count > 0;
  }

  async updateDraft(
    id: string,
    data: { occurredAt?: Date; reason?: string; note?: string },
    items: MovementLineRow[] | undefined,
    tx: PrismaTransaction,
  ): Promise<void> {
    await tx.movement.updateMany({
      where: this.scopedWhere({ id, status: MovementStatus.DRAFT }),
      data,
    });

    if (items) {
      // Replaced wholesale: reconciling line by line would need stable line ids
      // the client does not have, and a draft has not touched stock yet.
      await tx.movementItem.deleteMany({ where: { movementId: id } });
      await tx.movementItem.createMany({
        data: items.map((item) => ({ ...item, movementId: id })),
      });
    }
  }

  /** Confirmed lines for one product, oldest first, with the running balance. */
  kardex(productId: string, locationId: string, limit: number, cursor: string | undefined) {
    return this.prisma.$queryRaw<
      {
        id: string;
        movementId: string;
        movementCode: string;
        type: MovementType;
        occurredAt: Date;
        quantity: number;
        unit: MovementUnit;
        quantityBase: number;
        balanceAfter: bigint;
      }[]
    >`
      WITH ledger AS (
        SELECT mi.id,
               mi.movement_id     AS "movementId",
               m.code             AS "movementCode",
               m.type,
               m.occurred_at      AS "occurredAt",
               mi.quantity,
               mi.unit,
               mi.quantity_base   AS "quantityBase",
               SUM(mi.quantity_base) OVER (
                 ORDER BY m.occurred_at, mi.id
                 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
               ) AS "balanceAfter"
        FROM movement_items mi
        JOIN movements m ON m.id = mi.movement_id
        WHERE mi.product_id = ${productId}::uuid
          AND m.organization_id = ${this.organizationId}::uuid
          AND m.location_id = ${locationId}::uuid
          AND m.status = ${MovementStatus.CONFIRMED}::"MovementStatus"
      )
      SELECT * FROM ledger
      ${
        cursor
          ? Prisma.sql`WHERE ("occurredAt", id) < (
              SELECT "occurredAt", id FROM ledger WHERE id = ${cursor}::uuid
            )`
          : Prisma.empty
      }
      ORDER BY "occurredAt" DESC, id DESC
      LIMIT ${limit + 1}
    `;
  }
}
