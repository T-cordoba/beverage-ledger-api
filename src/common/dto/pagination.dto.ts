import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Offset pagination, addressed by page number.
 *
 * Cursor pagination came first and is cheaper per query: no COUNT, and no rows
 * walked and discarded before the page begins. What it cannot do is answer "how
 * many are there" or "take me to page 12", and those are two of the questions an
 * inventory list exists to answer. At this size — a catalogue in the hundreds, a
 * ledger in the thousands — the count costs less than the feature is worth. If a
 * tenant ever outgrows it the cure is a keyset index, not a UI that could only
 * ever go forwards.
 */
export class PagePaginationDto {
  @ApiPropertyOptional({ description: '1-based page number', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'How many items a page holds',
    minimum: 1,
    maximum: 100,
    default: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;
}

export class PageMetaDto {
  @ApiProperty({ description: 'Which page this is, 1-based' })
  page!: number;

  @ApiProperty({ description: 'How many items a full page holds' })
  pageSize!: number;

  @ApiProperty({ description: 'Items matching the filters across every page' })
  total!: number;

  @ApiProperty({ description: 'How many pages the total splits into. Never below 1' })
  pageCount!: number;

  @ApiProperty({ description: 'Number of items on this page' })
  count!: number;
}

export class PageDto<T> {
  data!: T[];
  meta!: PageMetaDto;
}
