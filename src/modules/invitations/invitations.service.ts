import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { skipOf, toPage } from '../../common/dto/paginate';
import type { PagePaginationDto } from '../../common/dto/pagination.dto';
import { ASSIGNABLE_ROLES, permissionsFor } from '../../common/permissions/permissions.config';
import { createOpaqueToken, fingerprint } from '../../common/utils/opaque-token';
import type { AppConfig } from '../../config/configuration';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import type {
  AcceptInvitationDto,
  CreateInvitationDto,
  InvitationPageDto,
  InvitationPreviewDto,
  IssuedInvitationDto,
} from './dto/invitation.dto';
import { InvitationsRepository } from './repositories/invitations.repository';

/**
 * Long enough to survive a weekend and a forwarded message, short enough that a
 * link found in an old chat is already dead.
 */
const VALID_FOR_DAYS = 7;

/** One message for every unusable token: unknown, spent, revoked or lapsed. */
const UNUSABLE = 'This invitation link is no longer valid. Ask for a new one';

@Injectable()
export class InvitationsService {
  private readonly frontendUrl: string;

  constructor(
    private readonly invitations: InvitationsRepository,
    private readonly passwords: PasswordService,
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

  /**
   * What the accept screen may show before the visitor has proven anything.
   *
   * @throws {NotFoundException} on any token that cannot be redeemed, with one
   * message for every reason: telling a stranger whether a link was revoked or
   * merely mistyped says something about an address they may not own.
   */
  async preview(token: string): Promise<InvitationPreviewDto> {
    const invitation = await this.invitations.findRedeemableByHash(fingerprint(token));

    if (!invitation) {
      throw new NotFoundException(UNUSABLE);
    }

    return {
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organizationName,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Turns an invitation into a member, and hands back who they now are so the
   * controller can open a session for them.
   *
   * The user and the stamp that spends the invitation commit together: without
   * that, a failure between the two leaves either a member nobody invited or an
   * invitation that created no one.
   *
   * @throws {NotFoundException} when the token cannot be redeemed.
   * @throws {BadRequestException} when it was redeemed by someone else first.
   */
  async accept(dto: AcceptInvitationDto): Promise<AuthenticatedUser> {
    const invitation = await this.invitations.findRedeemableByHash(fingerprint(dto.token));

    if (!invitation) {
      throw new NotFoundException(UNUSABLE);
    }

    if (await this.invitations.userExists(invitation.organizationId, invitation.email)) {
      throw new ConflictException('That email already belongs to a member');
    }

    const passwordHash = await this.passwords.hash(dto.password);

    const created = await this.invitations.runInTransaction(async (tx) => {
      if (!(await this.invitations.markAccepted(invitation.id, tx))) {
        // Someone opened the same link a moment earlier.
        throw new BadRequestException(UNUSABLE);
      }

      return this.invitations.createUser(
        {
          organizationId: invitation.organizationId,
          email: invitation.email,
          name: dto.name.trim(),
          passwordHash,
          role: invitation.role,
        },
        tx,
      );
    });

    await this.audit.record({
      action: AuditAction.InvitationAccepted,
      entity: AuditEntity.Invitation,
      entityId: invitation.id,
      organizationId: invitation.organizationId,
      userId: created.id,
      metadata: { email: created.email, role: created.role },
    });

    return {
      id: created.id,
      organizationId: created.organizationId,
      email: created.email,
      name: created.name,
      role: created.role,
      permissions: permissionsFor(created.role),
      avatarUrl: created.avatarUrl,
      status: created.status,
    };
  }
}
