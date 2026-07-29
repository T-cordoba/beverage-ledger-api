import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ActivityQueryDto,
  ActivityReportDto,
  ConsumptionQueryDto,
  ConsumptionReportDto,
  ReportRangeDto,
  ReportRangeEchoDto,
  SummaryReportDto,
} from './dto/report.dto';
import { ReportsRepository } from './repositories/reports.repository';

const DEFAULT_RANGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(private readonly reports: ReportsRepository) {}

  async summary(query: ReportRangeDto): Promise<SummaryReportDto> {
    const range = this.resolveRange(query);

    // The range totals and the catalogue snapshot answer different questions —
    // what happened, and where things stand — so they are two queries, not a join.
    const [totals, snapshot] = await Promise.all([
      this.reports.summary(range.from, range.to),
      this.reports.catalogueSnapshot(),
    ]);

    return { range, ...totals, ...snapshot };
  }

  async consumption(query: ConsumptionQueryDto): Promise<ConsumptionReportDto> {
    const range = this.resolveRange(query);
    const data = await this.reports.consumption(range.from, range.to, query.groupBy, query.limit);

    return { range, groupBy: query.groupBy, data };
  }

  async activity(query: ActivityQueryDto): Promise<ActivityReportDto> {
    const range = this.resolveRange(query);
    const data = await this.reports.activity(range.from, range.to, query.granularity);

    return { range, granularity: query.granularity, data };
  }

  /** @throws {BadRequestException} when the range reads backwards. */
  private resolveRange(query: ReportRangeDto): ReportRangeEchoDto {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);

    if (from > to) {
      throw new BadRequestException('The range starts after it ends');
    }

    return { from, to };
  }
}
