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

    frontendUrl: env.FRONTEND_URL,

    swagger: {
      enabled: env.SWAGGER_ENABLED,
    },

    throttle: {
      ttlSeconds: env.THROTTLE_TTL_SECONDS,
      limit: env.THROTTLE_LIMIT,
    },

    jwt: {
      secret: env.JWT_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },

    authCookie: {
      name: env.AUTH_COOKIE_NAME,
    },

    login: {
      maxAttempts: env.LOGIN_MAX_ATTEMPTS,
      lockoutMinutes: env.LOGIN_LOCKOUT_MINUTES,
    },

    defaultOrganizationSlug: env.DEFAULT_ORGANIZATION_SLUG,

    /** Null when no credentials are configured; the Google routes then 501. */
    google: env.GOOGLE_CLIENT_ID
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          callbackUrl: env.GOOGLE_CALLBACK_URL as string,
        }
      : null,
  };
};

export type AppConfig = ReturnType<typeof configuration>;
