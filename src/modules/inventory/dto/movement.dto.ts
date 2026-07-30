import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CursorPaginationDto, PageMetaDto } from '../../../common/dto/pagination.dto';
import { MovementStatus, MovementType, MovementUnit } from '../../../generated/prisma/enums';

/** Guards against a single request trying to move the whole catalogue at once. */
const MAX_LINES = 500;

export class MovementItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Which location this line moves. A transfer writes one line per side',
  })
  locationId!: string;

  @ApiProperty({ description: 'As captured, in the unit below' })
  quantity!: number;

  @ApiProperty({ enum: MovementUnit, enumName: 'MovementUnit' })
  unit!: MovementUnit;

  @ApiProperty({ description: 'Normalized to singles with the case size. Signed by type' })
  quantityBase!: number;

  @ApiProperty({ description: 'The product name as it stood when the line was written' })
  productNameSnapshot!: string;

  @ApiProperty({ type: String, nullable: true })
  brandNameSnapshot!: string | null;
}

export class MovementActorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class MovementDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'MOV-2026-000042' })
  code!: string;

  @ApiProperty({ enum: MovementType, enumName: 'MovementType' })
  type!: MovementType;

  @ApiProperty({ enum: MovementStatus, enumName: 'MovementStatus' })
  status!: MovementStatus;

  @ApiProperty({ format: 'uuid', description: 'The origin on a transfer' })
  locationId!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Only a transfer has one',
  })
  destinationLocationId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'When it happened' })
  occurredAt!: Date;

  @ApiProperty({ type: String, nullable: true, description: 'Mandatory on adjustments' })
  reason!: string | null;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: MovementActorDto })
  createdBy!: MovementActorDto;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  confirmedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: MovementItemDto, isArray: true })
  items!: MovementItemDto[];
}

/** The list omits the lines: a history page needs the totals, not every bottle. */
export class MovementSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'MOV-2026-000042' })
  code!: string;

  @ApiProperty({ enum: MovementType, enumName: 'MovementType' })
  type!: MovementType;

  @ApiProperty({ enum: MovementStatus, enumName: 'MovementStatus' })
  status!: MovementStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  occurredAt!: Date;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: MovementActorDto })
  createdBy!: MovementActorDto;

  @ApiProperty({ description: 'How many lines it has' })
  itemCount!: number;
}

export class MovementPageDto {
  @ApiProperty({ type: MovementSummaryDto, isArray: true })
  data!: MovementSummaryDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class MovementLineInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    description:
      'Positive on inbound, outbound and transfer, where the type carries the direction. Signed on an adjustment, which corrects either way',
    example: 6,
  })
  @Type(() => Number)
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  quantity!: number;

  @ApiProperty({ enum: MovementUnit, enumName: 'MovementUnit', default: MovementUnit.BOTTLE })
  @IsEnum(MovementUnit)
  unit!: MovementUnit;
}

export class CreateMovementDto {
  @ApiProperty({ enum: MovementType, enumName: 'MovementType' })
  @IsEnum(MovementType)
  type!: MovementType;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Defaults to the default location. The origin on a transfer',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required on a transfer, and rejected on every other type',
  })
  @IsOptional()
  @IsUUID()
  destinationLocationId?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'When it happened, which need not be now. Defaults to now',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  occurredAt?: Date;

  @ApiPropertyOptional({ description: 'Mandatory on adjustments' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ type: MovementLineInputDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => MovementLineInputDto)
  items!: MovementLineInputDto[];
}

/** Only a draft can be edited, and the lines are replaced wholesale. */
export class UpdateMovementDto {
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  occurredAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ type: MovementLineInputDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => MovementLineInputDto)
  items?: MovementLineInputDto[];
}

export class CancelMovementDto {
  @ApiProperty({ description: 'Why it is being voided. Kept on the audit trail' })
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  reason!: string;
}

export class ListMovementsDto extends CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Matches part of the movement code, case-insensitively' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  search?: string;

  @ApiPropertyOptional({ enum: MovementType, enumName: 'MovementType' })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @ApiPropertyOptional({ enum: MovementStatus, enumName: 'MovementStatus' })
  @IsOptional()
  @IsEnum(MovementStatus)
  status?: MovementStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only movements touching this product' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  createdByUserId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Movements touching this location, on either side of a transfer',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
