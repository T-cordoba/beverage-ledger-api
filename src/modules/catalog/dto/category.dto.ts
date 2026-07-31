import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PagePaginationDto, PageMetaDto } from '../../../common/dto/pagination.dto';

export class CategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Derived from the name; what the category is unique by' })
  slug!: string;

  @ApiProperty({ description: 'Ascending display order' })
  sortOrder!: number;

  @ApiProperty({ description: 'How many products reference it' })
  productCount!: number;
}

export class CategoryPageDto {
  @ApiProperty({ type: CategoryDto, isArray: true })
  data!: CategoryDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class ListCategoriesDto extends PagePaginationDto {
  @ApiPropertyOptional({ description: 'Matches part of the name, case-insensitively' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'Ron' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
