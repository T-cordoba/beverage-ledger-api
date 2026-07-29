import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Paginación por cursor, no por offset.
 *
 * Con offset, `skip` obliga a Postgres a recorrer y descartar las filas
 * anteriores, así que el coste crece con la profundidad de la página; y si se
 * insertan filas entre dos peticiones, se repiten o se pierden registros. El
 * cursor no tiene ninguno de los dos problemas.
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Id del último elemento de la página anterior',
    format: 'uuid',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Número de elementos a devolver',
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
  @ApiProperty({ description: 'Cursor para pedir la página siguiente', nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Si existen más elementos después de esta página' })
  hasMore!: boolean;

  @ApiProperty({ description: 'Número de elementos en esta página' })
  count!: number;
}

export class PageDto<T> {
  data!: T[];
  meta!: PageMetaDto;
}
