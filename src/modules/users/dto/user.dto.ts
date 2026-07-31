import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';
import { PageMetaDto } from '../../../common/dto/pagination.dto';
import { UserRole, UserStatus } from '../../../generated/prisma/enums';

export class UserDto {
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

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  emailVerifiedAt!: Date | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastLoginAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class UserPageDto {
  @ApiProperty({ type: UserDto, isArray: true })
  data!: UserDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ana Restrepo' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uri' })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional({
    format: 'password',
    description: 'Required unless the account has no password yet, as with Google-only users',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;

  @IsStrongPassword()
  newPassword!: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: UserRole, enumName: 'UserRole' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, enumName: 'UserStatus' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
