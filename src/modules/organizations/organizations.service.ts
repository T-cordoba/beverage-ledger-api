import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type { OrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { OrganizationsRepository } from './repositories/organizations.repository';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizations: OrganizationsRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * The row every document and screen takes its branding from.
   *
   * @throws {NotFoundException} when the organization behind a live session has
   * been deleted.
   */
  async current(): Promise<OrganizationDto> {
    const organization = await this.organizations.findCurrent();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(dto: UpdateOrganizationDto): Promise<OrganizationDto> {
    const before = await this.current();
    const updated = await this.organizations.update(dto);

    await this.audit.record({
      action: AuditAction.OrganizationUpdated,
      entity: AuditEntity.Organization,
      entityId: updated.id,
      metadata: {
        nameFrom: dto.name ? before.name : undefined,
        nameTo: dto.name,
        timezoneFrom: dto.timezone ? before.timezone : undefined,
        timezoneTo: dto.timezone,
      },
    });

    return updated;
  }
}
