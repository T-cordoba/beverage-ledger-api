import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { skipOf, toPage } from '../../common/dto/paginate';
import type {
  ListProductsDto,
  ProductDto,
  ProductFacetsDto,
  ProductPageDto,
} from './dto/product.dto';
import { ProductStatusFilter } from './dto/product.dto';
import { ProductsRepository, type MovementTarget } from './repositories/products.repository';

/** Undefined is what the repository reads as "do not filter on it at all". */
const ACTIVE_BY_STATUS: Readonly<Record<ProductStatusFilter, boolean | undefined>> = {
  [ProductStatusFilter.Active]: true,
  [ProductStatusFilter.Inactive]: false,
  [ProductStatusFilter.All]: undefined,
};

/**
 * Reading the catalogue, which any authenticated caller may do and which the
 * inventory module leans on. Writing it needs `catalog:manage` and lives in
 * ProductsAdminService.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly products: ProductsRepository) {}

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
}
