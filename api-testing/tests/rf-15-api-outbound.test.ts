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

const outbound = (overrides: Record<string, unknown> = {}) => ({
  type: MovementType.OUTBOUND,
  items: [{ productId: PRODUCTS.RUM, quantity: 2, unit: MovementUnit.BOTTLE }],
  ...overrides,
});

describe('RF-15 API - Register an outbound movement (OUTBOUND)', () => {
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

  it('POST /movements opens an outbound draft with 201 and the movement contract', async () => {
    const response = await client.post(
      '/movements',
      outbound({ note: 'Venta mostrador' }),
      UserRole.OPERATOR,
    );

    expect(response.status, 'status').to.equal(201);
    expect(response.headers.get('content-type'), 'content type').to.include('application/json');
    expect(response.body, 'body').to.include({
      type: MovementType.OUTBOUND,
      status: MovementStatus.DRAFT,
      locationId: LOCATIONS.MAIN,
      destinationLocationId: null,
      reason: null,
      note: 'Venta mostrador',
      confirmedAt: null,
      cancelledAt: null,
    });
    expect(response.body.code, 'code').to.match(/^MOV-\d{4}-\d{6}$/);
    expect(response.body.createdBy, 'author').to.deep.equal({
      id: '1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b',
      name: 'Olga Operator',
    });
    expect(response.body.items, 'lines').to.have.lengthOf(1);
    expect(response.body.items[0], 'line').to.include({
      productId: PRODUCTS.RUM,
      locationId: LOCATIONS.MAIN,
      quantity: 2,
      unit: MovementUnit.BOTTLE,
      quantityBase: -2,
      productNameSnapshot: 'Ron Viejo de Caldas',
      brandNameSnapshot: 'ILC',
    });
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'a draft leaves stock alone').to.equal(
      100,
    );
  });

  it('an outbound by the case is normalized to bottles with the case size', async () => {
    const response = await client.post(
      '/movements',
      outbound({ items: [{ productId: PRODUCTS.RUM, quantity: 2, unit: MovementUnit.CASE }] }),
      UserRole.OPERATOR,
    );

    expect(response.status, 'status').to.equal(201);
    expect(response.body.items[0].quantityBase, '2 cases of 12').to.equal(-24);
  });

  it('POST /movements/:id/confirm applies the outbound and subtracts it from stock', async () => {
    const created = await client.post('/movements', outbound(), UserRole.OPERATOR);

    const response = await client.post(
      `/movements/${created.body.id}/confirm`,
      undefined,
      UserRole.OPERATOR,
    );

    expect(response.status, 'status').to.equal(201);
    expect(response.body.status, 'status field').to.equal(MovementStatus.CONFIRMED);
    expect(response.body.confirmedAt, 'confirmedAt').to.be.a('string');
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'stock after').to.equal(98);
  });

  it('confirming an outbound beyond stock answers 400 and leaves the draft and stock untouched', async () => {
    const created = await client.post(
      '/movements',
      outbound({
        items: [{ productId: PRODUCTS.WHISKY, quantity: 11, unit: MovementUnit.BOTTLE }],
      }),
      UserRole.OPERATOR,
    );

    const response = await client.post(
      `/movements/${created.body.id}/confirm`,
      undefined,
      UserRole.OPERATOR,
    );
    const after = await client.get(`/movements/${created.body.id}`, UserRole.OPERATOR);

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include('Not enough stock');
    expect(after.body.status, 'still a draft').to.equal(MovementStatus.DRAFT);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.WHISKY), 'stock').to.equal(10);
  });

  it.each([
    ['zero', 0],
    ['negative', -3],
  ])('a %s outbound quantity is rejected with 400', async (_label, quantity) => {
    const response = await client.post(
      '/movements',
      outbound({ items: [{ productId: PRODUCTS.RUM, quantity, unit: MovementUnit.BOTTLE }] }),
      UserRole.OPERATOR,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include('must be positive');
  });

  it.each([
    ['without items', { type: MovementType.OUTBOUND }],
    ['with an empty item list', outbound({ items: [] })],
    [
      'with a productId that is not a UUID',
      outbound({ items: [{ productId: 'rum', quantity: 1, unit: 'BOTTLE' }] }),
    ],
    [
      'with an unknown unit',
      outbound({ items: [{ productId: PRODUCTS.RUM, quantity: 1, unit: 'LITER' }] }),
    ],
    [
      'with a fractional quantity',
      outbound({ items: [{ productId: PRODUCTS.RUM, quantity: 1.5, unit: 'BOTTLE' }] }),
    ],
    ['with an unknown type', outbound({ type: 'SALE' })],
    ['with a field the DTO does not declare', outbound({ price: 1000 })],
  ])('a body %s is rejected with 400 by validation', async (_label, body) => {
    const response = await client.post('/movements', body, UserRole.OPERATOR);

    expect(response.status, 'status').to.equal(400);
    expect(response.body, 'error shape').to.include.keys(
      'statusCode',
      'error',
      'message',
      'path',
      'timestamp',
    );
    expect(response.body.path, 'path').to.equal('/api/v1/movements');
  });

  it('an outbound naming a product outside the catalogue answers 400', async () => {
    const response = await client.post(
      '/movements',
      outbound({ items: [{ productId: UNKNOWN_ID, quantity: 1, unit: MovementUnit.BOTTLE }] }),
      UserRole.OPERATOR,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include('Unknown products');
  });

  it('an outbound with a destination location answers 400', async () => {
    const response = await client.post(
      '/movements',
      outbound({ destinationLocationId: LOCATIONS.BAR }),
      UserRole.OPERATOR,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal(
      'A OUTBOUND movement has no destination location',
    );
  });

  it('a request without credentials answers 401', async () => {
    const response = await client.post('/movements', outbound(), null);

    expect(response.status, 'status').to.equal(401);
    expect(api.ledger.movements.size, 'nothing written').to.equal(0);
  });

  it('confirming a movement that does not exist answers 404', async () => {
    const response = await client.post(
      `/movements/${UNKNOWN_ID}/confirm`,
      undefined,
      UserRole.OPERATOR,
    );

    expect(response.status, 'status').to.equal(404);
    expect(response.body.message, 'message').to.equal('Movement not found');
  });

  it('confirming with a malformed id answers 400', async () => {
    const response = await client.post(
      '/movements/not-a-uuid/confirm',
      undefined,
      UserRole.OPERATOR,
    );

    expect(response.status, 'status').to.equal(400);
  });
});
