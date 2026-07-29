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
} from 'class-validator';
import { CursorPaginationDto, PageMetaDto } from '../../../common/dto/pagination.dto';

export enum ProductSort {
  NameAsc = 'name',
  NameDesc = '-name',
  NewestFirst = '-createdAt',
  OldestFirst = 'createdAt',
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

  @ApiProperty({ nullable: true })
  subcategory!: string | null;

  @ApiProperty({ nullable: true, description: 'Alcohol by volume, as a percentage' })
  abv!: number | null;

  @ApiProperty({ nullable: true })
  origin!: string | null;

  @ApiProperty({ nullable: true })
  age!: string | null;

  @ApiProperty({ description: 'Singles per case; normalizes quantities to base units' })
  caseSize!: number;

  @ApiProperty({ nullable: true, description: 'Reorder threshold. Null means no alert' })
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

  @ApiPropertyOptional({ description: 'Defaults to active products only' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean = true;

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

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
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

  @ApiPropertyOptional({ format: 'uuid' })
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
