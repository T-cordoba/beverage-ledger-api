import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CursorPaginationDto, PageMetaDto } from '../../../common/dto/pagination.dto';

export enum ProductSort {
  NameAsc = 'name',
  NameDesc = '-name',
  NewestFirst = '-createdAt',
  OldestFirst = 'createdAt',
}

/**
 * Three states, which a boolean could not express: omitting it has to keep
 * meaning "active only", so there was no value left for "both".
 */
export enum ProductStatusFilter {
  Active = 'active',
  Inactive = 'inactive',
  All = 'all',
}

export class ProductReferenceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ProductDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: ProductReferenceDto })
  category!: ProductReferenceDto;

  @ApiProperty({ type: ProductReferenceDto, nullable: true })
  brand!: ProductReferenceDto | null;

  @ApiProperty({ type: String, nullable: true })
  subcategory!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Alcohol by volume, as a percentage' })
  abv!: number | null;

  @ApiProperty({ type: String, nullable: true })
  origin!: string | null;

  @ApiProperty({ type: String, nullable: true })
  age!: string | null;

  @ApiProperty({ description: 'Singles per case; normalizes quantities to base units' })
  caseSize!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Reorder threshold. Null means no alert',
  })
  minimumStock!: number | null;

  @ApiProperty()
  isActive!: boolean;
}

export class ProductPageDto {
  @ApiProperty({ type: ProductDto, isArray: true })
  data!: ProductDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

/**
 * The distinct values behind the filters that are plain columns rather than
 * relations. Categories and brands have their own endpoints; these four do not,
 * and a client cannot derive them without downloading the whole catalogue —
 * which is what the filters exist to avoid.
 */
export class ProductFacetsDto {
  @ApiProperty({ type: String, isArray: true })
  origins!: string[];

  @ApiProperty({ type: String, isArray: true })
  subcategories!: string[];

  @ApiProperty({ type: String, isArray: true })
  ages!: string[];

  @ApiProperty({ type: Number, isArray: true, description: 'Ascending' })
  abvs!: number[];
}

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class ListProductsDto extends CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Matches part of the name, case-insensitively' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Exact match, from the values in /products/facets' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  origin?: string;

  @ApiPropertyOptional({ description: 'Exact match, from the values in /products/facets' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subcategory?: string;

  @ApiPropertyOptional({ description: 'Exact match, from the values in /products/facets' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  age?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  abv?: number;

  @ApiPropertyOptional({ enum: ProductStatusFilter, default: ProductStatusFilter.Active })
  @IsOptional()
  @IsEnum(ProductStatusFilter)
  status: ProductStatusFilter = ProductStatusFilter.Active;

  @ApiPropertyOptional({ enum: ProductSort, default: ProductSort.NameAsc })
  @IsOptional()
  @IsEnum(ProductSort)
  sort: ProductSort = ProductSort.NameAsc;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Havana Club 7 Años' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subcategory?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  abv?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  origin?: string;

  @ApiPropertyOptional({ example: '7 años' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  age?: string;

  @ApiPropertyOptional({ default: 12, description: 'Singles per case' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  caseSize?: number;

  @ApiPropertyOptional({ description: 'Reorder threshold, in singles' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumStock?: number;
}

/**
 * caseSize is absent on purpose: it is the divisor already applied to every
 * historic quantity_base, so changing it would silently restate the ledger.
 */
export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Null unlinks the brand. Omitted leaves it as it is',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  brandId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subcategory?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  abv?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  origin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  age?: string;

  @ApiPropertyOptional({ description: 'Reorder threshold, in singles' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumStock?: number;

  @ApiPropertyOptional({ description: 'Deactivate instead of deleting: the ledger references it' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}
