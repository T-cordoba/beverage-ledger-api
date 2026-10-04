import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  B_MOVEMENT,
  LOCATIONS,
  MovementStatus,
  MovementType,
  MovementUnit,
  PRODUCTS,
  UserRole,
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
 * RF-16 - Register an inbound movement (INBOUND).
 *
 * Only MANAGER and above hold movement:create-inbound. The risks are an
 * OPERATOR obtaining an inbound by another route (forged claim, confirming
 * someone else's draft, editing a draft's type), a demotion that does not take
 * effect, and adding stock to another tenant.
 */
describe('RF-16 Security - Register an inbound movement (INBOUND)', () => {
  let ctx: SecurityTestApp;
  let client: HttpClient;
  let manager: string;
  let operator: string;

  const inbound = (extra: Record<string, unknown> = {}) => ({
    type: MovementType.INBOUND,
    items: [{ productId: PRODUCTS.A_RUM, quantity: 24, unit: MovementUnit.BOTTLE }],
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
    operator = tokenFor(USERS.OPERATOR);
  });

  it('ignores a validly signed role claim: an OPERATOR token claiming PLATFORM_ADMIN still gets 403', async () => {
    // The strategy re-reads the user; the role inside the token is diagnostic.
    const forgedRole = tokenFor(USERS.OPERATOR, { role: UserRole.PLATFORM_ADMIN });

    const response = await client.post('/movements', { token: forgedRole, body: inbound() });

    expectErrorShape(response, 403);
    expect(ctx.prisma.state.movements).toHaveLength(1);
  });

  it('a demotion takes effect immediately on a token issued before it', async () => {
    const issuedAsManager = tokenFor(USERS.MANAGER);
    ctx.prisma.state.users.find((u) => u.id === USERS.MANAGER.id)!.role = UserRole.OPERATOR;

    const response = await client.post('/movements', { token: issuedAsManager, body: inbound() });

    expectErrorShape(response, 403);
  });

  it("an OPERATOR cannot confirm a MANAGER's inbound draft: 403, stock untouched", async () => {
    const draft = await createDraft(client, manager, inbound());

    const response = await client.post(`/movements/${draft.id}/confirm`, { token: operator });

    expectErrorShape(response, 403);
    expect(ctx.prisma.movementById(draft.id)!.status).toBe(MovementStatus.DRAFT);
    expect(ctx.prisma.stockOf(LOCATIONS.A_MAIN, PRODUCTS.A_RUM)).toBe(100);
  });

  it.each([
    ['type (OUTBOUND -> INBOUND)', { type: MovementType.INBOUND }],
    ['status (DRAFT -> CONFIRMED)', { status: MovementStatus.CONFIRMED }],
    ['locationId', { locationId: LOCATIONS.A_BAR }],
  ])("an OPERATOR cannot PATCH a draft's %s: 400, draft unchanged", async (_label, patch) => {
    const draft = await createDraft(client, operator, {
      type: MovementType.OUTBOUND,
      items: [{ productId: PRODUCTS.A_RUM, quantity: 5, unit: MovementUnit.BOTTLE }],
    });

    const response = await client.patch(`/movements/${draft.id}`, { token: operator, body: patch });

    expectErrorShape(response, 400);
    const stored = ctx.prisma.movementById(draft.id)!;
    expect(stored.type).toBe(MovementType.OUTBOUND);
    expect(stored.status).toBe(MovementStatus.DRAFT);
    expect(stored.locationId).toBe(LOCATIONS.A_MAIN);
  });

  it("cannot add stock into another organization's location: 400, its stock untouched", async () => {
    const response = await client.post('/movements', {
      token: manager,
      body: inbound({ locationId: LOCATIONS.B_MAIN }),
    });

    expectErrorShape(response, 400);
    expect(ctx.prisma.stockOf(LOCATIONS.B_MAIN, PRODUCTS.B_VODKA)).toBe(50);
    expect(ctx.prisma.state.stockLevels.some((s) => s.locationId === LOCATIONS.B_MAIN && s.productId === PRODUCTS.A_RUM)).toBe(false);
  });

  it("another organization's manager cannot read or confirm our inbound draft: 404", async () => {
    const draft = await createDraft(client, manager, inbound());
    const intruder = tokenFor(USERS.MANAGER_B);

    const read = await client.get(`/movements/${draft.id}`, { token: intruder });
    const confirm = await client.post(`/movements/${draft.id}/confirm`, { token: intruder });

    expectErrorShape(read, 404);
    expectErrorShape(confirm, 404);
    expect(ctx.prisma.movementById(draft.id)!.status).toBe(MovementStatus.DRAFT);
    expect(ctx.prisma.stockOf(LOCATIONS.A_MAIN, PRODUCTS.A_RUM)).toBe(100);
    // And the victim's own seeded movement stays invisible to us in turn.
    const reverse = await client.get(`/movements/${B_MOVEMENT.id}`, { token: manager });
    expectErrorShape(reverse, 404);
  });
});
