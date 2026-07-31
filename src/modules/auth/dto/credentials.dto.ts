import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

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
