import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Permission } from '../../common/permissions/permissions.config';
import {
  KardexPageDto,
  ListKardexDto,
  ListStockDto,
  LowStockDto,
  StockLevelDto,
  StockPageDto,
} from './dto/stock.dto';
import { StockService } from './stock.service';

@ApiTags('inventory')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  @RequirePermissions(Permission.StockRead)
  @ApiOperation({ summary: 'Stock on hand, by product' })
  @ApiOkResponse({ type: StockPageDto })
  list(@Query() query: ListStockDto): Promise<StockPageDto> {
    return this.stock.list(query);
  }

  @Get('low')
  @RequirePermissions(Permission.StockRead)
  @ApiOperation({ summary: 'Products at or under their reorder threshold' })
  @ApiOkResponse({ type: StockLevelDto, isArray: true })
  low(@Query() query: LowStockDto): Promise<StockLevelDto[]> {
    return this.stock.belowMinimum(query);
  }

  @Get(':productId/kardex')
  @RequirePermissions(Permission.StockRead)
  @ApiOperation({ summary: 'One product ledger, newest first, with the running balance' })
  @ApiOkResponse({ type: KardexPageDto })
  @ApiNotFoundResponse({ description: 'No such product in this organization' })
  kardex(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ListKardexDto,
  ): Promise<KardexPageDto> {
    return this.stock.kardex(productId, query);
  }
}
