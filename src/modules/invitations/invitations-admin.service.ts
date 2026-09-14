import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { skipOf, toPage } from '../../common/dto/paginate';
import type { PagePaginationDto } from '../../common/dto/pagination.dto';
import { ASSIGNABLE_ROLES } from '../../common/permissions/permissions.config';
import { createOpaqueToken, fingerprint } from '../../common/utils/opaque-token';
import type { AppConfig } from '../../config/configuration';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import type {
  CreateInvitationDto,
  InvitationPageDto,
  IssuedInvitationDto,
} from './dto/invitation.dto';
import { InvitationsRepository } from './repositories/invitations.repository';

/**
 * Long enough to survive a weekend and a forwarded message, short enough that a
 * link found in an old chat is already dead.
 */
const VALID_FOR_DAYS = 7;

/**
 * The administrator's half of an invitation: handing one out, listing what is
 * outstanding and taking one back. Redeeming it is a stranger's business and
 * lives in InvitationsService, behind no guard at all.
 */
@Injectable()
export class InvitationsAdminService {
  private readonly frontendUrl: string;

  constructor(
    private readonly invitations: InvitationsRepository,
    private readonly audit: AuditService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.frontendUrl = config.get('frontendUrl', { infer: true });
  }

  async list(query: PagePaginationDto): Promise<InvitationPageDto> {
    const { rows, total } = await this.invitations.findPage(skipOf(query), query.pageSize);
    return toPage(rows, total, query);
  }

  /**
   * Issues one, and returns the only copy of its link that will ever exist.
   *
   * @throws {ForbiddenException} on a role an admin may not hand out.
   * @throws {ConflictException} when the address is already a member or already
   * holds an invitation that has not been used.
   */
  async create(actor: AuthenticatedUser, dto: CreateInvitationDto): Promise<IssuedInvitationDto> {
    if (!ASSIGNABLE_ROLES.includes(dto.role)) {
      throw new ForbiddenException('That role cannot be assigned');
    }

    if (await this.invitations.userExists(actor.organizationId, dto.email)) {
      throw new ConflictException('That email already belongs to a member');
    }

    if (await this.invitations.hasPendingFor(dto.email)) {
      throw new ConflictException('That email already has an invitation waiting');
    }

    const token = createOpaqueToken();

    const invitation = await this.invitations.create({
      email: dto.email,
      role: dto.role,
      tokenHash: fingerprint(token),
      expiresAt: new Date(Date.now() + VALID_FOR_DAYS * 24 * 60 * 60 * 1000),
      invitedByUserId: actor.id,
    });

    await this.audit.record({
      action: AuditAction.InvitationCreated,
      entity: AuditEntity.Invitation,
      entityId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role },
    });

    return { invitation, acceptUrl: `${this.frontendUrl}/invite/${token}` };
  }

  /** @throws {NotFoundException} on an id that is not this organization's. */
  async revoke(id: string): Promise<void> {
    const invitation = await this.invitations.findById(id);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (!(await this.invitations.revoke(id))) {
      throw new ConflictException('That invitation has already been used or revoked');
    }

    await this.audit.record({
      action: AuditAction.InvitationRevoked,
      entity: AuditEntity.Invitation,
      entityId: id,
      metadata: { email: invitation.email },
    });
  }
}
