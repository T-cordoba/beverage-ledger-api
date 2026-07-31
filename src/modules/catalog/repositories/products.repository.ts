import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ProductSort, type ProductDto, type ProductFacetsDto } from '../dto/product.dto';

const isPresent = <T>(value: T | null): value is T => value !== null;

const PRODUCT = {
  id: true,
  name: true,
  subcategory: true,
  abv: true,
  origin: true,
  age: true,
  caseSize: true,
  minimumStock: true,
  isActive: true,
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
} as const;

interface ProductRow {
  id: string;
  name: string;
  subcategory: string | null;
  abv: unknown;
  origin: string | null;
  age: string | null;
  caseSize: number;
  minimumStock: number | null;
  isActive: boolean;
  category: { id: string; name: string };
  brand: { id: string; name: string } | null;
}

/** abv arrives as a Prisma Decimal; the wire contract is a plain number. */
const toDto = (row: ProductRow): ProductDto => ({
  id: row.id,
  name: row.name,
  category: row.category,
  brand: row.brand,
  subcategory: row.subcategory,
  abv: row.abv === null ? null : Number(row.abv),
  origin: row.origin,
  age: row.age,
  caseSize: row.caseSize,
  minimumStock: row.minimumStock,
  isActive: row.isActive,
});

const ORDER_BY = {
  [ProductSort.NameAsc]: [{ name: 'asc' as const }, { id: 'asc' as const }],
  [ProductSort.NameDesc]: [{ name: 'desc' as const }, { id: 'desc' as const }],
  [ProductSort.NewestFirst]: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  [ProductSort.OldestFirst]: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
};

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  brandId?: string;
  origin?: string;
  subcategory?: string;
  age?: string;
  abv?: number;
  isActive?: boolean;
  productIds?: string[];
  sort: ProductSort;
}

/** What a movement line needs to normalize a quantity and snapshot its names. */
export interface MovementTarget {
  id: string;
  name: string;
  caseSize: number;
  isActive: boolean;
  brandName: string | null;
}

@Injectable()
export class ProductsRepository extends BaseRepository {
  constructor(prisma: PrismaService, tenant: TenantContextService) {
    super(prisma, tenant);
  }

  /** Rows and total in one round trip, both taken from the same `where`. */
  async findPage(
    skip: number,
    take: number,
    filters: ProductFilters,
  ): Promise<{ rows: ProductDto[]; total: number }> {
    const where = this.scopedWhere({
      // Served by the pg_trgm index; a btree cannot answer a leading wildcard.
      ...(filters.search
        ? { name: { contains: filters.search, mode: 'insensitive' as const } }
        : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.origin ? { origin: filters.origin } : {}),
      ...(filters.subcategory ? { subcategory: filters.subcategory } : {}),
      ...(filters.age ? { age: filters.age } : {}),
      ...(filters.abv === undefined ? {} : { abv: filters.abv }),
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      ...(filters.productIds ? { id: { in: filters.productIds } } : {}),
    });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: PRODUCT,
        orderBy: ORDER_BY[filters.sort],
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { rows: rows.map(toDto), total };
  }

  /** Four grouped scans over the active catalogue, one per filterable column. */
  async findFacets(): Promise<ProductFacetsDto> {
    const active = this.scopedWhere({ isActive: true });

    const [origins, subcategories, ages, abvs] = await Promise.all([
      this.prisma.product.groupBy({
        by: ['origin'],
        where: { ...active, origin: { not: null } },
        orderBy: { origin: 'asc' },
      }),
      this.prisma.product.groupBy({
        by: ['subcategory'],
        where: { ...active, subcategory: { not: null } },
        orderBy: { subcategory: 'asc' },
      }),
      this.prisma.product.groupBy({
        by: ['age'],
        where: { ...active, age: { not: null } },
        orderBy: { age: 'asc' },
      }),
      this.prisma.product.groupBy({
        by: ['abv'],
        where: { ...active, abv: { not: null } },
        orderBy: { abv: 'asc' },
      }),
    ]);

    return {
      origins: origins.map((row) => row.origin).filter(isPresent),
      subcategories: subcategories.map((row) => row.subcategory).filter(isPresent),
      ages: ages.map((row) => row.age).filter(isPresent),
      abvs: abvs
        .map((row) => row.abv)
        .filter(isPresent)
        .map(Number),
    };
  }

  async findById(id: string): Promise<ProductDto | null> {
    const row = await this.prisma.product.findFirst({
      where: this.scopedWhere({ id }),
      select: PRODUCT,
    });

    return row ? toDto(row) : null;
  }

  findMovementTargets(ids: string[]): Promise<MovementTarget[]> {
    return this.prisma.product
      .findMany({
        where: this.scopedWhere({ id: { in: ids } }),
        select: {
          id: true,
          name: true,
          caseSize: true,
          isActive: true,
          brand: { select: { name: true } },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          caseSize: row.caseSize,
          isActive: row.isActive,
          brandName: row.brand?.name ?? null,
        })),
      );
  }

  existsWithName(name: string, exceptId?: string): Promise<boolean> {
    return this.prisma.product
      .findFirst({
        where: this.scopedWhere({ name, ...(exceptId ? { id: { not: exceptId } } : {}) }),
        select: { id: true },
      })
      .then((found) => found !== null);
  }

  categoryExists(categoryId: string): Promise<boolean> {
    return this.prisma.category
      .findFirst({ where: this.scopedWhere({ id: categoryId }), select: { id: true } })
      .then((found) => found !== null);
  }

  brandExists(brandId: string): Promise<boolean> {
    return this.prisma.brand
      .findFirst({ where: this.scopedWhere({ id: brandId }), select: { id: true } })
      .then((found) => found !== null);
  }

  async create(data: {
    name: string;
    categoryId: string;
    brandId: string | null;
    subcategory: string | null;
    abv: number | null;
    origin: string | null;
    age: string | null;
    caseSize: number;
    minimumStock: number | null;
  }): Promise<ProductDto> {
    const row = await this.prisma.product.create({
      data: this.scopedData(data),
      select: PRODUCT,
    });

    return toDto(row);
  }

  /** updateMany, so the organization filter composes and a foreign id changes nothing. */
  async update(
    id: string,
    data: Partial<{
      name: string;
      categoryId: string;
      /** Null unlinks it: the column is nullable and the relation is SetNull. */
      brandId: string | null;
      subcategory: string;
      abv: number;
      origin: string;
      age: string;
      minimumStock: number;
      isActive: boolean;
    }>,
  ): Promise<boolean> {
    const result = await this.prisma.product.updateMany({ where: this.scopedWhere({ id }), data });
    return result.count > 0;
  }
}
