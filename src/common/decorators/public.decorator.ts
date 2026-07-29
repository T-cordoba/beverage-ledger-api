import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/**
 * Opts a route out of the global JwtAuthGuard.
 *
 * Authentication is the default so that forgetting a decorator locks a route
 * down instead of exposing it.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
