import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 12;

/**
 * The upper bound is not a strength rule: argon2 hashes whatever it is given, so
 * an unbounded field lets one request burn 19 MiB and a CPU core per megabyte.
 */
const PASSWORD_MAX_LENGTH = 128;

/** The password policy, defined once and shared by registration and change. */
export const IsStrongPassword = () =>
  applyDecorators(
    ApiProperty({
      description: `At least ${PASSWORD_MIN_LENGTH} characters, with lowercase, uppercase and a digit`,
      minLength: PASSWORD_MIN_LENGTH,
      maxLength: PASSWORD_MAX_LENGTH,
      format: 'password',
      example: 'Inventario2026!',
    }),
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `The password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: `The password must be at most ${PASSWORD_MAX_LENGTH} characters long`,
    }),
    // One lookahead expression rather than three @Matches: class-validator keys
    // errors by constraint name, so repeated @Matches overwrite each other and
    // the caller only ever sees the last rule that failed.
    Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: 'The password must contain a lowercase letter, an uppercase letter and a digit',
    }),
  );
