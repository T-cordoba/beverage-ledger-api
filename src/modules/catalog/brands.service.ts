import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { toPage } from '../../common/dto/paginate';
import { slugify } from '../../common/utils/slug';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type {
  BrandDto,
  BrandPageDto,
  CreateBrandDto,
  ListBrandsDto,
  UpdateBrandDto,
} from './dto/brand.dto';
import { BrandsRepository } from './repositories/brands.repository';

@Injectable()
export class BrandsService {
  constructor(
    private readonly brands: BrandsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListBrandsDto): Promise<BrandPageDto> {
    const rows = await this.brands.findPage(query.limit, query.cursor, query.search);
    return toPage(rows, query.limit);
  }

  /** @throws {NotFoundException} which is also the answer for another organization's brand. */
  async findOne(id: string): Promise<BrandDto> {
    const brand = await this.brands.findById(id);

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  /** @throws {ConflictException} when another brand already resolves to the same slug. */
  async create(dto: CreateBrandDto): Promise<BrandDto> {
    const slug = slugify(dto.name);
    await this.assertSlugIsFree(slug);

    const created = await this.brands.create({ name: dto.name, slug });

    await this.audit.record({
      action: AuditAction.BrandCreated,
      entity: AuditEntity.Brand,
      entityId: created.id,
      metadata: { name: created.name },
    });

    return created;
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandDto> {
    const current = await this.findOne(id);
    const slug = slugify(dto.name);

    if (slug !== current.slug) {
      await this.assertSlugIsFree(slug, id);
    }

    await this.brands.update(id, { name: dto.name, slug });

    await this.audit.record({
      action: AuditAction.BrandUpdated,
      entity: AuditEntity.Brand,
      entityId: id,
      metadata: { nameFrom: current.name, nameTo: dto.name },
    });

    return this.findOne(id);
  }

  /**
   * @throws {ConflictException} when products still reference it.
   *
   * The foreign key would null them out instead, which loses the brand of every
   * one of those products without saying so.
   */
  async remove(id: string): Promise<void> {
    const brand = await this.findOne(id);

    if (brand.productCount > 0) {
      throw new ConflictException(
        `The brand still has ${brand.productCount} products. Move them first`,
      );
    }

    await this.brands.delete(id);

    await this.audit.record({
      action: AuditAction.BrandDeleted,
      entity: AuditEntity.Brand,
      entityId: id,
      metadata: { name: brand.name },
    });
  }

  private async assertSlugIsFree(slug: string, exceptId?: string): Promise<void> {
    if (await this.brands.existsWithSlug(slug, exceptId)) {
      throw new ConflictException('Another brand already uses that name');
    }
  }
}
