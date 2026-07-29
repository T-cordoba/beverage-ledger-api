import { validateEnv } from './env.validation';

const parseList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** Single source of configuration. No other module reads `process.env`. */
export const configuration = () => {
  const env = validateEnv(process.env);

  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    apiPrefix: env.API_PREFIX,

    database: {
      url: env.DATABASE_URL,
    },

    cors: {
      origins: parseList(env.CORS_ORIGINS),
    },

    swagger: {
      enabled: env.SWAGGER_ENABLED,
    },

    throttle: {
      ttlSeconds: env.THROTTLE_TTL_SECONDS,
      limit: env.THROTTLE_LIMIT,
    },
  };
};

export type AppConfig = ReturnType<typeof configuration>;
