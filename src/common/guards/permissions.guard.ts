import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { Permission, roleHasPermission } from '../permissions/permissions.config';

/**
 * Reads the permission matrix, never a role.
 *
 * Global, but a no-op on routes without `@RequirePermissions()`: authentication
 * alone is enough for anything every role can do.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const allowed = required.every((permission) => roleHasPermission(user.role, permission));

    if (!allowed) {
      // Deliberately vague: naming the missing permission maps the API's
      // authorization model for anyone probing it.
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
