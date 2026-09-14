import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { skipOf, toPage } from '../../common/dto/paginate';
import type { PagePaginationDto } from '../../common/dto/pagination.dto';
import { ASSIGNABLE_ROLES } from '../../common/permissions/permissions.config';
import { UserRole, UserStatus } from '../../generated/prisma/enums';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { TokenService } from '../auth/token.service';
import type { UpdateUserDto, UserDto, UserPageDto } from './dto/user.dto';
import { UsersRepository } from './repositories/users.repository';

/**
 * The member directory and its administration, behind `users:manage`. What a
 * user may change about themselves lives in ProfileService.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async list(query: PagePaginationDto): Promise<UserPageDto> {
    const { rows, total } = await this.users.findPage(skipOf(query), query.pageSize);
    return toPage(rows, total, query);
  }

  /** @throws {NotFoundException} which is also the answer for another organization's user. */
  async findOne(id: string): Promise<UserDto> {
    const user = await this.users.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * @throws {BadRequestException} when an admin changes their own role or status,
   * or when the change would leave the organization with no active admin — either
   * one locks everybody out of user management for good.
   */
  async update(actorId: string, id: string, dto: UpdateUserDto): Promise<UserDto> {
    const target = await this.users.findById(id);

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (dto.role) {
      this.assertAssignable(dto.role);
    }

    const changesAuthority = dto.role !== undefined || dto.status !== undefined;

    if (actorId === id && changesAuthority) {
      throw new BadRequestException('You cannot change your own role or status');
    }

    const losesAdmin =
      target.role === UserRole.ORG_ADMIN &&
      target.status === UserStatus.ACTIVE &&
      ((dto.role !== undefined && dto.role !== UserRole.ORG_ADMIN) ||
        (dto.status !== undefined && dto.status !== UserStatus.ACTIVE));

    if (losesAdmin && (await this.users.countAdmins()) <= 1) {
      throw new BadRequestException('The organization must keep at least one active administrator');
    }

    await this.users.update(id, dto);

    if (dto.status && dto.status !== UserStatus.ACTIVE) {
      await this.tokens.revokeAllForUser(id);
    }

    await this.audit.record({
      action: AuditAction.UserUpdated,
      entity: AuditEntity.User,
      entityId: id,
      metadata: {
        // Recording both sides is the point: a role change is the one edit an
        // auditor reconstructs after the fact.
        roleFrom: dto.role ? target.role : undefined,
        roleTo: dto.role,
        statusFrom: dto.status ? target.status : undefined,
        statusTo: dto.status,
        nameChanged: dto.name !== undefined,
      },
    });

    return this.findOne(id);
  }

  /** PLATFORM_ADMIN sits above the organization, so no ORG_ADMIN may hand it out. */
  private assertAssignable(role: UserRole): void {
    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException(`Role ${role} cannot be assigned`);
    }
  }
}
