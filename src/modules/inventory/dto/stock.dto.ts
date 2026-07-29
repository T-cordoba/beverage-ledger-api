import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { CursorPaginationDto, PageMetaDto } from '../../../common/dto/pagination.dto';
import { MovementType, MovementUnit } from '../../../generated/prisma/enums';

export class StockLevelDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty({ nullable: true })
  brandName!: string | null;

  @ApiProperty()
  categoryName!: string;

  @ApiProperty({ description: 'On hand, in singles' })
  quantityBase!: number;

  @ApiProperty({ description: 'Singles per case' })
  caseSize!: number;

  @ApiProperty({ nullable: true, description: 'Reorder threshold. Null means no alert' })
  minimumStock!: number | null;

  @ApiProperty({ description: 'Whether it sits at or under the reorder threshold' })
  isBelowMinimum!: boolean;
}

export class StockPageDto {
  @ApiProperty({ type: StockLevelDto, isArray: true })
  data!: StockLevelDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class ListStockDto extends CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Matches part of the product name' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the default location' })
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class LowStockDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the default location' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}

/** One ledger line as it reads on a product's card, with the balance it left behind. */
export class KardexEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  movementId!: string;

  @ApiProperty({ example: 'MOV-2026-000042' })
  movementCode!: string;

  @ApiProperty({ enum: MovementType, enumName: 'MovementType' })
  type!: MovementType;

  @ApiProperty({ type: String, format: 'date-time' })
  occurredAt!: Date;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ enum: MovementUnit, enumName: 'MovementUnit' })
  unit!: MovementUnit;

  @ApiProperty({ description: 'Signed change in singles' })
  quantityBase!: number;

  @ApiProperty({ description: 'On hand after this line' })
  balanceAfter!: number;
}

export class KardexPageDto {
  @ApiProperty({ type: KardexEntryDto, isArray: true })
  data!: KardexEntryDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class ListKardexDto extends CursorPaginationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the default location' })
  @IsOptional()
  @IsUUID()
  locationId?: string;
}
