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
import { AuditService } from './audit.service';
import { AuditLogPageDto, ListAuditLogsDto } from './dto/audit-log.dto';

@ApiTags('audit')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(Permission.AuditLogRead)
  @ApiOperation({ summary: 'Read the audit trail' })
  @ApiOkResponse({ type: AuditLogPageDto })
  list(@Query() query: ListAuditLogsDto): Promise<AuditLogPageDto> {
    return this.audit.list(query);
  }
}
