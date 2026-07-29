import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { registerDecorator, type ValidationOptions } from 'class-validator';

function isKnownTimeZone(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * An IANA time zone the runtime actually knows.
 *
 * Checked by asking Intl rather than against a list, which would go stale as
 * zones are added and renamed. Worth validating on write: reports bucket with
 * `AT TIME ZONE`, so an unknown zone stored here fails much later, inside a
 * query, where the cause is far from obvious.
 */
export function IsTimeZone(validationOptions?: ValidationOptions): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ example: 'America/Bogota', description: 'IANA time zone' }),
    (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isTimeZone',
        target: target.constructor,
        propertyName: propertyName as string,
        options: {
          message: '$property must be a valid IANA time zone, such as America/Bogota',
          ...validationOptions,
        },
        validator: { validate: isKnownTimeZone },
      });
    },
  );
}
