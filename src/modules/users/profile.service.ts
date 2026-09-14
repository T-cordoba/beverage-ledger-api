import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { AuthRepository } from '../auth/repositories/auth.repository';
import { TokenService } from '../auth/token.service';
import type { ChangePasswordDto, UpdateProfileDto, UserDto } from './dto/user.dto';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './users.service';

/**
 * What a user may do to their own account, at `/users/me`. Editing somebody
 * else's role or status is administration and lives in UsersService, behind
 * `users:manage`.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly users: UsersRepository,
    private readonly credentials: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly directory: UsersService,
  ) {}

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    await this.users.update(userId, dto);
    return this.directory.findOne(userId);
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
}
