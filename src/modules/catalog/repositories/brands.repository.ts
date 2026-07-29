import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { BrandDto } from '../dto/brand.dto';

const BRAND = {
  id: true,
  name: true,
  slug: true,
  _count: { select: { products: true } },
} as const;

interface BrandRow {
  id: string;
  name: string;
  slug: string;
  _count: { products: number };
}

const toDto = (row: BrandRow): BrandDto => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  productCount: row._count.products,
});

@Injectable()
export class BrandsRepository extends BaseRepository {
  constructor(prisma: PrismaService, tenant: TenantContextService) {
    super(prisma, tenant);
  }

  /** Fetches one extra row: that is how the caller knows another page exists. */
  async findPage(limit: number, cursor: string | undefined, search?: string): Promise<BrandDto[]> {
    const rows = await this.prisma.brand.findMany({
      where: this.scopedWhere(
        search ? { name: { contains: search, mode: 'insensitive' as const } } : {},
      ),
      select: BRAND,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return rows.map(toDto);
  }

  async findById(id: string): Promise<BrandDto | null> {
    const row = await this.prisma.brand.findFirst({
      where: this.scopedWhere({ id }),
      select: BRAND,
    });

    return row ? toDto(row) : null;
  }

  existsWithSlug(slug: string, exceptId?: string): Promise<boolean> {
    return this.prisma.brand
      .findFirst({
        where: this.scopedWhere({ slug, ...(exceptId ? { id: { not: exceptId } } : {}) }),
        select: { id: true },
      })
      .then((found) => found !== null);
  }

  async create(data: { name: string; slug: string }): Promise<BrandDto> {
    const row = await this.prisma.brand.create({ data: this.scopedData(data), select: BRAND });
    return toDto(row);
  }

  /** updateMany, so the organization filter composes and a foreign id changes nothing. */
  async update(id: string, data: { name: string; slug: string }): Promise<boolean> {
    const result = await this.prisma.brand.updateMany({ where: this.scopedWhere({ id }), data });
    return result.count > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.prisma.brand.deleteMany({ where: this.scopedWhere({ id }) });
    return result.count > 0;
  }
}
