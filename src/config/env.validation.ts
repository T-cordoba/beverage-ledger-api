import { z } from 'zod';

/**
 * `z.coerce.boolean()` no sirve aquí: Boolean('false') es true. Esto además
 * rechaza cualquier valor que no sea exactamente 'true' o 'false'.
 */
const booleanFromEnv = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

const postgresUrl = (name: string) =>
  z
    .string()
    .min(1, `${name} es obligatoria`)
    .refine((value) => value.startsWith('postgres://') || value.startsWith('postgresql://'), {
      message: `${name} debe ser una URL de PostgreSQL. Si la contraseña contiene / % @ o :, recuerda URL-encodearla`,
    });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  API_PREFIX: z.string().min(1).default('api/v1'),

  /// La usa la aplicación en runtime (pooler en modo transacción).
  DATABASE_URL: postgresUrl('DATABASE_URL'),
  /// La usa la CLI de Prisma para migrar (conexión directa o pooler en modo sesión).
  DIRECT_URL: postgresUrl('DIRECT_URL'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  SWAGGER_ENABLED: booleanFromEnv('true'),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida el entorno al arrancar y falla con un mensaje accionable.
 *
 * El proyecto anterior hacía `process.env.DATABASE_URL!`, que no fallaba al
 * arranque sino en la primera consulta y con un error indescifrable.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Configuración de entorno inválida:\n${details}\n\nCompara tu .env con .env.example.`,
    );
  }

  return result.data;
}
