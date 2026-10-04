import type { AddressInfo } from 'node:net';
import {
  type INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { expect } from 'vitest';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/common/guards/permissions.guard';
import { TenantContextMiddleware } from '../../src/common/tenant/tenant-context.middleware';
import { TenantContextService } from '../../src/common/tenant/tenant-context.service';
import { PrismaService } from '../../src/infra/prisma/prisma.service';
import { AuditService } from '../../src/modules/audit/audit.service';
import { AuditRepository } from '../../src/modules/audit/repositories/audit.repository';
import { AuthService } from '../../src/modules/auth/auth.service';
import { CredentialsService } from '../../src/modules/auth/credentials.service';
import { AuthRepository } from '../../src/modules/auth/repositories/auth.repository';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import { TokenService } from '../../src/modules/auth/token.service';
import { ProductsService } from '../../src/modules/catalog/products.service';
import { ProductsRepository } from '../../src/modules/catalog/repositories/products.repository';
import { DocumentsController } from '../../src/modules/documents/documents.controller';
import { DocumentsService } from '../../src/modules/documents/documents.service';
import { MovementPdfService } from '../../src/modules/documents/movement-pdf.service';
import { LocationsService } from '../../src/modules/inventory/locations.service';
import { MovementsController } from '../../src/modules/inventory/movements.controller';
import { MovementsService } from '../../src/modules/inventory/movements.service';
import { LocationsRepository } from '../../src/modules/inventory/repositories/locations.repository';
import { MovementsRepository } from '../../src/modules/inventory/repositories/movements.repository';
import { StockRepository } from '../../src/modules/inventory/repositories/stock.repository';
import { OrganizationsRepository } from '../../src/modules/organizations/repositories/organizations.repository';
import { OrganizationsService } from '../../src/modules/organizations/organizations.service';
import { FAKE_PASSWORD_HASH, FakePrisma, type TestUser } from './fake-prisma';

export const API_PREFIX = '/api/v1';

/** Signing key of the suite. Asserted absent from every error body. */
export const TEST_JWT_SECRET = 'security-suite-signing-key-7f3a9c1e5b2d8a4f6e0c';

/** A connection string an infrastructure error might carry. Must never reach a client. */
export const FAKE_DATABASE_URL = 'postgresql://ledger_admin:Sup3rS3cretDbPass@db.internal:5432/ledger';

/**
 * Boots MovementsController and DocumentsController with the production
 * security stack:
 *
 * - the REAL JwtAuthGuard + JwtStrategy (passport-jwt, HS256 signature,
 *   expiration) and the REAL AuthService.resolveTokenSubject, which re-reads the
 *   user on every request;
 * - the REAL PermissionsGuard and permission matrix;
 * - the REAL services and repositories, so tenant scoping is production code;
 * - the same helmet, cookie-parser, ValidationPipe and AllExceptionsFilter as
 *   main.ts, with isProduction = true as on the deployed API.
 *
 * Only PrismaService is replaced (support/fake-prisma.ts).
 */
function buildModule(prisma: FakePrisma) {
  const config = {
    get: (key: string) => (key === 'jwt' ? { secret: TEST_JWT_SECRET } : undefined),
  };

  @Module({
    controllers: [MovementsController, DocumentsController],
    providers: [
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: config },
      TenantContextService,
      AuthRepository,
      AuthService,
      // resolveTokenSubject, the only AuthService method a request touches,
      // does not use these two.
      { provide: TokenService, useValue: {} },
      { provide: CredentialsService, useValue: {} },
      JwtStrategy,
      MovementsRepository,
      StockRepository,
      LocationsRepository,
      ProductsRepository,
      OrganizationsRepository,
      AuditRepository,
      MovementsService,
      LocationsService,
      ProductsService,
      AuditService,
      OrganizationsService,
      DocumentsService,
      MovementPdfService,
      // Same order as AppModule: authenticate, then authorize.
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: PermissionsGuard },
    ],
  })
  class SecurityTestingModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
      consumer.apply(TenantContextMiddleware).forRoutes('{*splat}');
    }
  }

  return SecurityTestingModule;
}

export interface SecurityTestApp {
  app: INestApplication;
  prisma: FakePrisma;
  baseUrl: string;
  close(): Promise<void>;
}

export async function startSecurityTestApp(): Promise<SecurityTestApp> {
  const prisma = new FakePrisma();
  const app = await NestFactory.create(buildModule(prisma), { logger: false });

  // Mirrors main.ts bootstrap, in the same order.
  app.setGlobalPrefix(API_PREFIX.slice(1));
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(true));

  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;

  return {
    app,
    prisma,
    baseUrl: `http://127.0.0.1:${port}${API_PREFIX}`,
    close: () => app.close(),
  };
}

// ---------------------------------------------------------------- tokens

const signer = new JwtService({ secret: TEST_JWT_SECRET });

