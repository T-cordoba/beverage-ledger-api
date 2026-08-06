import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PagePaginationDto, PageMetaDto } from '../../../common/dto/pagination.dto';
import { AuditAction, AuditEntity } from '../audit.actions';

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

  /**
   * Declared as an enum, not a free string: the client builds its filter
   * dropdown from this union, so an action added here has to reach the UI or the
   * client stops compiling.
   */
  @ApiProperty({ enum: AuditAction, enumName: 'AuditAction', example: 'movement.confirmed' })
  action!: AuditAction;

  @ApiProperty({ enum: AuditEntity, enumName: 'AuditEntity', example: 'movement' })
  entity!: AuditEntity;

  @ApiProperty({ type: String, nullable: true })
  entityId!: string | null;

  @ApiProperty({ type: Object, description: 'Flat scalar detail about the change' })
  metadata!: unknown;

  @ApiProperty({ type: String, nullable: true })
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

export class ListAuditLogsDto extends PagePaginationDto {
  @ApiPropertyOptional({ enum: AuditEntity, enumName: 'AuditEntity' })
  @IsOptional()
  @IsEnum(AuditEntity)
  entity?: AuditEntity;

  @ApiPropertyOptional({ description: 'Id of the audited record, to follow one thing over time' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @ApiPropertyOptional({ enum: AuditAction, enumName: 'AuditAction' })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

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
