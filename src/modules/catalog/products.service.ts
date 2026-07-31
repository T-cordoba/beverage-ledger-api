import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { skipOf, toPage } from '../../common/dto/paginate';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type {
  CreateProductDto,
  ListProductsDto,
  ProductDto,
  ProductFacetsDto,
  ProductPageDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductStatusFilter } from './dto/product.dto';
import { ProductsRepository, type MovementTarget } from './repositories/products.repository';

/** Undefined is what the repository reads as "do not filter on it at all". */
const ACTIVE_BY_STATUS: Readonly<Record<ProductStatusFilter, boolean | undefined>> = {
  [ProductStatusFilter.Active]: true,
  [ProductStatusFilter.Inactive]: false,
  [ProductStatusFilter.All]: undefined,
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListProductsDto): Promise<ProductPageDto> {
    const { rows, total } = await this.products.findPage(skipOf(query), query.pageSize, {
      search: query.search,
      categoryId: query.categoryId,
      brandId: query.brandId,
      origin: query.origin,
      subcategory: query.subcategory,
      age: query.age,
      abv: query.abv,
      isActive: ACTIVE_BY_STATUS[query.status],
      productIds: query.productIds,
      sort: query.sort,
    });

    return toPage(rows, total, query);
  }

  facets(): Promise<ProductFacetsDto> {
    return this.products.findFacets();
  }

  /** @throws {NotFoundException} which is also the answer for another organization's product. */
  async findOne(id: string): Promise<ProductDto> {
    const product = await this.products.findById(id);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  /**
   * Resolves the products a movement refers to, for the inventory module.
   *
   * @throws {BadRequestException} when an id does not belong to this
   * organization or names a deactivated product.
   */
  async resolveMovementTargets(ids: string[]): Promise<Map<string, MovementTarget>> {
    const found = await this.products.findMovementTargets(ids);
    const byId = new Map(found.map((product) => [product.id, product]));

    const missing = ids.filter((id) => !byId.has(id));

    if (missing.length > 0) {
      throw new BadRequestException(`Unknown products: ${missing.join(', ')}`);
    }

    const inactive = found.filter((product) => !product.isActive);

    if (inactive.length > 0) {
      throw new BadRequestException(
        `These products are deactivated: ${inactive.map((product) => product.name).join(', ')}`,
      );
    }

    return byId;
  }

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
    const current = await this.findOne(id);

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

    return this.findOne(id);
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
