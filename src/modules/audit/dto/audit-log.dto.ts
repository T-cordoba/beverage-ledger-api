import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CursorPaginationDto, PageMetaDto } from '../../../common/dto/pagination.dto';

export class AuditLogActorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'email' })
  email!: string;
}

export class AuditLogDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'movement.confirmed' })
  action!: string;

  @ApiProperty({ example: 'movement' })
  entity!: string;

  @ApiProperty({ nullable: true })
  entityId!: string | null;

  @ApiProperty({ type: Object, description: 'Flat scalar detail about the change' })
  metadata!: unknown;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: AuditLogActorDto, nullable: true, description: 'Null for system actions' })
  user!: AuditLogActorDto | null;
}

export class AuditLogPageDto {
  @ApiProperty({ type: AuditLogDto, isArray: true })
  data!: AuditLogDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class ListAuditLogsDto extends CursorPaginationDto {
  @ApiPropertyOptional({ example: 'movement' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity?: string;

  @ApiPropertyOptional({ description: 'Id of the audited record, to follow one thing over time' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @ApiPropertyOptional({ example: 'movement.cancelled' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Who performed the action' })
  @IsOptional()
  @IsUUID()
  userId?: string;

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
