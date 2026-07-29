import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import type { AppConfig } from '../../config/configuration';

/**
 * Único punto de acceso a la base de datos. Solo los repositorios lo inyectan;
 * los services trabajan contra repositorios, nunca contra Prisma directamente.
 *
 * Prisma 7 exige un driver adapter: el cliente en runtime va por DATABASE_URL
 * (pooler en modo transacción) mientras que las migraciones usan DIRECT_URL
 * desde prisma.config.ts.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<AppConfig, true>) {
    const { url } = config.get('database', { infer: true });
    const isProduction = config.get('isProduction', { infer: true });

    super({
      adapter: new PrismaPg({ connectionString: url }),
      log: isProduction ? ['warn', 'error'] : ['warn', 'error', 'info'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado a la base de datos');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Comprobación de conectividad para el endpoint de salud. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Fallo la comprobacion de salud de la base de datos', error);
      return false;
    }
  }
}
