import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  LOCATIONS,
  MovementStatus,
  MovementType,
  MovementUnit,
  PRODUCTS,
  USERS,
} from '../support/fake-prisma';
import {
  createConfirmed,
  createDraft,
  expectErrorShape,
  httpClient,
  startSecurityTestApp,
  tokenFor,
  type HttpClient,
  type SecurityTestApp,
} from '../support/security-test-app';

/**
 * RF-17 - Register a transfer between locations (TRANSFER).
 *
 * A transfer touches two locations, so the risks are moving stock into or out
 * of another tenant, steering one of its halves, reversing its direction,
 * rewriting it after the fact and applying it twice.
 */
describe('RF-17 Security - Register a transfer (TRANSFER)', () => {
  let ctx: SecurityTestApp;
  let client: HttpClient;
  let manager: string;

  const transfer = (extra: Record<string, unknown> = {}, quantity: unknown = 4) => ({
    type: MovementType.TRANSFER,
    locationId: LOCATIONS.A_MAIN,
    destinationLocationId: LOCATIONS.A_BAR,
    items: [{ productId: PRODUCTS.A_RUM, quantity, unit: MovementUnit.BOTTLE }],
    ...extra,
  });

  const stockSnapshot = () => ({
    aMain: ctx.prisma.stockOf(LOCATIONS.A_MAIN, PRODUCTS.A_RUM),
    aBar: ctx.prisma.stockOf(LOCATIONS.A_BAR, PRODUCTS.A_RUM),
    bMain: ctx.prisma.stockOf(LOCATIONS.B_MAIN, PRODUCTS.B_VODKA),
    bMainRum: ctx.prisma.stockOf(LOCATIONS.B_MAIN, PRODUCTS.A_RUM),
  });

  const SEEDED = { aMain: 100, aBar: 5, bMain: 50, bMainRum: 0 };

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
    ['destination in another organization (exfiltrate stock)', { destinationLocationId: LOCATIONS.B_MAIN }],
    ['origin in another organization (pull its stock)', { locationId: LOCATIONS.B_MAIN }],
  ])('a transfer with its %s is refused with 400 and nothing moves', async (_label, extra) => {
    const response = await client.post('/movements', { token: manager, body: transfer(extra) });

    expectErrorShape(response, 400);
    expect(ctx.prisma.state.movements).toHaveLength(1);
    expect(stockSnapshot()).toEqual(SEEDED);
  });

  it('a line cannot redirect its own half to another location: 400', async () => {
    const body = transfer();
    (body.items[0] as Record<string, unknown>).locationId = LOCATIONS.B_MAIN;

    const response = await client.post('/movements', { token: manager, body });

    expectErrorShape(response, 400);
    expect(stockSnapshot()).toEqual(SEEDED);
  });

  it.each([
    ['zero', 0],
    ['a negative numeric string (reverse the direction)', '-4'],
  ])('a transfer quantity of %s is refused with 400', async (_label, quantity) => {
    const response = await client.post('/movements', { token: manager, body: transfer({}, quantity) });

    expectErrorShape(response, 400);
    expect(ctx.prisma.state.movements).toHaveLength(1);
  });

  it('a confirmed transfer cannot be rewritten afterwards: 409, stock as confirmed', async () => {
    const confirmed = await createConfirmed(client, manager, transfer());

    const response = await client.patch(`/movements/${confirmed.id}`, {
      token: manager,
      body: { items: [{ productId: PRODUCTS.A_RUM, quantity: 90, unit: MovementUnit.BOTTLE }] },
    });

    expectErrorShape(response, 409);
    expect(stockSnapshot()).toEqual({ ...SEEDED, aMain: 96, aBar: 9 });
    expect(ctx.prisma.state.movementItems.filter((i) => i.movementId === confirmed.id).map((i) => i.quantity)).toEqual([4, 4]);
  });

  it('two concurrent confirmations of the same transfer move the stock only once', async () => {
    const draft = await createDraft(client, manager, transfer());

    const results = await Promise.all([
      client.post(`/movements/${draft.id}/confirm`, { token: manager }),
      client.post(`/movements/${draft.id}/confirm`, { token: manager }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(ctx.prisma.movementById(draft.id)!.status).toBe(MovementStatus.CONFIRMED);
    expect(stockSnapshot()).toEqual({ ...SEEDED, aMain: 96, aBar: 9 });
  });
});
