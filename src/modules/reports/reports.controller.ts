import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Permission } from '../../common/permissions/permissions.config';
import {
  ActivityQueryDto,
  ActivityReportDto,
  ConsumptionQueryDto,
  ConsumptionReportDto,
  ReportRangeDto,
  SummaryReportDto,
} from './dto/report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @RequirePermissions(Permission.ReportRead)
  @ApiOperation({ summary: 'Headline figures for a range, plus where the catalogue stands now' })
  @ApiOkResponse({ type: SummaryReportDto })
  summary(@Query() query: ReportRangeDto): Promise<SummaryReportDto> {
    return this.reports.summary(query);
  }

  @Get('consumption')
  @RequirePermissions(Permission.ReportRead)
  @ApiOperation({ summary: 'What was dispatched in a range, by product, category or brand' })
  @ApiOkResponse({ type: ConsumptionReportDto })
  consumption(@Query() query: ConsumptionQueryDto): Promise<ConsumptionReportDto> {
    return this.reports.consumption(query);
  }

  @Get('activity')
  @RequirePermissions(Permission.ReportRead)
  @ApiOperation({ summary: 'Movement volume over time, bucketed in the organization timezone' })
  @ApiOkResponse({ type: ActivityReportDto })
  activity(@Query() query: ActivityQueryDto): Promise<ActivityReportDto> {
    return this.reports.activity(query);
  }
}
