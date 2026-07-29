import type { UserRole } from '../../generated/prisma/enums';

/**
 * Claims are short because the token travels on every request. `role` and `org`
 * are carried for diagnostics; authorization still re-reads the user, since a
 * role change must not wait for the token to expire.
 */
export interface JwtPayload {
  sub: string;
  org: string;
  role: UserRole;
  email: string;
}
