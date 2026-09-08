
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationsService } from '../src/modules/invitations/invitations.service';

describe('InvitationsService.accept', () => {
  let invitations: InvitationsService;

  let findRedeemableByHash: ReturnType<typeof vi.fn>;
  let userExists: ReturnType<typeof vi.fn>;
  let hash: ReturnType<typeof vi.fn>;
  let markAccepted: ReturnType<typeof vi.fn>;
  let createUser: ReturnType<typeof vi.fn>;
  let runInTransaction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findRedeemableByHash = vi.fn();
    userExists = vi.fn();
    hash = vi.fn();
    markAccepted = vi.fn();
    createUser = vi.fn();
    runInTransaction = vi.fn();

    invitations = new InvitationsService(
      {
        findRedeemableByHash,
        userExists,
        markAccepted,
        createUser,
        runInTransaction,
      } as any,
      {
        hash,
      } as any,
      {
        record: vi.fn(),
      } as any,
      {
        get: vi.fn().mockReturnValue('http://localhost:3000'),
      } as any,
    );
  });

  it('Camino 1 - token invalido lanza NotFoundException', async () => {
    // Arrange
    findRedeemableByHash.mockResolvedValue(null);

    // Act
    const resultado = invitations.accept({
      token: 'token-invalido',
      name: 'Nadie',
      password: 'Contraseña123!',
    });

    // Assert
    await expect(resultado).rejects.toThrow(NotFoundException);
  });

  it('Camino 2 - email ya existe en la organizacion lanza ConflictException', async () => {
    // Arrange
    findRedeemableByHash.mockResolvedValue({
      id: 'invitation-1',
      organizationId: 'organization-1',
      email: 'usuario@example.com',
      role: 'OPERATOR',
    });

    userExists.mockResolvedValue(true);

    // Act
    const resultado = invitations.accept({
      token: 'token-valido',
      name: 'Usuario Duplicado',
      password: 'Contraseña123!',
    });

    // Assert
    await expect(resultado).rejects.toThrow(ConflictException);
  });

  it('Camino 3 - segunda aceptacion del mismo token lanza BadRequestException', async () => {
    // Arrange
    findRedeemableByHash.mockResolvedValue({
      id: 'invitation-2',
      organizationId: 'organization-1',
      email: 'carrera@example.com',
      role: 'OPERATOR',
    });

    userExists.mockResolvedValue(false);
    hash.mockResolvedValue('password-hash');

    runInTransaction.mockImplementation(async (callback: any) => {
      return callback({});
    });

    markAccepted.mockResolvedValue(false);

    // Act
    const resultado = invitations.accept({
      token: 'token-carrera',
      name: 'Usuario Carrera',
      password: 'Contraseña123!',
    });

    // Assert
    await expect(resultado).rejects.toThrow(BadRequestException);
  });

  it('Camino 4 - invitacion valida crea el usuario y devuelve AuthenticatedUser', async () => {
    // Arrange
    findRedeemableByHash.mockResolvedValue({
      id: 'invitation-3',
      organizationId: 'organization-1',
      email: 'ana@example.com',
      role: 'OPERATOR',
    });

    userExists.mockResolvedValue(false);
    hash.mockResolvedValue('password-hash');
    markAccepted.mockResolvedValue(true);

    createUser.mockResolvedValue({
      id: 'user-1',
      organizationId: 'organization-1',
      email: 'ana@example.com',
      name: 'Ana Restrepo',
      role: 'OPERATOR',
      avatarUrl: null,
      status: 'ACTIVE',
    });

    runInTransaction.mockImplementation(async (callback: any) => {
      return callback({});
    });

    // Act
    const resultado = await invitations.accept({
      token: 'token-valido',
      name: '  Ana Restrepo  ',
      password: 'Contraseña123!',
    });

    // Assert
    expect(resultado.id).toBe('user-1');
    expect(resultado.email).toBe('ana@example.com');
    expect(resultado.name).toBe('Ana Restrepo');
    expect(resultado.organizationId).toBe('organization-1');
    expect(resultado.role).toBe('OPERATOR');
    expect(resultado.permissions).toBeDefined();
  });
});

