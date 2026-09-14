import { BadRequestException } from '@nestjs/common';
import type { ReportRangeDto, ReportRangeEchoDto } from './dto/report.dto';

const DEFAULT_RANGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** @throws {BadRequestException} when the range reads backwards. */
export function resolveRange(query: ReportRangeDto): ReportRangeEchoDto {
  const to = query.to ?? new Date();
  const from = query.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);

  if (from > to) {
    throw new BadRequestException('The range starts after it ends');
  }

  return { from, to };
}
