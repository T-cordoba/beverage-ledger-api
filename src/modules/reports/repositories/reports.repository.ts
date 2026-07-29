import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ActivityGranularity, ConsumptionGrouping } from '../dto/report.dto';

/**
 * Which table supplies the label for each grouping.
 *
 * Composed as SQL fragments rather than interpolated strings, and only ever
 * chosen by a validated enum, so no request text reaches the statement.
 */
const GROUPING = {
  [ConsumptionGrouping.Product]: Prisma.sql`p.id, p.name`,
  [ConsumptionGrouping.Category]: Prisma.sql`c.id, c.name`,
  [ConsumptionGrouping.Brand]: Prisma.sql`b.id, b.name`,
};

export interface SummaryRow {
  movements: number;
  inboundMovements: number;
  outboundMovements: number;
  adjustmentMovements: number;
  unitsIn: number;
  unitsOut: number;
  unitsAdjusted: number;
  productsMoved: number;
}

export interface CatalogueSnapshotRow {
  unitsOnHand: number;
  activeProducts: number;
  productsBelowMinimum: number;
}

export interface ConsumptionRow {
  id: string;
  name: string;
  quantityBase: number;
  movementCount: number;
}

export interface ActivityRow {
  period: Date;
  movements: number;
  unitsIn: number;
  unitsOut: number;
}

@Injectable()
export class ReportsRepository extends BaseRepository {
  constructor(prisma: PrismaService, tenant: TenantContextService) {
    super(prisma, tenant);
  }

  /**
   * Every total in one pass with FILTER, instead of one query per figure.
   *
   * Counts and sums are cast to int: COUNT and SUM come back as bigint, which
   * does not survive JSON, and neither a movement count nor a bottle count comes
   * close to overflowing.
   */
  async summary(from: Date, to: Date): Promise<SummaryRow> {
    const rows = await this.prisma.$queryRaw<SummaryRow[]>`
      SELECT
        COUNT(DISTINCT m.id)::int                                             AS "movements",
        COUNT(DISTINCT m.id) FILTER (WHERE m.type = 'INBOUND')::int           AS "inboundMovements",
        COUNT(DISTINCT m.id) FILTER (WHERE m.type = 'OUTBOUND')::int          AS "outboundMovements",
        COUNT(DISTINCT m.id) FILTER (WHERE m.type = 'ADJUSTMENT')::int        AS "adjustmentMovements",
        COALESCE(SUM(mi.quantity_base) FILTER (WHERE m.type = 'INBOUND'), 0)::int      AS "unitsIn",
        COALESCE(-SUM(mi.quantity_base) FILTER (WHERE m.type = 'OUTBOUND'), 0)::int    AS "unitsOut",
        COALESCE(SUM(mi.quantity_base) FILTER (WHERE m.type = 'ADJUSTMENT'), 0)::int   AS "unitsAdjusted",
        COUNT(DISTINCT mi.product_id)::int                                    AS "productsMoved"
      FROM movements m
      LEFT JOIN movement_items mi ON mi.movement_id = m.id
      WHERE m.organization_id = ${this.organizationId}::uuid
        AND m.status = 'CONFIRMED'
        AND m.occurred_at >= ${from}
        AND m.occurred_at <= ${to}
    `;

    return (
      rows[0] ?? {
        movements: 0,
        inboundMovements: 0,
        outboundMovements: 0,
        adjustmentMovements: 0,
        unitsIn: 0,
        unitsOut: 0,
        unitsAdjusted: 0,
        productsMoved: 0,
      }
    );
  }

  /** Where the catalogue stands now, which is not bounded by the report range. */
  async catalogueSnapshot(): Promise<CatalogueSnapshotRow> {
    const rows = await this.prisma.$queryRaw<CatalogueSnapshotRow[]>`
      SELECT
        COALESCE(SUM(s.quantity_base), 0)::int AS "unitsOnHand",
        COUNT(*)::int                          AS "activeProducts",
        COUNT(*) FILTER (
          WHERE p.minimum_stock IS NOT NULL
            AND COALESCE(s.quantity_base, 0) <= p.minimum_stock
        )::int                                 AS "productsBelowMinimum"
      FROM products p
      LEFT JOIN stock_levels s ON s.product_id = p.id
      WHERE p.organization_id = ${this.organizationId}::uuid
        AND p.is_active = true
    `;

    return rows[0] ?? { unitsOnHand: 0, activeProducts: 0, productsBelowMinimum: 0 };
  }

  /**
   * What was dispatched in the range, heaviest first.
   *
   * Outbound only, and negated, because that is what consumption means here: an
   * inbound is a purchase and an adjustment is a correction, neither of which
   * anyone drank.
   */
  consumption(
    from: Date,
    to: Date,
    groupBy: ConsumptionGrouping,
    limit: number,
  ): Promise<ConsumptionRow[]> {
    return this.prisma.$queryRaw<ConsumptionRow[]>`
      SELECT ${GROUPING[groupBy]},
             -SUM(mi.quantity_base)::int   AS "quantityBase",
             COUNT(DISTINCT m.id)::int     AS "movementCount"
      FROM movement_items mi
      JOIN movements m  ON m.id = mi.movement_id
      JOIN products p   ON p.id = mi.product_id
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE m.organization_id = ${this.organizationId}::uuid
        AND m.status = 'CONFIRMED'
        AND m.type = 'OUTBOUND'
        AND m.occurred_at >= ${from}
        AND m.occurred_at <= ${to}
      GROUP BY ${GROUPING[groupBy]}
      HAVING -SUM(mi.quantity_base) > 0
      ORDER BY "quantityBase" DESC
      LIMIT ${limit}
    `;
  }

  /**
   * Movement volume over time.
   *
   * Bucketed in the organization's timezone, not the server's: a dispatch at
   * 11pm in Bogotá belongs to that day's report, not to the next one because the
   * database happens to store UTC.
   */
  activity(from: Date, to: Date, granularity: ActivityGranularity): Promise<ActivityRow[]> {
    return this.prisma.$queryRaw<ActivityRow[]>`
      SELECT date_trunc(${granularity}, m.occurred_at AT TIME ZONE o.timezone)  AS "period",
             COUNT(DISTINCT m.id)::int                                          AS "movements",
             COALESCE(SUM(mi.quantity_base) FILTER (WHERE m.type = 'INBOUND'), 0)::int   AS "unitsIn",
             COALESCE(-SUM(mi.quantity_base) FILTER (WHERE m.type = 'OUTBOUND'), 0)::int AS "unitsOut"
      FROM movements m
      JOIN organizations o ON o.id = m.organization_id
      LEFT JOIN movement_items mi ON mi.movement_id = m.id
      WHERE m.organization_id = ${this.organizationId}::uuid
        AND m.status = 'CONFIRMED'
        AND m.occurred_at >= ${from}
        AND m.occurred_at <= ${to}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }
}
