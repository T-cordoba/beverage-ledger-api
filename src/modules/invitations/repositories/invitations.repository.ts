import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { UserRole, UserStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { PrismaTransaction } from '../../../infra/prisma/transaction';
import type { InvitationDto } from '../dto/invitation.dto';

const INVITATION = {
  id: true,
  email: true,
  role: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
  invitedBy: { select: { name: true } },
} as const;

interface InvitationRow {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  invitedBy: { name: string };
}

const toDto = (row: InvitationRow): InvitationDto => ({
  id: row.id,
  email: row.email,
  role: row.role,
  expiresAt: row.expiresAt,
  acceptedAt: row.acceptedAt,
  revokedAt: row.revokedAt,
  invitedByName: row.invitedBy.name,
  createdAt: row.createdAt,
});

/** An invitation nobody has used, revoked or let lapse. */
export interface RedeemableInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  organizationName: string;
  expiresAt: Date;
}

@Injectable()
export class InvitationsRepository extends BaseRepository {
  constructor(prisma: PrismaService, tenant: TenantContextService) {
    super(prisma, tenant);
  }

  /** Rows and total in one round trip, both taken from the same `where`. */
  async findPage(skip: number, take: number): Promise<{ rows: InvitationDto[]; total: number }> {
    const where = this.scopedWhere();

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invitation.findMany({
        where,
        select: INVITATION,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.invitation.count({ where }),
    ]);

    return { rows: rows.map(toDto), total };
  }

  async findById(id: string): Promise<InvitationDto | null> {
    const row = await this.prisma.invitation.findFirst({
      where: this.scopedWhere({ id }),
      select: INVITATION,
    });

    return row ? toDto(row) : null;
  }

  /**
   * Resolves a token to the invitation it stands for, without any organization
   * scope.
   *
   * Deliberately unscoped: the caller has no session yet, so there is no tenant
   * context to filter by — the token is the credential, and it carries which
   * organization it belongs to.
   */
  async findRedeemableByHash(tokenHash: string): Promise<RedeemableInvitation | null> {
    const row = await this.prisma.invitation.findFirst({
      where: { tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        organizationId: true,
        email: true,
        role: true,
        expiresAt: true,
        organization: { select: { name: true } },
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organizationId,
      email: row.email,
      role: row.role,
      organizationName: row.organization.name,
      expiresAt: row.expiresAt,
    };
  }

  /** Whether this email already has one outstanding, so a second is not issued. */
  async hasPendingFor(email: string): Promise<boolean> {
    const found = await this.prisma.invitation.findFirst({
      where: this.scopedWhere({
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      }),
      select: { id: true },
    });

    return found !== null;
  }

  async create(data: {
    email: string;
    role: UserRole;
    tokenHash: string;
    expiresAt: Date;
    invitedByUserId: string;
  }): Promise<InvitationDto> {
    const row = await this.prisma.invitation.create({
      data: this.scopedData(data),
      select: INVITATION,
    });

    return toDto(row);
  }

  /** updateMany, so the organization filter composes and a foreign id changes nothing. */
  async revoke(id: string): Promise<boolean> {
    const result = await this.prisma.invitation.updateMany({
      where: this.scopedWhere({ id, acceptedAt: null, revokedAt: null }),
      data: { revokedAt: new Date() },
    });

    return result.count > 0;
  }

  /**
   * Marks it used, but only if it still was.
   *
   * Compare-and-set rather than read-then-write: two browsers opening the same
   * link would otherwise both pass the check and create two accounts.
   */
  async markAccepted(id: string, tx: PrismaTransaction): Promise<boolean> {
    const result = await tx.invitation.updateMany({
      where: { id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date() },
    });

    return result.count > 0;
  }

  /** Whether that organization already has a member on this address. */
  async userExists(organizationId: string, email: string): Promise<boolean> {
    const found = await this.prisma.user.findFirst({
      where: { organizationId, email },
      select: { id: true },
    });

    return found !== null;
  }

  /**
   * Creates the member an accepted invitation stands for.
   *
   * A user write outside UsersRepository, because this is the only path that
   * writes one with no tenant context to scope by: the organization comes off
   * the invitation, which is what the token proved.
   */
  createUser(
    data: {
      organizationId: string;
      email: string;
      name: string;
      passwordHash: string;
      role: UserRole;
    },
    tx: PrismaTransaction,
  ) {
    return tx.user.create({
      data: { ...data, status: UserStatus.ACTIVE },
      select: {
        id: true,
        organizationId: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
      },
    });
  }
}
