import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CursorPaginationDto, PageMetaDto } from '../../../common/dto/pagination.dto';

export class LocationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Bodega principal' })
  name!: string;

  @ApiProperty({ description: 'Where a movement lands when it names no location' })
  isDefault!: boolean;

  @ApiProperty({ description: 'Movements that reference it. A used location cannot be deleted' })
  movementCount!: number;
}

export class LocationPageDto {
  @ApiProperty({ type: LocationDto, isArray: true })
  data!: LocationDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class ListLocationsDto extends CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Matches part of the name, case-insensitively' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreateLocationDto {
  @ApiProperty({ example: 'Barra' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Makes this the default and demotes the current one',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    description: 'Only promoting is possible: demoting would leave the organization without one',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
