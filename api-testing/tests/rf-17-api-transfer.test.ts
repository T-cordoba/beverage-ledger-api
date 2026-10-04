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

const transfer = (overrides: Record<string, unknown> = {}) => ({
  type: MovementType.TRANSFER,
  locationId: LOCATIONS.MAIN,
  destinationLocationId: LOCATIONS.BAR,
  items: [{ productId: PRODUCTS.RUM, quantity: 10, unit: MovementUnit.BOTTLE }],
  ...overrides,
});

describe('RF-17 API - Register a transfer between locations (TRANSFER)', () => {
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

  it('POST /movements opens a transfer draft with 201 and one line per side', async () => {
    const response = await client.post('/movements', transfer(), UserRole.MANAGER);

    expect(response.status, 'status').to.equal(201);
    expect(response.body, 'body').to.include({
      type: MovementType.TRANSFER,
      status: MovementStatus.DRAFT,
      locationId: LOCATIONS.MAIN,
      destinationLocationId: LOCATIONS.BAR,
    });
    expect(
      response.body.items.map((item: any) => ({
        locationId: item.locationId,
        quantityBase: item.quantityBase,
      })),
      'outgoing half first, then incoming',
    ).to.deep.equal([
      { locationId: LOCATIONS.MAIN, quantityBase: -10 },
      { locationId: LOCATIONS.BAR, quantityBase: 10 },
    ]);
  });

  it('POST /movements/:id/confirm moves the stock from origin to destination', async () => {
    const created = await client.post(
      '/movements',
      transfer({ items: [{ productId: PRODUCTS.RUM, quantity: 1, unit: MovementUnit.CASE }] }),
      UserRole.MANAGER,
    );

    const response = await client.post(
      `/movements/${created.body.id}/confirm`,
      undefined,
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(201);
    expect(response.body.status, 'status field').to.equal(MovementStatus.CONFIRMED);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'origin').to.equal(88);
    expect(api.ledger.stockOf(LOCATIONS.BAR, PRODUCTS.RUM), 'destination').to.equal(17);
  });

  it('confirming a transfer beyond the origin stock answers 400 and moves nothing', async () => {
    const created = await client.post(
      '/movements',
      transfer({
        locationId: LOCATIONS.BAR,
        destinationLocationId: LOCATIONS.MAIN,
        items: [{ productId: PRODUCTS.RUM, quantity: 6, unit: MovementUnit.BOTTLE }],
      }),
      UserRole.MANAGER,
    );

    const response = await client.post(
      `/movements/${created.body.id}/confirm`,
      undefined,
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include('Not enough stock');
    expect(api.ledger.stockOf(LOCATIONS.BAR, PRODUCTS.RUM), 'origin').to.equal(5);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'destination').to.equal(100);
  });

  it('a transfer without a destination answers 400', async () => {
    const { destinationLocationId: _omitted, ...body } = transfer();

    const response = await client.post('/movements', body, UserRole.MANAGER);

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('A transfer needs a destination location');
  });

  it('a transfer whose destination is its own origin answers 400', async () => {
    const response = await client.post(
      '/movements',
      transfer({ destinationLocationId: LOCATIONS.MAIN }),
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('A transfer needs two different locations');
  });

  it('a transfer to a location that does not exist answers 400', async () => {
    const response = await client.post(
      '/movements',
      transfer({ destinationLocationId: UNKNOWN_ID }),
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('That location does not exist');
  });

  it('a destinationLocationId that is not a UUID is rejected with 400 by validation', async () => {
    const response = await client.post(
      '/movements',
      transfer({ destinationLocationId: 'barra' }),
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'validation messages').to.be.an('array').that.is.not.empty;
  });

  it('a negative transfer quantity is rejected with 400', async () => {
    const response = await client.post(
      '/movements',
      transfer({ items: [{ productId: PRODUCTS.RUM, quantity: -10, unit: MovementUnit.BOTTLE }] }),
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include('must be positive');
  });

  it('an OPERATOR may not record a transfer: 403', async () => {
    const response = await client.post('/movements', transfer(), UserRole.OPERATOR);

    expect(response.status, 'status').to.equal(403);
    expect(response.body.message, 'message').to.equal('You may not record TRANSFER movements');
  });
});
