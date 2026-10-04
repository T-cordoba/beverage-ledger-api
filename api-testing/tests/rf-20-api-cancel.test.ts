import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  registerConfirmed,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../support/api-test-app';
import {
  LOCATIONS,
  MovementStatus,
  MovementType,
  MovementUnit,
  PRODUCTS,
  UNKNOWN_ID,
} from '../support/in-memory-ledger';

const CANCEL = { reason: 'Registrado por error' };

const line = (productId: string, quantity: number) => [
  { productId, quantity, unit: MovementUnit.BOTTLE },
];

describe('RF-20 API - Cancel a confirmed movement', () => {
  let api: ApiTestApp;
  let client: ApiClient;

  beforeAll(async () => {
    api = await startApiTestApp();
    client = apiClient(api.baseUrl);
  });

  afterAll(async () => {
    await api.close();
  });

  beforeEach(() => {
    api.ledger.reset();
  });

  it('POST /movements/:id/cancel voids a confirmed outbound and gives the stock back', async () => {
    const movement = await registerConfirmed(client, {
      type: MovementType.OUTBOUND,
      items: line(PRODUCTS.RUM, 30),
    });
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'stock before cancel').to.equal(70);

    const response = await client.post(
      `/movements/${movement.id}/cancel`,
      CANCEL,
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(201);
    expect(response.body, 'body').to.include({
      id: movement.id,
      code: movement.code,
      status: MovementStatus.CANCELLED,
    });
    expect(response.body.cancelledAt, 'cancelledAt').to.be.a('string');
    expect(response.body.confirmedAt, 'confirmedAt is kept').to.equal(movement.confirmedAt);
    expect(response.body.items, 'lines stay on the ledger').to.deep.equal(movement.items);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'stock restored').to.equal(100);
  });

  it('cancelling a confirmed transfer reverts both locations', async () => {
    const movement = await registerConfirmed(client, {
      type: MovementType.TRANSFER,
      locationId: LOCATIONS.MAIN,
      destinationLocationId: LOCATIONS.BAR,
      items: line(PRODUCTS.RUM, 4),
    });

    const response = await client.post(
      `/movements/${movement.id}/cancel`,
      CANCEL,
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(201);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'origin').to.equal(100);
    expect(api.ledger.stockOf(LOCATIONS.BAR, PRODUCTS.RUM), 'destination').to.equal(5);
  });

  it('cancelling an inbound whose goods already left answers 400 and keeps it confirmed', async () => {
    const received = await registerConfirmed(client, {
      type: MovementType.INBOUND,
      locationId: LOCATIONS.BAR,
      items: line(PRODUCTS.WHISKY, 6),
    });
    await registerConfirmed(client, {
      type: MovementType.OUTBOUND,
      locationId: LOCATIONS.BAR,
      items: line(PRODUCTS.WHISKY, 5),
    });

    const response = await client.post(
      `/movements/${received.id}/cancel`,
      CANCEL,
      UserRole.MANAGER,
    );
    const after = await client.get(`/movements/${received.id}`, UserRole.MANAGER);

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include('Not enough stock');
    expect(after.body.status, 'still confirmed').to.equal(MovementStatus.CONFIRMED);
    expect(api.ledger.stockOf(LOCATIONS.BAR, PRODUCTS.WHISKY), 'stock').to.equal(1);
  });

  it('cancelling a movement twice answers 409', async () => {
    const movement = await registerConfirmed(client, {
      type: MovementType.OUTBOUND,
      items: line(PRODUCTS.RUM, 1),
    });
    await client.post(`/movements/${movement.id}/cancel`, CANCEL, UserRole.MANAGER);

    const response = await client.post(
      `/movements/${movement.id}/cancel`,
      CANCEL,
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(409);
    expect(response.body.message, 'message').to.equal('The movement is already cancelled');
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'stock returned only once').to.equal(
      100,
    );
  });

  it('a cancelled movement can no longer be confirmed: 409', async () => {
    const created = await client.post(
      '/movements',
      { type: MovementType.OUTBOUND, items: line(PRODUCTS.RUM, 1) },
      UserRole.MANAGER,
    );
    await client.post(`/movements/${created.body.id}/cancel`, CANCEL, UserRole.MANAGER);

    const response = await client.post(
      `/movements/${created.body.id}/confirm`,
      undefined,
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(409);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'stock').to.equal(100);
  });

  it.each([
    ['without a body', undefined],
    ['without a reason', {}],
    ['with a reason shorter than 4 characters', { reason: 'no' }],
    ['with a field the DTO does not declare', { reason: 'Registrado por error', force: true }],
  ])('a cancel request %s is rejected with 400', async (_label, body) => {
    const movement = await registerConfirmed(client, {
      type: MovementType.OUTBOUND,
      items: line(PRODUCTS.RUM, 1),
    });

    const response = await client.post(`/movements/${movement.id}/cancel`, body, UserRole.MANAGER);

    expect(response.status, 'status').to.equal(400);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'stock untouched').to.equal(99);
  });

  it('an OPERATOR may not cancel a movement: 403', async () => {
    const movement = await registerConfirmed(
      client,
      { type: MovementType.OUTBOUND, items: line(PRODUCTS.RUM, 1) },
      UserRole.OPERATOR,
    );

    const response = await client.post(
      `/movements/${movement.id}/cancel`,
      CANCEL,
      UserRole.OPERATOR,
    );

    expect(response.status, 'status').to.equal(403);
    expect(response.body.message, 'message').to.equal('Insufficient permissions');
  });

  it('a cancel request without credentials answers 401', async () => {
    const response = await client.post(`/movements/${UNKNOWN_ID}/cancel`, CANCEL, null);

    expect(response.status, 'status').to.equal(401);
  });

  it('cancelling a movement that does not exist answers 404', async () => {
    const response = await client.post(`/movements/${UNKNOWN_ID}/cancel`, CANCEL, UserRole.MANAGER);

    expect(response.status, 'status').to.equal(404);
    expect(response.body.message, 'message').to.equal('Movement not found');
  });

  it('cancelling with a malformed id answers 400', async () => {
    const response = await client.post('/movements/123/cancel', CANCEL, UserRole.MANAGER);

    expect(response.status, 'status').to.equal(400);
  });
});
