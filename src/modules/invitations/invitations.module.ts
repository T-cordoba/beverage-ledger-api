import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InvitationsAdminService } from './invitations-admin.service';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { InvitationsRepository } from './repositories/invitations.repository';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationsAdminService, InvitationsRepository],
})
export class InvitationsModule {}
