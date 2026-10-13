import type { AddressInfo } from 'node:net';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  type INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import type { Request } from 'express';
import { AllExceptionsFilter } from '../../../src/common/filters/all-exceptions.filter';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard';
import { permissionsFor } from '../../../src/common/permissions/permissions.config';
import { TenantContextMiddleware } from '../../../src/common/tenant/tenant-context.middleware';
import { TenantContextService } from '../../../src/common/tenant/tenant-context.service';
import { UserRole, UserStatus } from '../../../src/generated/prisma/enums';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { AuditRepository } from '../../../src/modules/audit/repositories/audit.repository';
import { ProductsService } from '../../../src/modules/catalog/products.service';
import { ProductsRepository } from '../../../src/modules/catalog/repositories/products.repository';
import { DocumentsController } from '../../../src/modules/documents/documents.controller';
import { DocumentsService } from '../../../src/modules/documents/documents.service';
import { MovementPdfService } from '../../../src/modules/documents/movement-pdf.service';
import { LocationsService } from '../../../src/modules/inventory/locations.service';
import { MovementsController } from '../../../src/modules/inventory/movements.controller';
import { MovementsService } from '../../../src/modules/inventory/movements.service';
import { LocationsRepository } from '../../../src/modules/inventory/repositories/locations.repository';
import { MovementsRepository } from '../../../src/modules/inventory/repositories/movements.repository';
import { StockRepository } from '../../../src/modules/inventory/repositories/stock.repository';
import { StockController } from '../../../src/modules/inventory/stock.controller';
import { StockService } from '../../../src/modules/inventory/stock.service';
import { OrganizationsRepository } from '../../../src/modules/organizations/repositories/organizations.repository';
import { OrganizationsService } from '../../../src/modules/organizations/organizations.service';
import { ReportsController } from '../../../src/modules/reports/reports.controller';
import { ReportsService } from '../../../src/modules/reports/reports.service';
import { ReportsRepository } from '../../../src/modules/reports/repositories/reports.repository';
import { InMemoryLedger, ORGANIZATION_ID, USERS } from './in-memory-ledger';

/** Same prefix the deployed API uses (API_PREFIX=api/v1). */
export const API_PREFIX = '/api/v1';

/** Header the test guard reads instead of a signed JWT. */
export const ROLE_HEADER = 'x-test-role';

/**
 * Stands in for JwtAuthGuard: no token, no access (401), exactly like the real
 * guard, and it fills the request user and the tenant context the same way.
 * Signing real JWTs would only test passport, which is not in scope here.
 */
@Injectable()
class TestAuthGuard implements CanActivate {
  constructor(private readonly tenant: TenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const role = request.header(ROLE_HEADER) as UserRole | undefined;

    if (!role || !(role in USERS)) {
      throw new UnauthorizedException();
    }

    const user = USERS[role as keyof typeof USERS];

    request.user = {
      id: user.id,
      organizationId: ORGANIZATION_ID,
      email: `${role.toLowerCase()}@example.com`,
      name: user.name,
      avatarUrl: null,
      role,
      status: UserStatus.ACTIVE,
      permissions: permissionsFor(role),
    };

    this.tenant.set({ organizationId: ORGANIZATION_ID, userId: user.id, role });

    return true;
  }
}

function repositoriesOf(ledger: InMemoryLedger) {
  return {
    movements: ledger.movementsRepository(),
    stock: ledger.stockRepository(),
    locations: ledger.locationsRepository(),
    products: ledger.productsRepository(),
    reports: ledger.reportsRepository(),
    organizations: ledger.organizationsRepository(),
    audit: ledger.auditRepository(),
  };
}

export type FakeRepositories = ReturnType<typeof repositoriesOf>;

