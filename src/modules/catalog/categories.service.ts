import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { skipOf, toPage } from '../../common/dto/paginate';
import { slugify } from '../../common/utils/slug';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type {
  CategoryDto,
  CategoryPageDto,
  CreateCategoryDto,
  ListCategoriesDto,
  UpdateCategoryDto,
} from './dto/category.dto';
import { CategoriesRepository } from './repositories/categories.repository';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categories: CategoriesRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListCategoriesDto): Promise<CategoryPageDto> {
    const { rows, total } = await this.categories.findPage(
      skipOf(query),
      query.pageSize,
      query.search,
    );

    return toPage(rows, total, query);
  }

  /** @throws {NotFoundException} which is also the answer for another organization's category. */
  async findOne(id: string): Promise<CategoryDto> {
    const category = await this.categories.findById(id);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  /** @throws {ConflictException} when another category already resolves to the same slug. */
  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const slug = slugify(dto.name);
    await this.assertSlugIsFree(slug);

    const created = await this.categories.create({
      name: dto.name,
      slug,
      sortOrder: dto.sortOrder ?? 0,
    });

    await this.audit.record({
      action: AuditAction.CategoryCreated,
      entity: AuditEntity.Category,
      entityId: created.id,
      metadata: { name: created.name },
    });

    return created;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const current = await this.findOne(id);
    const slug = dto.name ? slugify(dto.name) : undefined;

    if (slug && slug !== current.slug) {
      await this.assertSlugIsFree(slug, id);
    }

    await this.categories.update(id, {
      ...(dto.name ? { name: dto.name, slug } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    });

    await this.audit.record({
      action: AuditAction.CategoryUpdated,
      entity: AuditEntity.Category,
      entityId: id,
      metadata: { nameFrom: dto.name ? current.name : undefined, nameTo: dto.name },
    });

    return this.findOne(id);
  }

  /**
   * @throws {ConflictException} when products still reference it.
   *
   * Reassigning them silently would leave the catalogue inconsistent, and the
   * ledger keeps a name snapshot anyway, so nothing is gained by forcing it.
   */
  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);

    if (category.productCount > 0) {
      throw new ConflictException(
        `The category still has ${category.productCount} products. Move them first`,
      );
    }

    await this.categories.delete(id);

    await this.audit.record({
      action: AuditAction.CategoryDeleted,
      entity: AuditEntity.Category,
      entityId: id,
      metadata: { name: category.name },
    });
  }

  private async assertSlugIsFree(slug: string, exceptId?: string): Promise<void> {
    if (await this.categories.existsWithSlug(slug, exceptId)) {
      throw new ConflictException('Another category already uses that name');
    }
  }
}
