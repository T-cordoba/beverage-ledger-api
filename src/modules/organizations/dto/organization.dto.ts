import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { IsTimeZone } from '../../../common/decorators/is-time-zone.decorator';

export class OrganizationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Trading name. Heads the interface and every document' })
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Registered name, for documents that need it',
  })
  legalName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  logoUrl!: string | null;

  @ApiProperty({ description: 'IANA time zone. Reports bucket by it' })
  timezone!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

/** The slug is absent on purpose: it is how the organization is addressed. */
export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ format: 'uri' })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  logoUrl?: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
