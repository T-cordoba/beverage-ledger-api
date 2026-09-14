import { Injectable } from '@nestjs/common';
import type {
  ActivityQueryDto,
  ActivityReportDto,
  ConsumptionQueryDto,
  ConsumptionReportDto,
  ReportRangeDto,
  SummaryReportDto,
} from './dto/report.dto';
import { resolveRange } from './report-range';
import { ReportsRepository } from './repositories/reports.repository';

@Injectable()
export class ReportsService {
  constructor(private readonly reports: ReportsRepository) {}

  async summary(query: ReportRangeDto): Promise<SummaryReportDto> {
    const range = resolveRange(query);

    // The range totals and the catalogue snapshot answer different questions —
    // what happened, and where things stand — so they are two queries, not a join.
    const [totals, snapshot] = await Promise.all([
      this.reports.summary(range.from, range.to),
      this.reports.catalogueSnapshot(),
    ]);

    return { range, ...totals, ...snapshot };
  }

  async consumption(query: ConsumptionQueryDto): Promise<ConsumptionReportDto> {
    const range = resolveRange(query);
    const data = await this.reports.consumption(range.from, range.to, query.groupBy, query.limit);

    return { range, groupBy: query.groupBy, data };
  }

  async activity(query: ActivityQueryDto): Promise<ActivityReportDto> {
    const range = resolveRange(query);
    const data = await this.reports.activity(range.from, range.to, query.granularity);

    return { range, granularity: query.granularity, data };
  }
}
