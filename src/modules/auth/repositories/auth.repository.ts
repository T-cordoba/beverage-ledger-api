import { Injectable } from '@nestjs/common';
import type { AuthProvider, UserRole, UserStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const CREDENTIALS = {
  id: true,
  organizationId: true,
  email: true,
  name: true,
  avatarUrl: true,
  passwordHash: true,
  role: true,
  status: true,
  failedLoginAttempts: true,
  lockedUntil: true,
} as const;

const PROFILE = {
  id: true,
  organizationId: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
} as const;

export type UserCredentials = NonNullable<Awaited<ReturnType<AuthRepository['findByEmail']>>>;

/**
 * The one repository that does not extend BaseRepository.
 *
 * Sign-in runs before there is a tenant context to scope by — resolving which
 * organization the caller belongs to is the whole point of it. Every other
 * repository must stay scoped.
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Email is unique per organization, not globally, so this can only stay
   * unambiguous while there is a single organization. Multi-tenant sign-in will
   * need the organization in the request, via subdomain or an explicit picker.
   */
  findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email },
      select: CREDENTIALS,
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: CREDENTIALS });
  }

  findProfile(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        ...PROFILE,
        organization: {
          select: { id: true, name: true, slug: true, logoUrl: true, timezone: true },
        },
      },
    });
  }

  findByProviderAccount(provider: AuthProvider, providerAccountId: string) {
    return this.prisma.user.findFirst({
      where: { identities: { some: { provider, providerAccountId } } },
      select: CREDENTIALS,
    });
  }

  findOrganizationBySlug(slug: string) {
    return this.prisma.organization.findUnique({ where: { slug }, select: { id: true } });
  }

  createUser(data: {
    organizationId: string;
    email: string;
    name: string;
    passwordHash?: string | null;
    avatarUrl?: string | null;
    role: UserRole;
    status: UserStatus;
    emailVerifiedAt?: Date | null;
  }) {
    return this.prisma.user.create({ data, select: CREDENTIALS });
  }

  async linkIdentity(
    userId: string,
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<void> {
    await this.prisma.authIdentity.upsert({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      update: { userId },
      create: { userId, provider, providerAccountId },
    });
  }

  async markLoginSucceeded(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  async markLoginFailed(userId: string, attempts: number, lockedUntil: Date | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: attempts, lockedUntil },
    });
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, status: 'ACTIVE' },
    });
  }

  /**
   * Google having released the address is proof enough of the email, which is
   * what an invitation was waiting for. Suspended users never reach this.
   */
  async confirmGoogleLink(userId: string, avatarUrl: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        ...(avatarUrl ? { avatarUrl } : {}),
      },
      select: CREDENTIALS,
    });
  }
}
