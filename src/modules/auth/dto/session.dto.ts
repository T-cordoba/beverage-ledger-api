import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../../common/permissions/permissions.config';
import { UserRole, UserStatus } from '../../../generated/prisma/enums';

export class SessionUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status!: UserStatus;
}

export class SessionOrganizationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ type: String, nullable: true })
  logoUrl!: string | null;

  @ApiProperty()
  timezone!: string;
}

/**
 * The refresh token is absent on purpose: it travels in an httpOnly cookie so
 * that a cross-site script cannot read it.
 */
export class SessionDto {
  @ApiProperty({ description: 'Bearer token. The frontend keeps it in memory, never in storage' })
  accessToken!: string;

  @ApiProperty({ description: 'Seconds until the access token expires' })
  expiresIn!: number;

  @ApiProperty({ type: SessionUserDto })
  user!: SessionUserDto;
}

export class CurrentSessionDto {
  @ApiProperty({ type: SessionUserDto })
  user!: SessionUserDto;

  @ApiProperty({ type: SessionOrganizationDto })
  organization!: SessionOrganizationDto;

  @ApiProperty({
    enum: Permission,
    enumName: 'Permission',
    isArray: true,
    description:
      'Effective permissions. The UI hides what is not listed; the API still enforces it',
  })
  permissions!: Permission[];
}