function buildModule(repositories: FakeRepositories) {
  @Module({
    controllers: [MovementsController, DocumentsController, StockController, ReportsController],
    providers: [
      TenantContextService,
      MovementsService,
      LocationsService,
      ProductsService,
      AuditService,
      OrganizationsService,
      DocumentsService,
      MovementPdfService,
      StockService,
      ReportsService,
      { provide: MovementsRepository, useValue: repositories.movements },
      { provide: StockRepository, useValue: repositories.stock },
      { provide: LocationsRepository, useValue: repositories.locations },
      { provide: ProductsRepository, useValue: repositories.products },
      { provide: ReportsRepository, useValue: repositories.reports },
      { provide: OrganizationsRepository, useValue: repositories.organizations },
      { provide: AuditRepository, useValue: repositories.audit },
      // Same order as AppModule: authenticate, then authorize.
      { provide: APP_GUARD, useClass: TestAuthGuard },
      { provide: APP_GUARD, useClass: PermissionsGuard },
    ],
  })
  class ApiTestingModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
      consumer.apply(TenantContextMiddleware).forRoutes('{*splat}');
    }
  }

  return ApiTestingModule;
}

export interface ApiTestApp {
  app: INestApplication;
  ledger: InMemoryLedger;
  /** The exact objects Nest injected, so a test can spy on what reached a repository. */
  repositories: FakeRepositories;
  baseUrl: string;
  close(): Promise<void>;
}

/**
 * Boots the HTTP API on an ephemeral port with the same global pipe, filter and
 * prefix as main.ts, so status codes and error bodies are the production ones.
 */
export async function startApiTestApp(): Promise<ApiTestApp> {
  const ledger = new InMemoryLedger();
  const repositories = repositoriesOf(ledger);
  const app = await NestFactory.create(buildModule(repositories), { logger: false });

  app.setGlobalPrefix(API_PREFIX.slice(1));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(false));

  await app.listen(0, '127.0.0.1');

  // Node closes idle keep-alive sockets after 5s. Rendering a PDF blocks this
  // same event loop for longer under coverage, and the next fetch then reuses a
  // socket the server is closing: ECONNRESET. Only the client may close them here.
  const server = app.getHttpServer();
  server.keepAliveTimeout = 60_000;

  const { port } = server.address() as AddressInfo;

  return {
    app,
    ledger,
    repositories,
    baseUrl: `http://127.0.0.1:${port}${API_PREFIX}`,
    close: () => app.close(),
  };
}

export interface ApiResponse<T = any> {
  status: number;
  headers: Headers;
  body: T;
  raw: Buffer;
}

/** Thin fetch wrapper: JSON in, JSON (or bytes) out, role as a header. */
export function apiClient(baseUrl: string) {
  async function send<T>(
    method: string,
    path: string,
    options: { role?: UserRole | null; body?: unknown } = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {};
    const role = options.role === undefined ? UserRole.MANAGER : options.role;

    if (role) {
      headers[ROLE_HEADER] = role;
    }
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const raw = Buffer.from(await response.arrayBuffer());
    const isJson = response.headers.get('content-type')?.includes('application/json');

    return {
      status: response.status,
      headers: response.headers,
      body: (isJson ? JSON.parse(raw.toString('utf8')) : undefined) as T,
      raw,
    };
  }

  return {
    get: <T = any>(path: string, role?: UserRole | null) => send<T>('GET', path, { role }),
    post: <T = any>(path: string, body?: unknown, role?: UserRole | null) =>
      send<T>('POST', path, { body, role }),
    patch: <T = any>(path: string, body?: unknown, role?: UserRole | null) =>
      send<T>('PATCH', path, { body, role }),
  };
}

export type ApiClient = ReturnType<typeof apiClient>;

/** Creates a draft and confirms it, failing loudly if either step is refused. */
export async function registerConfirmed(
  client: ApiClient,
  body: Record<string, unknown>,
  role: UserRole = UserRole.MANAGER,
) {
  const created = await client.post('/movements', body, role);
  if (created.status !== 201) {
    throw new Error(`create failed: ${created.status} ${JSON.stringify(created.body)}`);
  }

  const confirmed = await client.post(`/movements/${created.body.id}/confirm`, undefined, role);
  if (confirmed.status !== 201) {
    throw new Error(`confirm failed: ${confirmed.status} ${JSON.stringify(confirmed.body)}`);
  }

  return confirmed.body;
}
