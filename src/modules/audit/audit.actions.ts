/**
 * Every audited action, named `<entity>.<verb>`.
 *
 * Declared here rather than written as literals at the call sites: the audit log
 * is only searchable if the same event always carries the same name.
 */
export const AuditAction = {
  UserSignedIn: 'user.signed-in',
  UserSignInFailed: 'user.sign-in-failed',
  UserRegistered: 'user.registered',
  UserPasswordChanged: 'user.password-changed',
  UserCreated: 'user.created',
  UserUpdated: 'user.updated',

  OrganizationUpdated: 'organization.updated',

  CategoryCreated: 'category.created',
  CategoryUpdated: 'category.updated',
  CategoryDeleted: 'category.deleted',
  BrandCreated: 'brand.created',
  BrandUpdated: 'brand.updated',
  BrandDeleted: 'brand.deleted',
  ProductCreated: 'product.created',
  ProductUpdated: 'product.updated',
  ProductDeactivated: 'product.deactivated',

  MovementCreated: 'movement.created',
  MovementUpdated: 'movement.updated',
  MovementConfirmed: 'movement.confirmed',
  MovementCancelled: 'movement.cancelled',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntity = {
  User: 'user',
  Organization: 'organization',
  Category: 'category',
  Brand: 'brand',
  Product: 'product',
  Movement: 'movement',
} as const;

export type AuditEntity = (typeof AuditEntity)[keyof typeof AuditEntity];
