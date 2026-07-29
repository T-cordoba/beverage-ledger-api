import { ApiProperty } from '@nestjs/swagger';

class HealthDependenciesDto {
  @ApiProperty({ enum: ['up', 'down'] })
  database!: 'up' | 'down';
}

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @ApiProperty({ description: 'Seconds since the process started' })
  uptimeSeconds!: number;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;

  @ApiProperty({ type: HealthDependenciesDto })
  dependencies!: HealthDependenciesDto;
}
