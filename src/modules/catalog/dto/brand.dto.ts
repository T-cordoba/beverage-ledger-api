import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PagePaginationDto, PageMetaDto } from '../../../common/dto/pagination.dto';

export class BrandDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Derived from the name; what the brand is unique by' })
  slug!: string;

  @ApiProperty({ description: 'How many products reference it' })
  productCount!: number;
}

export class BrandPageDto {
  @ApiProperty({ type: BrandDto, isArray: true })
  data!: BrandDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class ListBrandsDto extends PagePaginationDto {
  @ApiPropertyOptional({ description: 'Matches part of the name, case-insensitively' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreateBrandDto {
  @ApiProperty({ example: 'Diageo' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

export class UpdateBrandDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
