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
  createDraft,
  expectErrorShape,
  expectNoSensitiveData,
  expiredTokenFor,
  FAKE_DATABASE_URL,
  httpClient,
  startSecurityTestApp,
  tamperedToken,
  tokenFor,
  tokenSignedWithWrongSecret,
  unsignedNoneAlgToken,
  type HttpClient,
  type SecurityTestApp,
} from '../support/security-test-app';

/**
 * RF-15 - Register an outbound movement (OUTBOUND).
 *
 * POST /movements (type OUTBOUND) and POST /movements/:id/confirm.
 * Risks: unauthenticated writes, forged tokens, mass assignment, privilege
 * escalation through the quantity sign, cross-tenant references, double spend,
 * oversized/malformed payloads and leakage of internals on failure.
 */
describe('RF-15 Security - Register an outbound movement (OUTBOUND)', () => {
  let ctx: SecurityTestApp;
  let client: HttpClient;
  let operator: string;

  const outbound = (quantity: unknown = 3, extra: Record<string, unknown> = {}) => ({
    type: MovementType.OUTBOUND,
    items: [{ productId: PRODUCTS.A_RUM, quantity, unit: MovementUnit.BOTTLE }],
    ...extra,
  });

  beforeAll(async () => {
    ctx = await startSecurityTestApp();
    client = httpClient(ctx.baseUrl);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(() => {
    ctx.prisma.reset();
    operator = tokenFor(USERS.OPERATOR);
  });

  const movementCount = () => ctx.prisma.state.movements.length;

  describe('authentication (real JwtAuthGuard + passport-jwt)', () => {
    const encodedOperatorClaims = () =>
      Buffer.from(JSON.stringify({ sub: USERS.OPERATOR.id })).toString('base64url');

    it.each([
      ['no Authorization header', () => ({})],
      ['a Bearer value that is not a JWT', () => ({ authorization: 'Bearer not-a-jwt' })],
      ['an empty Bearer value', () => ({ authorization: 'Bearer ' })],
      ['a token signed with another secret', () => ({ authorization: `Bearer ${tokenSignedWithWrongSecret(USERS.OPERATOR)}` })],
      ['an expired token', () => ({ authorization: `Bearer ${expiredTokenFor(USERS.OPERATOR)}` })],
      ['an unsigned alg:none token', () => ({ authorization: `Bearer ${unsignedNoneAlgToken(USERS.MANAGER)}` })],
      ['a payload swapped under a valid signature', () => ({ authorization: `Bearer ${tamperedToken(USERS.OPERATOR, USERS.MANAGER)}` })],
      ['the token without the Bearer scheme', () => ({ authorization: tokenFor(USERS.OPERATOR) })],
      ['a Basic scheme', () => ({ authorization: `Basic ${encodedOperatorClaims()}` })],
      ['the token in a cookie instead of the header', () => ({ cookie: `access_token=${tokenFor(USERS.OPERATOR)}` })],
    ])('rejects %s with 401 and creates nothing', async (_label, headers) => {
      const before = movementCount();

      const response = await client.post('/movements', { headers: headers(), body: outbound() });

      expectErrorShape(response, 401);
      expect(movementCount()).toBe(before);
    });

    it('rejects a token passed in the query string with 401', async () => {
      const response = await client.post(`/movements?access_token=${operator}`, { body: outbound() });

      expectErrorShape(response, 401);
      expect(movementCount()).toBe(1);
    });

    it('rejects a valid token of a SUSPENDED user, and of a user that no longer exists', async () => {
      const suspended = await client.post('/movements', {
        token: tokenFor(USERS.SUSPENDED_MANAGER),
        body: outbound(),
      });
      const ghost = await client.post('/movements', {
        token: tokenFor({ ...USERS.MANAGER, id: 'deadbeef-dead-4bee-8bee-deadbeefdead' }),
        body: outbound(),
      });

      expectErrorShape(suspended, 401);
      expectErrorShape(ghost, 401);
      expect(movementCount()).toBe(1);
    });
  });

  describe('mass assignment / movement manipulation', () => {
    it.each([
      ['status: CONFIRMED (skip confirmation)', { status: MovementStatus.CONFIRMED }],
      ['organizationId of another tenant', { organizationId: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }],
      ['createdByUserId of someone else', { createdByUserId: USERS.MANAGER.id }],
      ['a chosen movement code', { code: B_MOVEMENT.code }],
      ['a chosen movement id', { id: B_MOVEMENT.id }],
      ['confirmedAt', { confirmedAt: new Date().toISOString() }],
    ])('rejects a body carrying %s with 400 and creates nothing', async (_label, extra) => {
      const response = await client.post('/movements', { token: operator, body: outbound(3, extra) });

      expectErrorShape(response, 400);
      expect(movementCount()).toBe(1);
    });

    it.each([
      ['quantityBase (pre-signed stock delta)', { quantityBase: 500 }],
      ['locationId per line (redirect one line)', { locationId: LOCATIONS.A_BAR }],
    ])('rejects a line carrying %s with 400', async (_label, extra) => {
      const body = {
        type: MovementType.OUTBOUND,
        items: [{ productId: PRODUCTS.A_RUM, quantity: 3, unit: MovementUnit.BOTTLE, ...extra }],
      };

      const response = await client.post('/movements', { token: operator, body });

      expectErrorShape(response, 400);
      expect(movementCount()).toBe(1);
    });

    it('an OPERATOR cannot turn an outbound into an inbound with a negative quantity', async () => {
      // Without the sign rule this would be an INBOUND recorded by a role that
      // was never granted movement:create-inbound.
      for (const quantity of [-50, '-50']) {
        const response = await client.post('/movements', { token: operator, body: outbound(quantity) });
        expectErrorShape(response, 400);
      }

      expect(movementCount()).toBe(1);
      expect(ctx.prisma.stockOf(LOCATIONS.A_MAIN, PRODUCTS.A_RUM)).toBe(100);
    });
  });

  describe('input validation of the quantity', () => {
    it.each([
      ['zero', 0],
      ['above the 1,000,000 cap', 1_000_001],
      ['MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER],
      ['1e308', 1e308],
      ['a fraction', 1.5],
      ['a non-numeric string', 'abc'],
      ['a numeric string above the cap', '1e7'],
      ['an object', { $gt: 0 }],
    ])('rejects a quantity that is %s with 400', async (_label, quantity) => {
      const response = await client.post('/movements', { token: operator, body: outbound(quantity) });

      expectErrorShape(response, 400);
      expect(movementCount()).toBe(1);
    });

    it.each([
      ['an empty items array', { type: MovementType.OUTBOUND, items: [] }],
      ['no items at all', { type: MovementType.OUTBOUND }],
      ['an unknown movement type', { ...outbound(), type: 'GIFT' }],
      ['a productId that is not a UUID', { type: MovementType.OUTBOUND, items: [{ productId: "' OR '1'='1", quantity: 1, unit: 'BOTTLE' }] }],
      ['an unknown unit', { type: MovementType.OUTBOUND, items: [{ productId: PRODUCTS.A_RUM, quantity: 1, unit: 'PALLET' }] }],
    ])('rejects %s with 400', async (_label, body) => {
      const response = await client.post('/movements', { token: operator, body });

      expectErrorShape(response, 400);
      expect(movementCount()).toBe(1);
    });
  });

  describe('tenant isolation', () => {
    it("cannot reference another organization's product or location", async () => {
      const foreignProduct = await client.post('/movements', {
        token: operator,
        body: {
          type: MovementType.OUTBOUND,
          items: [{ productId: PRODUCTS.B_VODKA, quantity: 1, unit: MovementUnit.BOTTLE }],
        },
      });
      const foreignLocation = await client.post('/movements', {
        token: operator,
        body: outbound(1, { locationId: LOCATIONS.B_MAIN }),
      });

      expectErrorShape(foreignProduct, 400);
      expectErrorShape(foreignLocation, 400);
      // The refusal must not disclose what the other tenant calls its product.
      expect(foreignProduct.text).not.toContain('Vodka Secreto B');
      expect(movementCount()).toBe(1);
      expect(ctx.prisma.stockOf(LOCATIONS.B_MAIN, PRODUCTS.B_VODKA)).toBe(50);
    });

    it("cannot confirm another organization's movement: 404, nothing applied", async () => {
      ctx.prisma.movementById(B_MOVEMENT.id)!.status = MovementStatus.DRAFT;

      const response = await client.post(`/movements/${B_MOVEMENT.id}/confirm`, {
        token: tokenFor(USERS.MANAGER),
      });

      expectErrorShape(response, 404);
      expect(ctx.prisma.movementById(B_MOVEMENT.id)!.status).toBe(MovementStatus.DRAFT);
      expect(ctx.prisma.stockOf(LOCATIONS.B_MAIN, PRODUCTS.B_VODKA)).toBe(50);
    });
  });

  it('two concurrent confirmations of the same outbound subtract the stock only once', async () => {
    const draft = await createDraft(client, operator, outbound(30));

    const results = await Promise.all([
      client.post(`/movements/${draft.id}/confirm`, { token: operator }),
      client.post(`/movements/${draft.id}/confirm`, { token: operator }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(ctx.prisma.stockOf(LOCATIONS.A_MAIN, PRODUCTS.A_RUM)).toBe(70);
  });

  describe('payload abuse', () => {
    it('rejects more than 500 lines in one request with 400', async () => {
      const items = Array.from({ length: 501 }, () => ({
        productId: PRODUCTS.A_RUM,
        quantity: 1,
        unit: MovementUnit.BOTTLE,
      }));

      const response = await client.post('/movements', {
        token: operator,
        body: { type: MovementType.OUTBOUND, items },
      });

      expectErrorShape(response, 400);
      expect(movementCount()).toBe(1);
    });

    it('rejects a body above the parser limit with 413 and no internals', async () => {
      const response = await client.post('/movements', {
        token: operator,
        body: outbound(1, { note: 'x'.repeat(200_000) }),
      });

      expect(response.status).toBe(413);
      expectNoSensitiveData(response);
      expect(movementCount()).toBe(1);
    });

    it('rejects malformed JSON with 400 and no stack trace', async () => {
      const response = await client.post('/movements', {
        token: operator,
        rawBody: '{"type":"OUTBOUND","items":[{"productId":',
      });

      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).not.toContain('text/html');
      expectNoSensitiveData(response);
      expect(movementCount()).toBe(1);
    });

    it('neutralizes a prototype-pollution payload: keys dropped, Object.prototype clean', async () => {
      // class-transformer skips __proto__ and constructor instead of copying
      // them, so the request goes through as the plain outbound it carries.
      const response = await client.post('/movements', {
        token: operator,
        rawBody: JSON.stringify(outbound()).replace(
          /}$/,
          ',"__proto__":{"polluted":true,"type":"INBOUND"},"constructor":{"prototype":{"polluted":true}}}',
        ),
      });

      expect(response.status).toBe(201);
      expect(response.json.type).toBe(MovementType.OUTBOUND);
      expect(response.json.polluted).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(Object.prototype).not.toHaveProperty('polluted');
      expect(ctx.prisma.movementById(response.json.id)).not.toHaveProperty('polluted');
    });

    it('stores a script payload in the note as inert data, served as JSON with nosniff', async () => {
      const payload = '<script>alert(1)</script>';

      const response = await client.post('/movements', {
        token: operator,
        body: outbound(1, { note: payload }),
      });

      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.json.note).toBe(payload);
      expect(response.json.type).toBe(MovementType.OUTBOUND);
      expect(response.json.status).toBe(MovementStatus.DRAFT);
    });
  });

  describe('error disclosure', () => {
    it('a database failure while confirming answers a generic 500 and rolls everything back', async () => {
      const draft = await createDraft(client, operator, outbound(10));
      ctx.prisma.failNext(
        'stockLevel.updateMany',
        new Error(`connect ECONNREFUSED ${FAKE_DATABASE_URL} (JWT_SECRET missing)`),
      );

      const response = await client.post(`/movements/${draft.id}/confirm`, { token: operator });

      expectErrorShape(response, 500);
      expect(response.json.message).toBe('Internal server error');
      expect(ctx.prisma.movementById(draft.id)!.status).toBe(MovementStatus.DRAFT);
      expect(ctx.prisma.stockOf(LOCATIONS.A_MAIN, PRODUCTS.A_RUM)).toBe(100);
    });
  });
});
