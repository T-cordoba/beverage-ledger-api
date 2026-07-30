import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Permission } from '../../common/permissions/permissions.config';
import {
  CreateProductDto,
  ListProductsDto,
  ProductDto,
  ProductFacetsDto,
  ProductPageDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

/** Reading is open to every authenticated user: picking a product needs it. */
@ApiTags('catalog')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products, searched and filtered server-side' })
  @ApiOkResponse({ type: ProductPageDto })
  list(@Query() query: ListProductsDto): Promise<ProductPageDto> {
    return this.products.list(query);
  }

  /** Declared before `:id`, or the pipe on that route would reject "facets". */
  @Get('facets')
  @ApiOperation({ summary: 'Distinct origins, subcategories, ages and ABVs, for the filters' })
  @ApiOkResponse({ type: ProductFacetsDto })
  facets(): Promise<ProductFacetsDto> {
    return this.products.facets();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one product' })
  @ApiOkResponse({ type: ProductDto })
  @ApiNotFoundResponse({ description: 'No such product in this organization' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProductDto> {
    return this.products.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.CatalogManage)
  @ApiOperation({ summary: 'Create a product' })
  @ApiCreatedResponse({ type: ProductDto })
  @ApiConflictResponse({ description: 'The name is already in use' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(@Body() dto: CreateProductDto): Promise<ProductDto> {
    return this.products.create(dto);
  }

  /** There is no DELETE: the ledger references products, so retiring one is `isActive: false`. */
  @Patch(':id')
  @RequirePermissions(Permission.CatalogManage)
  @ApiOperation({ summary: 'Edit a product, or retire it with isActive: false' })
  @ApiOkResponse({ type: ProductDto })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDto> {
    return this.products.update(id, dto);
  }
}
