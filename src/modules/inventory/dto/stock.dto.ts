import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PagePaginationDto, PageMetaDto } from '../../../common/dto/pagination.dto';
import { MovementType, MovementUnit } from '../../../generated/prisma/enums';

/** Bounds the URL, and no capture screen holds more lines than this at once. */
const MAX_PRODUCT_IDS = 200;

export class StockLevelDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty({ type: String, nullable: true })
  brandName!: string | null;

  @ApiProperty()
  categoryName!: string;

  @ApiProperty({ description: 'On hand, in singles' })
  quantityBase!: number;

  @ApiProperty({ description: 'Singles per case' })
  caseSize!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Reorder threshold. Null means no alert',
  })
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

export class ListStockDto extends PagePaginationDto {
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

  /**
   * Comma-separated, because a query string has no arrays and repeating the key
   * is not what the generated client emits. Lets a caller ask what is on hand for
   * a set it already has — the capture screen asking how much it may take out —
   * without paging the whole catalogue to find it.
   */
  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated product ids. Narrows the page to those products',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_IDS)
  @IsUUID('all', { each: true })
  productIds?: string[];
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

export class ListKardexDto extends PagePaginationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the default location' })
  @IsOptional()
  @IsUUID()
  locationId?: string;
}
