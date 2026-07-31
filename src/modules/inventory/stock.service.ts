import { Injectable } from '@nestjs/common';
import { skipOf, toPage } from '../../common/dto/paginate';
import { ProductsService } from '../catalog/products.service';
import type {
  KardexPageDto,
  ListKardexDto,
  ListStockDto,
  LowStockDto,
  StockLevelDto,
  StockPageDto,
} from './dto/stock.dto';
import { LocationsService } from './locations.service';
import { MovementsRepository } from './repositories/movements.repository';
import { StockRepository } from './repositories/stock.repository';

@Injectable()
export class StockService {
  constructor(
    private readonly stock: StockRepository,
    private readonly movements: MovementsRepository,
    private readonly locations: LocationsService,
    private readonly products: ProductsService,
  ) {}

  async list(query: ListStockDto): Promise<StockPageDto> {
    const locationId = await this.locations.resolve(query.locationId);

    const { rows, total } = await this.stock.findPage(skipOf(query), query.pageSize, locationId, {
      search: query.search,
      categoryId: query.categoryId,
      productIds: query.productIds,
    });

    return toPage(rows, total, query);
  }

  /** What the dashboard shows as needing a reorder. Not paginated: it is a shortlist. */
  async belowMinimum(query: LowStockDto): Promise<StockLevelDto[]> {
    const locationId = await this.locations.resolve(query.locationId);
    const rows = await this.stock.findBelowMinimum(locationId, query.limit);

    return rows.map((row) => ({ ...row, isBelowMinimum: true }));
  }

  /**
   * One product's confirmed ledger lines, newest first, each with the balance it
   * left behind.
   *
   * @throws {NotFoundException} when the product is not this organization's.
   */
  async kardex(productId: string, query: ListKardexDto): Promise<KardexPageDto> {
    await this.products.findOne(productId);

    const locationId = await this.locations.resolve(query.locationId);
    const { rows, total } = await this.movements.kardex(
      productId,
      locationId,
      skipOf(query),
      query.pageSize,
    );

    // SUM over an integer column comes back as bigint, which does not survive
    // JSON. The running total of a stock column cannot overflow a JS number.
    const entries = rows.map((row) => ({ ...row, balanceAfter: Number(row.balanceAfter) }));

    return toPage(entries, total, query);
  }
}
