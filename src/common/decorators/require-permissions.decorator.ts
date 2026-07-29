import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions/permissions.config';

export const PERMISSIONS_KEY = 'auth:permissions';

/** All listed permissions are required, not any of them. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
