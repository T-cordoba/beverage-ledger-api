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
  httpClient,
  startSecurityTestApp,
  tokenFor,
  type HttpClient,
  type SecurityTestApp,
} from '../support/security-test-app';

/**
 * RF-18 - Register an adjustment (ADJUSTMENT).
 *
 * An adjustment is where a discrepancy gets buried, so the mandatory reason is
 * an audit control. The risks are bypassing that reason, injecting through it,
 * driving stock below zero with an extreme negative, and an OPERATOR editing a
 * manager's adjustment.
 */
describe('RF-18 Security - Register an adjustment (ADJUSTMENT)', () => {
  let ctx: SecurityTestApp;
  let client: HttpClient;
  let manager: string;

  const adjustment = (quantity: unknown = -3, extra: Record<string, unknown> = {}) => ({
    type: MovementType.ADJUSTMENT,
    reason: 'Conteo fisico de cierre',
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
    manager = tokenFor(USERS.MANAGER);
  });

  it.each([
    ['only whitespace', '        '],
    ['tabs and newlines', '\t\n\t\n\t'],
    ['missing', undefined],
  ])('the mandatory reason cannot be bypassed when it is %s: 400', async (_label, reason) => {
    const response = await client.post('/movements', { token: manager, body: adjustment(-3, { reason }) });

    expectErrorShape(response, 400);
    expect(ctx.prisma.state.movements).toHaveLength(1);
  });

  it("a draft's reason cannot be blanked afterwards through PATCH: 400", async () => {
    const draft = await createDraft(client, manager, adjustment());

    const response = await client.patch(`/movements/${draft.id}`, {
      token: manager,
      body: { reason: '     ' },
    });

    expectErrorShape(response, 400);
    expect(ctx.prisma.movementById(draft.id)!.reason).toBe('Conteo fisico de cierre');
  });

  it('a reason longer than 500 characters is refused with 400', async () => {
    const response = await client.post('/movements', {
      token: manager,
      body: adjustment(-3, { reason: 'x'.repeat(501) }),
    });

    expectErrorShape(response, 400);
  });

  it('an SQL-injection payload in the reason is stored as literal text and touches nothing else', async () => {
    const payload = "x'); DELETE FROM stock_levels; -- ' OR '1'='1";

    const response = await client.post('/movements', {
      token: manager,
      body: adjustment(-3, { reason: payload }),
    });

    expect(response.status).toBe(201);
    expect(response.json.reason).toBe(payload);
    expect(response.json.type).toBe(MovementType.ADJUSTMENT);
    expect(ctx.prisma.state.stockLevels).toHaveLength(3);
    expect(ctx.prisma.stockOf(LOCATIONS.A_MAIN, PRODUCTS.A_RUM)).toBe(100);
    expect(ctx.prisma.movementById(B_MOVEMENT.id)!.status).toBe(MovementStatus.CONFIRMED);
  });

  it.each([
    ['below the -1,000,000 floor', -1_000_001],
    ['-Number.MAX_SAFE_INTEGER', -Number.MAX_SAFE_INTEGER],
    ['-1e308', -1e308],
  ])('an adjustment quantity %s is refused with 400', async (_label, quantity) => {
    const response = await client.post('/movements', { token: manager, body: adjustment(quantity) });

    expectErrorShape(response, 400);
  });

  it('an extreme but valid negative cannot drive stock below zero on confirm', async () => {
    const draft = await createDraft(client, manager, adjustment(-1_000_000));

    const response = await client.post(`/movements/${draft.id}/confirm`, { token: manager });

    expectErrorShape(response, 400);
    expect(ctx.prisma.stockOf(LOCATIONS.A_MAIN, PRODUCTS.A_RUM)).toBe(100);
    expect(ctx.prisma.movementById(draft.id)!.status).toBe(MovementStatus.DRAFT);
  });

  it("an OPERATOR can neither edit nor confirm a manager's adjustment draft: 403", async () => {
    const draft = await createDraft(client, manager, adjustment(50));
    const operator = tokenFor(USERS.OPERATOR);

    const edit = await client.patch(`/movements/${draft.id}`, {
      token: operator,
      body: { items: [{ productId: PRODUCTS.A_RUM, quantity: 900, unit: MovementUnit.BOTTLE }] },
    });
    const confirm = await client.post(`/movements/${draft.id}/confirm`, { token: operator });

    expectErrorShape(edit, 403);
    expectErrorShape(confirm, 403);
    expect(ctx.prisma.state.movementItems.find((i) => i.movementId === draft.id)!.quantity).toBe(50);
    expect(ctx.prisma.stockOf(LOCATIONS.A_MAIN, PRODUCTS.A_RUM)).toBe(100);
  });
});
