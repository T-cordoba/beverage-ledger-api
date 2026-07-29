import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TenantModule } from './common/tenant/tenant.module';
import { configuration, type AppConfig } from './config/configuration';
import { PrismaModule } from './infra/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // La validación vive dentro de configuration(): si el entorno está mal,
      // el proceso no arranca.
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

    HealthModule,
  ],
  providers: [
    // Rate limiting global. Los endpoints de autenticación llevarán además
    // límites más estrictos propios (Fase 2).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
