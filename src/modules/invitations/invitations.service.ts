import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { permissionsFor } from '../../common/permissions/permissions.config';
import { fingerprint } from '../../common/utils/opaque-token';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import type { AcceptInvitationDto, InvitationPreviewDto } from './dto/invitation.dto';
import { InvitationsRepository } from './repositories/invitations.repository';

/** One message for every unusable token: unknown, spent, revoked or lapsed. */
const UNUSABLE = 'This invitation link is no longer valid. Ask for a new one';

/**
 * The invited stranger's half: reading what a link offers and redeeming it.
 * Both routes are public, which is why handing links out lives apart, in
 * InvitationsAdminService.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitations: InvitationsRepository,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

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
