import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { CategoryDto } from '../dto/category.dto';

const CATEGORY = {
  id: true,
  name: true,
  slug: true,
  sortOrder: true,
  _count: { select: { products: true } },
} as const;

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  _count: { products: number };
}

const toDto = (row: CategoryRow): CategoryDto => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  sortOrder: row.sortOrder,
  productCount: row._count.products,
});

@Injectable()
export class CategoriesRepository extends BaseRepository {
  constructor(prisma: PrismaService, tenant: TenantContextService) {
    super(prisma, tenant);
  }

  /** Rows and total in one round trip, both taken from the same `where`. */
  async findPage(
    skip: number,
    take: number,
    search?: string,
  ): Promise<{ rows: CategoryDto[]; total: number }> {
    const where = this.scopedWhere(
      search ? { name: { contains: search, mode: 'insensitive' as const } } : {},
    );

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        select: CATEGORY,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.category.count({ where }),
    ]);

    return { rows: rows.map(toDto), total };
  }

  async findById(id: string): Promise<CategoryDto | null> {
    const row = await this.prisma.category.findFirst({
      where: this.scopedWhere({ id }),
      select: CATEGORY,
    });

    return row ? toDto(row) : null;
  }

  existsWithSlug(slug: string, exceptId?: string): Promise<boolean> {
    return this.prisma.category
      .findFirst({
        where: this.scopedWhere({ slug, ...(exceptId ? { id: { not: exceptId } } : {}) }),
        select: { id: true },
      })
      .then((found) => found !== null);
  }

  async create(data: { name: string; slug: string; sortOrder: number }): Promise<CategoryDto> {
    const row = await this.prisma.category.create({
      data: this.scopedData(data),
      select: CATEGORY,
    });

    return toDto(row);
  }

  /** updateMany, so the organization filter composes and a foreign id changes nothing. */
  async update(
    id: string,
    data: Partial<{ name: string; slug: string; sortOrder: number }>,
  ): Promise<boolean> {
    const result = await this.prisma.category.updateMany({ where: this.scopedWhere({ id }), data });
    return result.count > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.prisma.category.deleteMany({ where: this.scopedWhere({ id }) });
    return result.count > 0;
  }
}
