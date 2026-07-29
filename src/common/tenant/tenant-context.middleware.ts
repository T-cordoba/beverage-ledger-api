import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantContextService } from './tenant-context.service';

/** Opens the async context every request runs inside. See TenantContextService. */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenant: TenantContextService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    this.tenant.run(request.ip, next);
  }
}
