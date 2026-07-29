import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Cursor pagination, not offset.
 *
 * `skip` makes Postgres walk and discard the preceding rows, so cost grows with
 * page depth; and rows inserted between requests get duplicated or skipped.
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Id of the last item on the previous page', format: 'uuid' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'How many items to return',
    minimum: 1,
    maximum: 100,
    default: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}

export class PageMetaDto {
  @ApiProperty({ description: 'Cursor for the next page', nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more items exist after this page' })
  hasMore!: boolean;

  @ApiProperty({ description: 'Number of items on this page' })
  count!: number;
}

export class PageDto<T> {
  data!: T[];
  meta!: PageMetaDto;
}
