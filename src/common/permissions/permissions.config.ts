import { MovementType, UserRole } from '../../generated/prisma/enums';

/**
 * Every action the API authorizes, named `<resource>:<action>`.
 *
 * Guards reference these, never a role. When the SaaS needs per-organization
 * roles, only the matrix below changes.
 */
export enum Permission {
  MovementReadAll = 'movement:read',
  MovementCreateOutbound = 'movement:create-outbound',
  MovementCreateInbound = 'movement:create-inbound',
  MovementCreateAdjustment = 'movement:create-adjustment',
  MovementCancel = 'movement:cancel',

  StockRead = 'stock:read',
  ReportRead = 'report:read',

  CatalogManage = 'catalog:manage',
  UserManage = 'user:manage',
  OrganizationManage = 'organization:manage',
  AuditLogRead = 'audit:read',
}

/**
 * Built by widening the role below it, which is what segregation of duties
 * means here: an operator moves stock, a manager also corrects the numbers, and
 * only an admin changes the catalogue those numbers refer to.
 */
const OPERATOR: readonly Permission[] = [
  Permission.MovementReadAll,
  Permission.MovementCreateOutbound,
  Permission.StockRead,
];

const MANAGER: readonly Permission[] = [
  ...OPERATOR,
  Permission.MovementCreateInbound,
  Permission.MovementCreateAdjustment,
  Permission.MovementCancel,
  Permission.ReportRead,
];

const ORG_ADMIN: readonly Permission[] = [
  ...MANAGER,
  Permission.CatalogManage,
  Permission.UserManage,
  Permission.OrganizationManage,
  Permission.AuditLogRead,
];

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  [UserRole.OPERATOR]: OPERATOR,
  [UserRole.MANAGER]: MANAGER,
  [UserRole.ORG_ADMIN]: ORG_ADMIN,
  [UserRole.PLATFORM_ADMIN]: Object.values(Permission),
};

/**
 * Which permission each kind of movement demands.
 *
 * Lives here and not in a controller decorator because the answer depends on the
 * record: confirming a movement created yesterday has to check the type stored on
 * it, which no static decorator can see.
 */
export const MOVEMENT_PERMISSION: Readonly<Record<MovementType, Permission>> = {
  [MovementType.INBOUND]: Permission.MovementCreateInbound,
  [MovementType.OUTBOUND]: Permission.MovementCreateOutbound,
  [MovementType.ADJUSTMENT]: Permission.MovementCreateAdjustment,
};

/** Roles an ORG_ADMIN may hand out. PLATFORM_ADMIN is not one of them. */
export const ASSIGNABLE_ROLES: readonly UserRole[] = [
  UserRole.OPERATOR,
  UserRole.MANAGER,
  UserRole.ORG_ADMIN,
];

export function permissionsFor(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
