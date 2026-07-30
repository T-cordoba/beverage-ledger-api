import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { PrismaTransaction } from '../../../infra/prisma/transaction';
import type { StockLevelDto } from '../dto/stock.dto';

interface StockProductRow {
  id: string;
  name: string;
  caseSize: number;
  minimumStock: number | null;
  category: { name: string };
  brand: { name: string } | null;
  stockLevels: { quantityBase: number }[];
}

/** A product with no row yet has never moved, which is stock zero. */
const toDto = (row: StockProductRow): StockLevelDto => {
  const quantityBase = row.stockLevels[0]?.quantityBase ?? 0;

  return {
    productId: row.id,
    productName: row.name,
    brandName: row.brand?.name ?? null,
    categoryName: row.category.name,
    quantityBase,
    caseSize: row.caseSize,
    minimumStock: row.minimumStock,
    isBelowMinimum: row.minimumStock !== null && quantityBase <= row.minimumStock,
  };
};

@Injectable()
export class StockRepository extends BaseRepository {
  constructor(prisma: PrismaService, tenant: TenantContextService) {
    super(prisma, tenant);
  }

  /**
   * Read from products rather than stock_levels, so a product that has never
   * moved still appears, at zero, instead of vanishing from the inventory.
   */
  async findPage(
    limit: number,
    cursor: string | undefined,
    locationId: string,
    filters: { search?: string; categoryId?: string; productIds?: string[] },
  ): Promise<StockLevelDto[]> {
    const rows = await this.prisma.product.findMany({
      where: this.scopedWhere({
        isActive: true,
        ...(filters.search
          ? { name: { contains: filters.search, mode: 'insensitive' as const } }
          : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.productIds ? { id: { in: filters.productIds } } : {}),
      }),
      select: {
        id: true,
        name: true,
        caseSize: true,
        minimumStock: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        stockLevels: { where: { locationId }, select: { quantityBase: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return rows.map(toDto);
  }

  /**
   * Products at or under their reorder threshold.
   *
   * Raw SQL because the filter compares two columns of the same row, which the
   * query API cannot express.
   */
  findBelowMinimum(locationId: string, limit: number) {
    return this.prisma.$queryRaw<
      {
        productId: string;
        productName: string;
        brandName: string | null;
        categoryName: string;
        quantityBase: number;
        caseSize: number;
        minimumStock: number;
      }[]
    >`
      SELECT p.id            AS "productId",
             p.name          AS "productName",
             b.name          AS "brandName",
             c.name          AS "categoryName",
             COALESCE(s.quantity_base, 0) AS "quantityBase",
             p.case_size     AS "caseSize",
             p.minimum_stock AS "minimumStock"
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN stock_levels s ON s.product_id = p.id AND s.location_id = ${locationId}::uuid
      WHERE p.organization_id = ${this.organizationId}::uuid
        AND p.is_active = true
        AND p.minimum_stock IS NOT NULL
        AND COALESCE(s.quantity_base, 0) <= p.minimum_stock
      ORDER BY COALESCE(s.quantity_base, 0)::numeric / NULLIF(p.minimum_stock, 0) ASC, p.name ASC
      LIMIT ${limit}
    `;
  }

  findLevels(productIds: string[], locationId: string) {
    return this.prisma.stockLevel.findMany({
      where: this.scopedWhere({ productId: { in: productIds }, locationId }),
      select: { productId: true, quantityBase: true },
    });
  }

  /** Missing rows start at zero so the guarded update below has something to hit. */
  async ensureRows(productIds: string[], locationId: string, tx: PrismaTransaction): Promise<void> {
    await tx.stockLevel.createMany({
      data: productIds.map((productId) => ({
        organizationId: this.organizationId,
        productId,
        locationId,
        quantityBase: 0,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Applies one delta to every given product, refusing any row it would push
   * below zero.
   *
   * `quantityBase >= -delta` is `quantityBase + delta >= 0` rearranged so the
   * check rides along inside the UPDATE. Read-then-write would let two
   * concurrent confirmations both see enough stock and both spend it.
   *
   * @returns how many rows moved. Fewer than asked means a guard tripped.
   */
  async applyDelta(
    productIds: string[],
    locationId: string,
    delta: number,
    tx: PrismaTransaction,
  ): Promise<number> {
    const result = await tx.stockLevel.updateMany({
      where: this.scopedWhere({
        productId: { in: productIds },
        locationId,
        quantityBase: { gte: -delta },
      }),
      data: { quantityBase: { increment: delta } },
    });

    return result.count;
  }
}
