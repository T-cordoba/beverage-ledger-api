import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { toPage } from '../../common/dto/paginate';
import { ASSIGNABLE_ROLES } from '../../common/permissions/permissions.config';
import { UserRole, UserStatus } from '../../generated/prisma/enums';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { AuthRepository } from '../auth/repositories/auth.repository';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import type {
  ChangePasswordDto,
  CreateUserDto,
  UpdateProfileDto,
  UpdateUserDto,
  UserDto,
  UserPageDto,
} from './dto/user.dto';
import { UsersRepository } from './repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly credentials: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async list(limit: number, cursor?: string): Promise<UserPageDto> {
    return toPage(await this.users.findPage(limit, cursor), limit);
  }

  /** @throws {NotFoundException} which is also the answer for another organization's user. */
  async findOne(id: string): Promise<UserDto> {
    const user = await this.users.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    await this.users.update(userId, dto);
    return this.findOne(userId);
  }

  /**
   * @throws {UnauthorizedException} when the current password does not match.
   *
   * Every session is dropped afterwards: a password change is what someone does
   * when they suspect a session they no longer control, and leaving the others
   * alive defeats the point.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.credentials.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('The current password is required');
      }

      if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
        throw new UnauthorizedException('The current password is incorrect');
      }
    }

    await this.users.update(userId, { passwordHash: await this.passwords.hash(dto.newPassword) });
    await this.tokens.revokeAllForUser(userId);

    await this.audit.record({
      action: AuditAction.UserPasswordChanged,
      entity: AuditEntity.User,
      entityId: userId,
    });
  }

  /** @throws {ConflictException} when the email is already used in this organization. */
  async create(dto: CreateUserDto): Promise<UserDto> {
    this.assertAssignable(dto.role);

    if (await this.users.existsWithEmail(dto.email)) {
      throw new ConflictException('That email already belongs to a user');
    }

    const created = await this.users.create({
      email: dto.email,
      name: dto.name,
      role: dto.role,
      status: UserStatus.ACTIVE,
      passwordHash: await this.passwords.hash(dto.password),
    });

    await this.audit.record({
      action: AuditAction.UserCreated,
      entity: AuditEntity.User,
      entityId: created.id,
      metadata: { email: created.email, role: created.role, status: created.status },
    });

    return created;
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
