import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  B_MOVEMENT,
  LOCATIONS,
  MovementStatus,
  MovementType,
  MovementUnit,
  PRODUCTS,
  USERS,
} from '../support/fake-prisma';
import {
  createConfirmed,
  expectErrorShape,
  expiredTokenFor,
  FAKE_DATABASE_URL,
  httpClient,
  startSecurityTestApp,
  tokenFor,
  tokenSignedWithWrongSecret,
  type HttpClient,
  type SecurityTestApp,
} from '../support/security-test-app';

/**
 * RF-20 - Cancel a confirmed movement.
 *
 * POST /movements/:id/cancel reverts stock, so it is the most sensitive write
 * in scope. Risks: cancelling another tenant's movement (IDOR), id tampering,
 * double reversal under concurrency, forged/expired credentials, an empty
 * justification on the audit trail, extra body fields, and a partial reversal
 * when the database fails mid-way.
 */
describe('RF-20 Security - Cancel a confirmed movement', () => {
  let ctx: SecurityTestApp;
  let client: HttpClient;
  let manager: string;
  let confirmedId: string;

  const reason = { reason: 'Venta registrada por error' };

  beforeAll(async () => {
    ctx = await startSecurityTestApp();
    client = httpClient(ctx.baseUrl);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    ctx.prisma.reset();
    manager = tokenFor(USERS.MANAGER);
    const confirmed = await createConfirmed(client, manager, {
      type: MovementType.OUTBOUND,
      items: [{ productId: PRODUCTS.A_RUM, quantity: 20, unit: MovementUnit.BOTTLE }],
    });
    confirmedId = confirmed.id;
  });

  /** The confirmed outbound left 80 on hand; anything else means stock moved. */
  const expectUntouched = () => {
    expect(ctx.prisma.movementById(confirmedId)!.status).toBe(MovementStatus.CONFIRMED);
    expect(ctx.prisma.stockOf(LOCATIONS.A_MAIN, PRODUCTS.A_RUM)).toBe(80);
  };

  it("cannot cancel another organization's movement: 404, its status and stock untouched", async () => {
    const response = await client.post(`/movements/${B_MOVEMENT.id}/cancel`, { token: manager, body: reason });

    expectErrorShape(response, 404);
    expect(response.text).not.toContain(B_MOVEMENT.code);
    expect(ctx.prisma.movementById(B_MOVEMENT.id)!.status).toBe(MovementStatus.CONFIRMED);
    expect(ctx.prisma.stockOf(LOCATIONS.B_MAIN, PRODUCTS.B_VODKA)).toBe(50);
  });

  it('answers 404 identically for a foreign id and a non-existent one (no tenant enumeration)', async () => {
    const foreign = await client.post(`/movements/${B_MOVEMENT.id}/cancel`, { token: manager, body: reason });
    const missing = await client.post('/movements/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cancel', {
      token: manager,
      body: reason,
    });

    expect(foreign.status).toBe(missing.status);
    expect(foreign.json.message).toBe(missing.json.message);
    expect(foreign.json.error).toBe(missing.json.error);
  });

  it.each([
    ['an SQL-injection string', encodeURIComponent("' OR '1'='1")],
    ['an encoded path traversal', encodeURIComponent('../../etc/passwd')],
    ['a numeric id', '1'],
    ['a UUID with a trailing payload', `${'a'.repeat(8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa;DROP`],
    ['a wildcard', '*'],
  ])('rejects %s as the movement id with 400 and changes nothing', async (_label, id) => {
    const response = await client.post(`/movements/${id}/cancel`, { token: manager, body: reason });

    expectErrorShape(response, 400);
    expectUntouched();
  });

  it('two concurrent cancellations revert the stock only once', async () => {
    const results = await Promise.all([
      client.post(`/movements/${confirmedId}/cancel`, { token: manager, body: reason }),
      client.post(`/movements/${confirmedId}/cancel`, { token: manager, body: reason }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(ctx.prisma.stockOf(LOCATIONS.A_MAIN, PRODUCTS.A_RUM)).toBe(100);
  });

  it.each([
    ['an expired token', () => expiredTokenFor(USERS.MANAGER)],
    ['a token signed with another secret', () => tokenSignedWithWrongSecret(USERS.MANAGER)],
    ['a suspended manager', () => tokenFor(USERS.SUSPENDED_MANAGER)],
  ])('refuses %s with 401 and changes nothing', async (_label, token) => {
    const response = await client.post(`/movements/${confirmedId}/cancel`, { token: token(), body: reason });

    expectErrorShape(response, 401);
    expectUntouched();
  });

  it('an OPERATOR with a forged MANAGER role claim still gets 403', async () => {
    const forged = tokenFor(USERS.OPERATOR, { role: 'MANAGER' });

    const response = await client.post(`/movements/${confirmedId}/cancel`, { token: forged, body: reason });

    expectErrorShape(response, 403);
    expectUntouched();
  });

  it.each([
    ['no body', undefined],
    ['a reason shorter than 4 characters', { reason: 'no' }],
    ['a reason longer than 500 characters', { reason: 'x'.repeat(501) }],
    ['a non-string reason', { reason: { $ne: null } }],
    ['a status override', { ...reason, status: MovementStatus.DRAFT }],
    ['quantities to revert', { ...reason, items: [{ productId: PRODUCTS.A_RUM, quantity: 999 }] }],
  ])('an invalid cancel request with %s is refused with 400 and stock untouched', async (_label, body) => {
    const response = await client.post(`/movements/${confirmedId}/cancel`, { token: manager, body });

    expectErrorShape(response, 400);
    expectUntouched();
  });

  it('a whitespace-only reason is refused: the audit trail must carry a real justification', async () => {
    // Same control the service already applies to an adjustment's reason.
    const response = await client.post(`/movements/${confirmedId}/cancel`, {
      token: manager,
      body: { reason: '        ' },
    });

    expectErrorShape(response, 400);
    expectUntouched();
  });

  it('a database failure half-way through the reversal answers a generic 500 and rolls back', async () => {
    ctx.prisma.failNext('auditLog.create', new Error(`audit insert failed on ${FAKE_DATABASE_URL}`));

    const response = await client.post(`/movements/${confirmedId}/cancel`, { token: manager, body: reason });

    expectErrorShape(response, 500);
    expect(response.json.message).toBe('Internal server error');
    expectUntouched();
  });
});
