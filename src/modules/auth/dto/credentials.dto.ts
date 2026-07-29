import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

/** Emails are stored and compared lowercase, so they are normalized on the way in. */
const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @ApiProperty({ format: 'email', example: 'admin@beverageledger.local' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ format: 'password' })
  @IsString()
  @MaxLength(128)
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ format: 'email', example: 'operario@beverageledger.local' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'Ana Restrepo' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsStrongPassword()
  password!: string;
}
