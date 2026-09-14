import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type { CreateProductDto, ProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';
import { ProductsRepository } from './repositories/products.repository';

/**
 * Writing the catalogue, which sits behind `catalog:manage`. Reading it is open
 * to any authenticated user and stays in ProductsService, where the rest of the
 * API reaches for it.
 */
@Injectable()
export class ProductsAdminService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly catalogue: ProductsService,
    private readonly audit: AuditService,
  ) {}

  /** @throws {ConflictException} when the name is taken in this organization. */
  async create(dto: CreateProductDto): Promise<ProductDto> {
    await this.assertNameIsFree(dto.name);
    await this.assertReferencesExist(dto.categoryId, dto.brandId);

    const created = await this.products.create({
      name: dto.name,
      categoryId: dto.categoryId,
      brandId: dto.brandId ?? null,
      subcategory: dto.subcategory ?? null,
      abv: dto.abv ?? null,
      origin: dto.origin ?? null,
      age: dto.age ?? null,
      caseSize: dto.caseSize ?? 12,
      minimumStock: dto.minimumStock ?? null,
    });

    await this.audit.record({
      action: AuditAction.ProductCreated,
      entity: AuditEntity.Product,
      entityId: created.id,
      metadata: { name: created.name, category: created.category.name },
    });

    return created;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDto> {
    const current = await this.catalogue.findOne(id);

    if (dto.name && dto.name !== current.name) {
      await this.assertNameIsFree(dto.name, id);
    }

    await this.assertReferencesExist(dto.categoryId, dto.brandId);
    await this.products.update(id, dto);

    const deactivated = dto.isActive === false && current.isActive;

    await this.audit.record({
      action: deactivated ? AuditAction.ProductDeactivated : AuditAction.ProductUpdated,
      entity: AuditEntity.Product,
      entityId: id,
      metadata: {
        nameFrom: dto.name ? current.name : undefined,
        nameTo: dto.name,
        isActiveTo: dto.isActive,
      },
    });

    return this.catalogue.findOne(id);
  }

  private async assertNameIsFree(name: string, exceptId?: string): Promise<void> {
    if (await this.products.existsWithName(name, exceptId)) {
      throw new ConflictException('Another product already uses that name');
    }
  }

  /** @throws {BadRequestException} rather than letting a foreign key answer for us. */
  private async assertReferencesExist(categoryId?: string, brandId?: string | null): Promise<void> {
    if (categoryId && !(await this.products.categoryExists(categoryId))) {
      throw new BadRequestException('That category does not exist');
    }

    if (brandId && !(await this.products.brandExists(brandId))) {
      throw new BadRequestException('That brand does not exist');
    }
  }
}
