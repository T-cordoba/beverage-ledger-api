import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Permission } from '../../common/permissions/permissions.config';
import { BrandsService } from './brands.service';
import {
  BrandDto,
  BrandPageDto,
  CreateBrandDto,
  ListBrandsDto,
  UpdateBrandDto,
} from './dto/brand.dto';

/** Reading is open to every authenticated user: picking a product needs it. */
@ApiTags('catalog')
@ApiBearerAuth()
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'List brands' })
  @ApiOkResponse({ type: BrandPageDto })
  list(@Query() query: ListBrandsDto): Promise<BrandPageDto> {
    return this.brands.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one brand' })
  @ApiOkResponse({ type: BrandDto })
  @ApiNotFoundResponse({ description: 'No such brand in this organization' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<BrandDto> {
    return this.brands.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.CatalogManage)
  @ApiOperation({ summary: 'Create a brand' })
  @ApiCreatedResponse({ type: BrandDto })
  @ApiConflictResponse({ description: 'The name is already in use' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(@Body() dto: CreateBrandDto): Promise<BrandDto> {
    return this.brands.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CatalogManage)
  @ApiOperation({ summary: 'Rename a brand' })
  @ApiOkResponse({ type: BrandDto })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBrandDto): Promise<BrandDto> {
    return this.brands.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CatalogManage)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a brand that has no products' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiConflictResponse({ description: 'Products still reference it' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.brands.remove(id);
  }
}
