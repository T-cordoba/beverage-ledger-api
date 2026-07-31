import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';
import { PageMetaDto } from '../../../common/dto/pagination.dto';
import { UserRole } from '../../../generated/prisma/enums';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** What a member sees while an invitation is outstanding. Never the token. */
export class InvitationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  acceptedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  revokedAt!: Date | null;

  @ApiProperty({ description: 'Who sent it' })
  invitedByName!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class InvitationPageDto {
  @ApiProperty({ type: InvitationDto, isArray: true })
  data!: InvitationDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

/**
 * The one and only time the raw token leaves the server.
 *
 * There is no mail delivery in this project, so the admin copies the link and
 * hands it over themselves. Nothing can show it again: only the hash is stored,
 * and a lost invitation is revoked and reissued.
 */
export class IssuedInvitationDto {
  @ApiProperty({ type: InvitationDto })
  invitation!: InvitationDto;

  @ApiProperty({ description: 'The link to pass to the invitee. Shown once' })
  acceptUrl!: string;
}

export class CreateInvitationDto {
  @ApiProperty({ format: 'email' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole', example: UserRole.OPERATOR })
  @IsEnum(UserRole)
  role!: UserRole;
}

/**
 * The token travels in the body, not the path.
 *
 * A path lands in access logs, in the Referer header and in any proxy in
 * between, which is the same reason the Google callback does not carry one.
 */
export class InvitationTokenDto {
  @ApiProperty({ description: 'The token from the invitation link' })
  @IsString()
  @MaxLength(128)
  token!: string;
}

/** What the accept screen may show before anyone has proven anything. */
export class InvitationPreviewDto {
  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  @ApiProperty({ description: 'The organization being joined' })
  organizationName!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: Date;
}

export class AcceptInvitationDto extends InvitationTokenDto {
  @ApiProperty({ example: 'Ana Restrepo' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ description: 'At least 12 characters, with lowercase, uppercase and a digit' })
  @IsStrongPassword()
  password!: string;
}
