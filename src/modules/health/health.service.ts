import { HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { HealthResponseDto } from './dto/health-response.dto';

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponseDto> {
    const databaseUp = await this.prisma.isHealthy();

    const body: HealthResponseDto = {
      status: databaseUp ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      dependencies: {
        database: databaseUp ? 'up' : 'down',
      },
    };

    // Un balanceador debe poder distinguir "vivo" de "utilizable" por el código HTTP.
    if (!databaseUp) {
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: 'La base de datos no responde',
        ...body,
      });
    }

    return body;
  }
}
