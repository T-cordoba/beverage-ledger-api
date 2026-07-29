import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationsRepository } from './repositories/organizations.repository';

@Module({
  imports: [AuditModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository],
  // Documents takes the branding it prints from here, never from a constant.
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
