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
import { CategoriesService } from './categories.service';
import {
  CategoryDto,
  CategoryPageDto,
  CreateCategoryDto,
  ListCategoriesDto,
  UpdateCategoryDto,
} from './dto/category.dto';

/** Reading is open to every authenticated user: picking a product needs it. */
@ApiTags('catalog')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List categories' })
  @ApiOkResponse({ type: CategoryPageDto })
  list(@Query() query: ListCategoriesDto): Promise<CategoryPageDto> {
    return this.categories.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one category' })
  @ApiOkResponse({ type: CategoryDto })
  @ApiNotFoundResponse({ description: 'No such category in this organization' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryDto> {
    return this.categories.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.CatalogManage)
  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedResponse({ type: CategoryDto })
  @ApiConflictResponse({ description: 'The name is already in use' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CatalogManage)
  @ApiOperation({ summary: 'Rename or reorder a category' })
  @ApiOkResponse({ type: CategoryDto })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CatalogManage)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category that has no products' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiConflictResponse({ description: 'Products still reference it' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
