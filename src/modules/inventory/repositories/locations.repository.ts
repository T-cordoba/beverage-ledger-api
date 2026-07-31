import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { PrismaTransaction } from '../../../infra/prisma/transaction';
import type { LocationDto } from '../dto/location.dto';

const LOCATION = {
  id: true,
  name: true,
  isDefault: true,
  _count: { select: { movementItems: true } },
} as const;

interface LocationRow {
  id: string;
  name: string;
  isDefault: boolean;
  _count: { movementItems: number };
}

/**
 * Counted on the lines rather than on the movement header: a transfer into a
 * location writes lines there without being headed by it, and every other
 * movement writes at least one line, so this covers both.
 */
const toDto = (row: LocationRow): LocationDto => ({
  id: row.id,
  name: row.name,
  isDefault: row.isDefault,
  movementCount: row._count.movementItems,
});

@Injectable()
export class LocationsRepository extends BaseRepository {
  constructor(prisma: PrismaService, tenant: TenantContextService) {
    super(prisma, tenant);
  }

  /** Rows and total in one round trip, both taken from the same `where`. */
  async findPage(
    skip: number,
    take: number,
    search?: string,
  ): Promise<{ rows: LocationDto[]; total: number }> {
    const where = this.scopedWhere(
      search ? { name: { contains: search, mode: 'insensitive' as const } } : {},
    );

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({
        where,
        select: LOCATION,
        // The default first: it is the one most callers mean.
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.location.count({ where }),
    ]);

    return { rows: rows.map(toDto), total };
  }

  async findById(id: string): Promise<LocationDto | null> {
    const row = await this.prisma.location.findFirst({
      where: this.scopedWhere({ id }),
      select: LOCATION,
    });

    return row ? toDto(row) : null;
  }

  findDefaultId(): Promise<string | null> {
    return this.prisma.location
      .findFirst({
        where: this.scopedWhere({ isDefault: true }),
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
      .then((found) => found?.id ?? null);
  }

  exists(id: string): Promise<boolean> {
    return this.prisma.location
      .findFirst({ where: this.scopedWhere({ id }), select: { id: true } })
      .then((found) => found !== null);
  }

  existsWithName(name: string, exceptId?: string): Promise<boolean> {
    return this.prisma.location
      .findFirst({
        where: this.scopedWhere({ name, ...(exceptId ? { id: { not: exceptId } } : {}) }),
        select: { id: true },
      })
      .then((found) => found !== null);
  }

  /** Any reference at all, header or line, which is what blocks a delete. */
  async isReferenced(id: string): Promise<boolean> {
    const [movements, items, levels] = await Promise.all([
      this.prisma.movement.count({
        where: this.scopedWhere({
          OR: [{ locationId: id }, { destinationLocationId: id }],
        }),
      }),
      this.prisma.movementItem.count({ where: { locationId: id } }),
      this.prisma.stockLevel.count({
        where: this.scopedWhere({ locationId: id, quantityBase: { not: 0 } }),
      }),
    ]);

    return movements + items + levels > 0;
  }

  /** Demotes every other row, so "default" stays single without a partial index. */
  async demoteOthers(exceptId: string, tx: PrismaTransaction): Promise<void> {
    await tx.location.updateMany({
      where: this.scopedWhere({ id: { not: exceptId }, isDefault: true }),
      data: { isDefault: false },
    });
  }

  async create(
    data: { name: string; isDefault: boolean },
    tx: PrismaTransaction,
  ): Promise<LocationDto> {
    const row = await tx.location.create({ data: this.scopedData(data), select: LOCATION });
    return toDto(row);
  }

  /** updateMany, so the organization filter composes and a foreign id changes nothing. */
  async update(
    id: string,
    data: Partial<{ name: string; isDefault: boolean }>,
    tx: PrismaTransaction,
  ): Promise<boolean> {
    const result = await tx.location.updateMany({ where: this.scopedWhere({ id }), data });
    return result.count > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.prisma.location.deleteMany({ where: this.scopedWhere({ id }) });
    return result.count > 0;
  }
}
