import { z } from 'zod';

/** `z.coerce.boolean()` is unusable here: `Boolean('false')` is `true`. */
const booleanFromEnv = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

const postgresUrl = (name: string) =>
  z
    .string()
    .min(1, `${name} is required`)
    .refine((value) => value.startsWith('postgres://') || value.startsWith('postgresql://'), {
      message: `${name} must be a PostgreSQL URL. Passwords containing / % @ or : must be URL-encoded`,
    });

/** `15m`, `7d`, `3600s`… the format `jsonwebtoken` accepts for expiresIn. */
const duration = (name: string) =>
  z.string().regex(/^\d+[smhd]$/, `${name} must be a number followed by s, m, h or d`);

/**
 * A `.env` cannot express absence: an unused variable is left as `KEY=""`, which
 * arrives as an empty string and would otherwise fail every `min(1)` rule.
 */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3001),
    API_PREFIX: z.string().min(1).default('api/v1'),

    /** Runtime connection, through the transaction-mode pooler. */
    DATABASE_URL: postgresUrl('DATABASE_URL'),
    /** Migration connection. A transaction-mode pooler cannot run migrations. */
    DIRECT_URL: postgresUrl('DIRECT_URL'),

    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    /** Where the Google callback sends the browser back to. */
    FRONTEND_URL: z.url().default('http://localhost:3000'),

    SWAGGER_ENABLED: booleanFromEnv('true'),

    THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

    /** 32 bytes minimum: a shorter secret is brute-forceable against HS256. */
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: duration('JWT_ACCESS_TTL').default('15m'),
    JWT_REFRESH_TTL: duration('JWT_REFRESH_TTL').default('30d'),

    AUTH_COOKIE_NAME: z.string().min(1).default('bl_refresh'),

    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

    /** Organization new self-registered users join while org signup is deferred. */
    DEFAULT_ORGANIZATION_SLUG: z.string().min(1).default('demo'),

    GOOGLE_CLIENT_ID: optional(z.string().min(1)),
    GOOGLE_CLIENT_SECRET: optional(z.string().min(1)),
    GOOGLE_CALLBACK_URL: optional(z.url()),
  })
  .superRefine((env, ctx) => {
    const google = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL];

    // Google is optional so the API boots without credentials, but a partial set
    // would fail at the callback instead of at startup.
    if (google.some(Boolean) && !google.every(Boolean)) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_CLIENT_ID'],
        message:
          'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL must be set together, or all left empty',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validates the environment at startup.
 *
 * @throws {Error} listing every invalid variable, so a misconfiguration stops
 * the process instead of surfacing on the first query.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Invalid environment configuration:\n${details}\n\nCompare .env against .env.example.`,
    );
  }

  return result.data;
}
