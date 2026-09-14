import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import type { AppConfig } from '../../config/configuration';
import { UserStatus } from '../../generated/prisma/enums';
import { AuditAction, AuditEntity } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from './password.service';
import { AuthRepository, type UserCredentials } from './repositories/auth.repository';
import { toAuthenticatedUser } from './user.mapper';

/**
 * One message for every way a sign-in can fail *before* the password is proven.
 *
 * Distinguishing "no such email" from "wrong password" from "locked" turns the
 * endpoint into an account-enumeration oracle, which is worth more to an
 * attacker than the hint is to a user.
 */
const INVALID_CREDENTIALS = 'Invalid email or password';

/**
 * Said only once the password has verified.
 *
 * At that point the caller already holds the credentials, so naming the reason
 * gives away nothing they could not confirm another way — while withholding it
 * sends a suspended user off to reset a password that was never the problem.
 */
const NOT_SIGNABLE: Record<Exclude<UserStatus, typeof UserStatus.ACTIVE>, string> = {
  [UserStatus.SUSPENDED]: 'This account is suspended. Ask an administrator to restore it.',
  [UserStatus.INVITED]: 'This invitation has not been accepted yet.',
};

/**
 * Proving who the caller is, and the bookkeeping every attempt leaves behind:
 * the lockout counter and the audit trail. Issuing the session afterwards is
 * AuthService's job, and Google's route reuses `completeSignIn` from here
 * because a sign-in is recorded the same way whichever door it came through.
 */
@Injectable()
export class CredentialsService {
  private readonly maxAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(
    private readonly users: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    config: ConfigService<AppConfig, true>,
  ) {
    const login = config.get('login', { infer: true });
    this.maxAttempts = login.maxAttempts;
    this.lockoutMinutes = login.lockoutMinutes;
  }

  /**
   * Backs the local Passport strategy.
   *
   * Every rejection path runs an argon2 verification, real or decoy, so that
   * response time does not tell an unknown email from a known one.
   *
   * The account's status is checked *after* the password rather than alongside
   * the other guards. Checking it first is what made a suspended user read
   * "invalid email or password" and go hunting for a typo they had not made.
   *
   * @throws {UnauthorizedException} with INVALID_CREDENTIALS until the password
   * verifies, and only then with the actual reason.
   */
  async validateCredentials(email: string, password: string): Promise<AuthenticatedUser> {
    // Normalized here and not by the DTO: guards run before pipes, so the local
    // strategy reads the raw body and LoginDto never touches it.
    const user = await this.users.findByEmail(email.trim().toLowerCase());

    if (!user?.passwordHash || this.isLocked(user)) {
      await this.passwords.verifyDecoy(password);
      // An unknown email has no organization to file an audit entry under, so
      // only attempts against a real account are recorded.
      if (user) {
        await this.recordSignInFailure(user, this.isLocked(user) ? 'locked' : 'no-password');
      }
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!(await this.passwords.verify(user.passwordHash, password))) {
      await this.registerFailedAttempt(user);
      await this.recordSignInFailure(user, 'bad-password');
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (user.status !== UserStatus.ACTIVE) {
      await this.recordSignInFailure(user, 'not-signable');
      throw new UnauthorizedException(NOT_SIGNABLE[user.status]);
    }

    return this.completeSignIn(user, 'password');
  }

  async completeSignIn(
    user: UserCredentials,
    method: 'password' | 'google',
  ): Promise<AuthenticatedUser> {
    await this.users.markLoginSucceeded(user.id);

    await this.audit.record({
      action: AuditAction.UserSignedIn,
      entity: AuditEntity.User,
      entityId: user.id,
      organizationId: user.organizationId,
      userId: user.id,
      metadata: { method },
    });

    return toAuthenticatedUser(user);
  }

  private recordSignInFailure(user: UserCredentials, cause: string): Promise<void> {
    return this.audit.record({
      action: AuditAction.UserSignInFailed,
      entity: AuditEntity.User,
      entityId: user.id,
      organizationId: user.organizationId,
      userId: user.id,
      metadata: { cause },
    });
  }

  private isLocked(user: UserCredentials): boolean {
    return user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now();
  }

  /** Counting restarts once the account locks, so each window gets a full budget. */
  private async registerFailedAttempt(user: UserCredentials): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const reached = attempts >= this.maxAttempts;

    await this.users.markLoginFailed(
      user.id,
      reached ? 0 : attempts,
      reached ? new Date(Date.now() + this.lockoutMinutes * 60_000) : null,
    );
  }
}
