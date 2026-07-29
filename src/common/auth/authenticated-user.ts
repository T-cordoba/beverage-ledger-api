import type { UserRole, UserStatus } from '../../generated/prisma/enums';
import type { Permission } from '../permissions/permissions.config';

/** What the JWT strategy attaches to the request once a token checks out. */
export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  permissions: readonly Permission[];
}