const claimsOf = (user: TestUser) => ({
  sub: user.id,
  org: user.organizationId,
  role: user.role,
  email: user.email,
});

/** A genuine access token, exactly what TokenService would issue. */
export function tokenFor(user: TestUser, overrides: Record<string, unknown> = {}): string {
  return signer.sign({ ...claimsOf(user), ...overrides }, { expiresIn: 900 });
}

export function expiredTokenFor(user: TestUser): string {
  const now = Math.floor(Date.now() / 1000);
  return signer.sign({ ...claimsOf(user), iat: now - 3600, exp: now - 60 });
}

export function tokenSignedWithWrongSecret(user: TestUser): string {
  return new JwtService({ secret: 'an-attacker-guessed-this-secret' }).sign(claimsOf(user), {
    expiresIn: 900,
  });
}

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** `alg: none`: an unsigned token claiming to be a manager. */
export function unsignedNoneAlgToken(user: TestUser): string {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ ...claimsOf(user), iat: now, exp: now + 900 })}.`;
}

/** A real token whose payload was swapped for another user's, keeping the original signature. */
export function tamperedToken(signedAs: TestUser, claimsOfUser: TestUser): string {
  const [header, , signature] = tokenFor(signedAs).split('.');
  const now = Math.floor(Date.now() / 1000);
  return `${header}.${b64url({ ...claimsOf(claimsOfUser), iat: now, exp: now + 900 })}.${signature}`;
}

// ---------------------------------------------------------------- http

export interface HttpResult {
  status: number;
  headers: Headers;
  text: string;
  /** Parsed whenever the body is JSON, whatever the Content-Type says. */
  json: any;
  raw: Buffer;
}

export interface RequestOptions {
  token?: string;
  headers?: Record<string, string>;
  body?: unknown;
  /** Sent verbatim, for malformed payloads. */
  rawBody?: string;
}

export function httpClient(baseUrl: string) {
  async function request(method: string, path: string, options: RequestOptions = {}): Promise<HttpResult> {
    const headers: Record<string, string> = { ...(options.headers ?? {}) };

    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }
    if (options.body !== undefined || options.rawBody !== undefined) {
      headers['content-type'] ??= 'application/json';
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });

    const raw = Buffer.from(await response.arrayBuffer());
    const text = raw.toString('utf8');
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }

    return { status: response.status, headers: response.headers, text, json, raw };
  }

  return {
    request,
    get: (path: string, options?: RequestOptions) => request('GET', path, options),
    post: (path: string, options?: RequestOptions) => request('POST', path, options),
    patch: (path: string, options?: RequestOptions) => request('PATCH', path, options),
  };
}

export type HttpClient = ReturnType<typeof httpClient>;

/** Creates a draft and confirms it with the same token, failing loudly otherwise. */
export async function createConfirmed(client: HttpClient, token: string, body: unknown) {
  const created = await client.post('/movements', { token, body });
  if (created.status !== 201) throw new Error(`create failed: ${created.status} ${created.text}`);

  const confirmed = await client.post(`/movements/${created.json.id}/confirm`, { token });
  if (confirmed.status !== 201) throw new Error(`confirm failed: ${confirmed.status} ${confirmed.text}`);

  return confirmed.json;
}

export async function createDraft(client: HttpClient, token: string, body: unknown) {
  const created = await client.post('/movements', { token, body });
  if (created.status !== 201) throw new Error(`create failed: ${created.status} ${created.text}`);
  return created.json;
}

// ---------------------------------------------------------------- assertions

/**
 * An error response must not carry internals: stack frames, the JWT secret, a
 * connection string, environment variable names, credential hashes or source
 * paths.
 */
export function expectNoSensitiveData(result: HttpResult): void {
  const body = result.text;

  expect(body).not.toMatch(/"stack"\s*:/);
  expect(body).not.toMatch(/\n\s+at\s.+\(.+:\d+:\d+\)/);
  expect(body).not.toContain(TEST_JWT_SECRET);
  expect(body).not.toContain(FAKE_DATABASE_URL);
  expect(body).not.toMatch(/postgres(ql)?:\/\//i);
  expect(body).not.toMatch(/DATABASE_URL|JWT_SECRET|GOOGLE_CLIENT_SECRET/);
  expect(body).not.toContain(FAKE_PASSWORD_HASH);
  expect(body).not.toMatch(/passwordHash/);
  expect(body).not.toMatch(/node_modules|[\\/]src[\\/]/);
}

/** Uniform error contract of AllExceptionsFilter and nothing else. */
export function expectErrorShape(result: HttpResult, status: number): void {
  expect(result.status).toBe(status);
  expect(result.json).toBeTypeOf('object');
  expect(Object.keys(result.json).sort()).toEqual(['error', 'message', 'path', 'statusCode', 'timestamp']);
  expectNoSensitiveData(result);
}

export const isPdf = (raw: Buffer): boolean => raw.subarray(0, 5).toString('latin1') === '%PDF-';
