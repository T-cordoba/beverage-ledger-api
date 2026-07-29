/**
 * Far stricter than the global limit: these are the endpoints worth guessing at.
 *
 * Not read from the environment because `@Throttle` is decorator metadata,
 * evaluated when the class is defined — before there is a ConfigService to ask.
 */
export const AUTH_THROTTLE = { limit: 10, ttl: 60_000 };
