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

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  API_PREFIX: z.string().min(1).default('api/v1'),

  /** Runtime connection, through the transaction-mode pooler. */
  DATABASE_URL: postgresUrl('DATABASE_URL'),
  /** Migration connection. A transaction-mode pooler cannot run migrations. */
  DIRECT_URL: postgresUrl('DIRECT_URL'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  SWAGGER_ENABLED: booleanFromEnv('true'),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
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
