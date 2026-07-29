import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantContextService } from '../tenant/tenant-context.service';

/**
 * Global guard: every route requires a valid access token unless marked
 * `@Public()`.
 *
 * It is also what populates the tenant context, so no repository can run a query
 * without an organization to scope it to.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenant: TenantContextService,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    await super.canActivate(context);

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser;

    this.tenant.set({
      organizationId: user.organizationId,
      userId: user.id,
      role: user.role,
    });

    return true;
  }
}
