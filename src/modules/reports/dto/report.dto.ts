import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum ConsumptionGrouping {
  Product = 'product',
  Category = 'category',
  Brand = 'brand',
}

export enum ActivityGranularity {
  Day = 'day',
  Week = 'week',
  Month = 'month',
}

/** Unbounded aggregates are a full scan, so an omitted range means the last 30 days. */
export class ReportRangeDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Defaults to 30 days ago',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Defaults to now' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class ConsumptionQueryDto extends ReportRangeDto {
  @ApiPropertyOptional({ enum: ConsumptionGrouping, default: ConsumptionGrouping.Product })
  @IsOptional()
  @IsEnum(ConsumptionGrouping)
  groupBy: ConsumptionGrouping = ConsumptionGrouping.Product;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 20;
}

export class ActivityQueryDto extends ReportRangeDto {
  @ApiPropertyOptional({ enum: ActivityGranularity, default: ActivityGranularity.Day })
  @IsOptional()
  @IsEnum(ActivityGranularity)
  granularity: ActivityGranularity = ActivityGranularity.Day;
}

export class ReportRangeEchoDto {
  @ApiProperty({ type: String, format: 'date-time' })
  from!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  to!: Date;
}

export class SummaryReportDto {
  @ApiProperty({ type: ReportRangeEchoDto, description: 'The range actually applied' })
  range!: ReportRangeEchoDto;

  @ApiProperty({ description: 'Confirmed movements in the range' })
  movements!: number;

  @ApiProperty()
  inboundMovements!: number;

  @ApiProperty()
  outboundMovements!: number;

  @ApiProperty()
  adjustmentMovements!: number;

  @ApiProperty({ description: 'Singles received' })
  unitsIn!: number;

  @ApiProperty({ description: 'Singles dispatched, as a positive number' })
  unitsOut!: number;

  @ApiProperty({ description: 'Net singles added or removed by adjustments' })
  unitsAdjusted!: number;

  @ApiProperty({ description: 'Distinct products that moved in the range' })
  productsMoved!: number;

  @ApiProperty({ description: 'Singles on hand right now, across every location' })
  unitsOnHand!: number;

  @ApiProperty({ description: 'Active products in the catalogue right now' })
  activeProducts!: number;

  @ApiProperty({ description: 'Active products at or under their reorder threshold right now' })
  productsBelowMinimum!: number;
}

export class ConsumptionRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Singles dispatched, as a positive number' })
  quantityBase!: number;

  @ApiProperty({ description: 'How many movements it appeared in' })
  movementCount!: number;
}

export class ConsumptionReportDto {
  @ApiProperty({ type: ReportRangeEchoDto })
  range!: ReportRangeEchoDto;

  @ApiProperty({ enum: ConsumptionGrouping })
  groupBy!: ConsumptionGrouping;

  @ApiProperty({ type: ConsumptionRowDto, isArray: true })
  data!: ConsumptionRowDto[];
}

export class ActivityRowDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'Start of the period' })
  period!: Date;

  @ApiProperty()
  movements!: number;

  @ApiProperty()
  unitsIn!: number;

  @ApiProperty({ description: 'Singles dispatched, as a positive number' })
  unitsOut!: number;
}

export class ActivityReportDto {
  @ApiProperty({ type: ReportRangeEchoDto })
  range!: ReportRangeEchoDto;

  @ApiProperty({ enum: ActivityGranularity })
  granularity!: ActivityGranularity;

  @ApiProperty({ type: ActivityRowDto, isArray: true })
  data!: ActivityRowDto[];
}
