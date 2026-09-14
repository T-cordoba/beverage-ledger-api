import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { permissionsFor } from '../../common/permissions/permissions.config';
import type { UserCredentials } from './repositories/auth.repository';

/** The credential row as the rest of the request sees it: permissions, no secrets. */
export function toAuthenticatedUser(user: UserCredentials): AuthenticatedUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: permissionsFor(user.role),
    avatarUrl: user.avatarUrl,
    status: user.status,
  };
}
