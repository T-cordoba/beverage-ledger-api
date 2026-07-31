import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TenantModule } from './common/tenant/tenant.module';
import { configuration, type AppConfig } from './config/configuration';
import { PrismaModule } from './infra/prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { ttlSeconds, limit } = config.get('throttle', { infer: true });
        return { throttlers: [{ ttl: ttlSeconds * 1000, limit }] };
      },
    }),

    PrismaModule,
    TenantModule,

    AuditModule,
    AuthModule,
    UsersModule,
    InvitationsModule,
    OrganizationsModule,
    CatalogModule,
    InventoryModule,
    DocumentsModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    // Order matters: rate limit before authenticating, authenticate before
    // authorizing. Authentication is global so a new route is protected unless it
    // says otherwise with @Public().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
