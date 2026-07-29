import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Permission } from '../../common/permissions/permissions.config';
import { OrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { OrganizationsService } from './organizations.service';

/**
 * Singular on purpose: a session belongs to exactly one organization, so there is
 * no id in the path and no way to ask for somebody else's.
 *
 * The branding every screen needs already rides along on /auth/me; this is the
 * admin view, which is why it is behind organization:manage.
 */
@ApiTags('organization')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
@Controller('organization')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @RequirePermissions(Permission.OrganizationManage)
  @ApiOperation({ summary: 'Read the organization behind this session' })
  @ApiOkResponse({ type: OrganizationDto })
  current(): Promise<OrganizationDto> {
    return this.organizations.current();
  }

  @Patch()
  @RequirePermissions(Permission.OrganizationManage)
  @ApiOperation({ summary: 'Change the name, branding or time zone' })
  @ApiOkResponse({ type: OrganizationDto })
  update(@Body() dto: UpdateOrganizationDto): Promise<OrganizationDto> {
    return this.organizations.update(dto);
  }
}
