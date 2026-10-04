import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
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

const inbound = (overrides: Record<string, unknown> = {}) => ({
  type: MovementType.INBOUND,
  items: [{ productId: PRODUCTS.WHISKY, quantity: 6, unit: MovementUnit.BOTTLE }],
  ...overrides,
});

describe('RF-16 API - Register an inbound movement (INBOUND)', () => {
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

  it('POST /movements opens an inbound draft with 201 and a positive line', async () => {
    const response = await client.post(
      '/movements',
      inbound({ note: 'Factura proveedor 991' }),
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(201);
    expect(response.body, 'body').to.include({
      type: MovementType.INBOUND,
      status: MovementStatus.DRAFT,
      locationId: LOCATIONS.MAIN,
      destinationLocationId: null,
      note: 'Factura proveedor 991',
    });
    expect(response.body.items, 'lines').to.have.lengthOf(1);
    expect(response.body.items[0], 'line').to.include({
      productId: PRODUCTS.WHISKY,
      quantity: 6,
      quantityBase: 6,
      locationId: LOCATIONS.MAIN,
    });
  });

  it('an inbound into an explicit location by the case is written there in bottles', async () => {
    const response = await client.post(
      '/movements',
      inbound({
        locationId: LOCATIONS.BAR,
        items: [{ productId: PRODUCTS.WHISKY, quantity: 2, unit: MovementUnit.CASE }],
      }),
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(201);
    expect(response.body.locationId, 'header location').to.equal(LOCATIONS.BAR);
    expect(response.body.items[0], 'line').to.include({
      locationId: LOCATIONS.BAR,
      quantityBase: 12,
    });
  });

  it('POST /movements/:id/confirm adds the inbound to stock, creating the level if missing', async () => {
    const created = await client.post(
      '/movements',
      inbound({ locationId: LOCATIONS.BAR }),
      UserRole.MANAGER,
    );

    const response = await client.post(
      `/movements/${created.body.id}/confirm`,
      undefined,
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(201);
    expect(response.body.status, 'status field').to.equal(MovementStatus.CONFIRMED);
    expect(api.ledger.stockOf(LOCATIONS.BAR, PRODUCTS.WHISKY), 'new stock level').to.equal(6);
  });

  it('confirming the same inbound twice answers 409 and does not add stock twice', async () => {
    const created = await client.post('/movements', inbound(), UserRole.MANAGER);
    await client.post(`/movements/${created.body.id}/confirm`, undefined, UserRole.MANAGER);

    const response = await client.post(
      `/movements/${created.body.id}/confirm`,
      undefined,
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(409);
    expect(response.body.message, 'message').to.equal(
      'A CONFIRMED movement can no longer be edited',
    );
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.WHISKY), 'stock').to.equal(16);
  });

  it('an OPERATOR may not record an inbound: 403', async () => {
    const response = await client.post('/movements', inbound(), UserRole.OPERATOR);

    expect(response.status, 'status').to.equal(403);
    expect(response.body.message, 'message').to.equal('You may not record INBOUND movements');
    expect(api.ledger.movements.size, 'nothing written').to.equal(0);
  });

  it.each([
    ['zero', 0],
    ['negative', -6],
  ])('a %s inbound quantity is rejected with 400', async (_label, quantity) => {
    const response = await client.post(
      '/movements',
      inbound({ items: [{ productId: PRODUCTS.WHISKY, quantity, unit: MovementUnit.BOTTLE }] }),
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal(
      'A INBOUND line must be positive; the movement type carries the direction',
    );
  });

  it('an inbound into a location that does not exist answers 400', async () => {
    const response = await client.post(
      '/movements',
      inbound({ locationId: UNKNOWN_ID }),
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('That location does not exist');
  });

  it('an inbound of a deactivated product answers 400', async () => {
    const response = await client.post(
      '/movements',
      inbound({
        items: [{ productId: PRODUCTS.RETIRED_GIN, quantity: 1, unit: MovementUnit.BOTTLE }],
      }),
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include('deactivated');
  });

  it.each([
    ['a locationId that is not a UUID', inbound({ locationId: 'bodega' })],
    [
      'a quantity sent as text',
      inbound({ items: [{ productId: PRODUCTS.WHISKY, quantity: 'seis', unit: 'BOTTLE' }] }),
    ],
    ['a note over 500 characters', inbound({ note: 'x'.repeat(501) })],
  ])('a body with %s is rejected with 400 by validation', async (_label, body) => {
    const response = await client.post('/movements', body, UserRole.MANAGER);

    expect(response.status, 'status').to.equal(400);
    expect(response.body.error, 'error').to.equal('Bad Request');
    expect(response.body.message, 'validation messages').to.be.an('array').that.is.not.empty;
  });
});
