import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  registerConfirmed,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from './support/api-test-app';
import {
  LOCATIONS,
  MovementType,
  MovementUnit,
  PRODUCTS,
  UNKNOWN_ID,
} from './support/in-memory-ledger';

const KARDEX_ENTRY_KEYS = [
  'id',
  'movementId',
  'movementCode',
  'type',
  'occurredAt',
  'quantity',
  'unit',
  'quantityBase',
  'balanceAfter',
];

const at = (iso: string) => new Date(iso).toISOString();

const balancesOf = (data: { quantityBase: number; balanceAfter: number }[]) =>
  data.map((entry) => [entry.quantityBase, entry.balanceAfter]);

describe('RF-24 API - Read the kardex of a product', () => {
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
    vi.restoreAllMocks();
  });

  async function whiskyHistory() {
    const inbound = await registerConfirmed(client, {
      type: MovementType.INBOUND,
      occurredAt: at('2026-02-01T10:00:00Z'),
      items: [{ productId: PRODUCTS.WHISKY, quantity: 2, unit: MovementUnit.CASE }],
    });
    const outbound = await registerConfirmed(client, {
      type: MovementType.OUTBOUND,
      occurredAt: at('2026-02-02T10:00:00Z'),
      items: [{ productId: PRODUCTS.WHISKY, quantity: 5, unit: MovementUnit.BOTTLE }],
    });
    const adjustment = await registerConfirmed(client, {
      type: MovementType.ADJUSTMENT,
      occurredAt: at('2026-02-03T10:00:00Z'),
      reason: 'Botella rota en bodega',
      items: [{ productId: PRODUCTS.WHISKY, quantity: -1, unit: MovementUnit.BOTTLE }],
    });

    return { inbound, outbound, adjustment };
  }

  it('GET /stock/:productId/kardex lists confirmed lines newest first with the running balance', async () => {
    // Arrange
    const { inbound, outbound, adjustment } = await whiskyHistory();

    // Act
    const response = await client.get(`/stock/${PRODUCTS.WHISKY}/kardex`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(
      response.body.data.map((entry: { movementCode: string }) => entry.movementCode),
      'order',
    ).to.deep.equal([adjustment.code, outbound.code, inbound.code]);
    expect(balancesOf(response.body.data), 'quantity and balance').to.deep.equal([
      [-1, 6],
      [-5, 7],
      [12, 12],
    ]);
    expect(response.body.meta, 'meta').to.deep.equal({
      page: 1,
      pageSize: 25,
      total: 3,
      pageCount: 1,
      count: 3,
    });
  });

  it('each entry carries the kardex contract, with the balance as a JSON number', async () => {
    // Arrange
    const { inbound } = await whiskyHistory();

    // Act
    const response = await client.get(`/stock/${PRODUCTS.WHISKY}/kardex`, UserRole.OPERATOR);
    const oldest = response.body.data[2];

    // Assert
    expect(Object.keys(oldest), 'keys').to.have.members(KARDEX_ENTRY_KEYS);
    expect(oldest, 'oldest').to.include({
      movementId: inbound.id,
      movementCode: inbound.code,
      type: MovementType.INBOUND,
      occurredAt: '2026-02-01T10:00:00.000Z',
      quantity: 2,
      unit: MovementUnit.CASE,
      quantityBase: 12,
      balanceAfter: 12,
    });
    expect(oldest.balanceAfter, 'balance type').to.be.a('number');
  });

  it('a draft and a cancelled movement are left out of the kardex', async () => {
    // Arrange
    await whiskyHistory();
    await client.post('/movements', {
      type: MovementType.OUTBOUND,
      items: [{ productId: PRODUCTS.WHISKY, quantity: 1, unit: MovementUnit.BOTTLE }],
    });
    const voided = await registerConfirmed(client, {
      type: MovementType.OUTBOUND,
      items: [{ productId: PRODUCTS.WHISKY, quantity: 2, unit: MovementUnit.BOTTLE }],
    });
    await client.post(`/movements/${voided.id}/cancel`, { reason: 'Registrado por error' });

    // Act
    const response = await client.get(`/stock/${PRODUCTS.WHISKY}/kardex`, UserRole.OPERATOR);

    // Assert
    expect(response.body.meta.total, 'total').to.equal(3);
    expect(response.body.data[0].balanceAfter, 'latest balance').to.equal(6);
  });

  it('a transfer appears in the kardex of both locations with the sign each one saw', async () => {
    // Arrange
    await registerConfirmed(client, {
      type: MovementType.TRANSFER,
      locationId: LOCATIONS.MAIN,
      destinationLocationId: LOCATIONS.BAR,
      items: [{ productId: PRODUCTS.RUM, quantity: 3, unit: MovementUnit.BOTTLE }],
    });

    // Act
    const main = await client.get(`/stock/${PRODUCTS.RUM}/kardex`, UserRole.OPERATOR);
    const bar = await client.get(
      `/stock/${PRODUCTS.RUM}/kardex?locationId=${LOCATIONS.BAR}`,
      UserRole.OPERATOR,
    );

    // Assert
    expect(balancesOf(main.body.data), 'main').to.deep.equal([[-3, -3]]);
    expect(balancesOf(bar.body.data), 'bar').to.deep.equal([[3, 3]]);
    expect(main.body.data[0].type, 'type').to.equal(MovementType.TRANSFER);
  });

  it('a later page keeps the balance accumulated from the very first line', async () => {
    // Arrange
    await whiskyHistory();

    // Act
    const response = await client.get(
      `/stock/${PRODUCTS.WHISKY}/kardex?page=2&pageSize=2`,
      UserRole.OPERATOR,
    );

    // Assert
    expect(balancesOf(response.body.data), 'oldest line').to.deep.equal([[12, 12]]);
    expect(response.body.meta, 'meta').to.deep.equal({
      page: 2,
      pageSize: 2,
      total: 3,
      pageCount: 2,
      count: 1,
    });
  });

  it('a product that never moved has an empty kardex, not a 404', async () => {
    // Act
    const response = await client.get(`/stock/${PRODUCTS.AGUARDIENTE}/kardex`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.data, 'data').to.deep.equal([]);
    expect(response.body.meta, 'meta').to.include({ total: 0, pageCount: 1 });
  });

  it('a product that does not exist answers 404 and the ledger is never read', async () => {
    // Arrange
    const kardex = vi.spyOn(api.repositories.movements, 'kardex');

    // Act
    const response = await client.get(`/stock/${UNKNOWN_ID}/kardex`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(404);
    expect(response.body.message, 'message').to.equal('Product not found');
    expect(kardex.mock.calls, 'ledger untouched').to.have.lengthOf(0);
  });

  it('a productId that is not a UUID answers 400', async () => {
    // Act
    const response = await client.get('/stock/old-parr/kardex', UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('Validation failed (uuid is expected)');
  });

  it.each([
    ['a location that does not exist', `locationId=${UNKNOWN_ID}`, 'That location does not exist'],
    ['a locationId that is not a UUID', 'locationId=bar', 'locationId must be a UUID'],
    ['a pageSize over 100', 'pageSize=101', 'pageSize must not be greater than 100'],
  ])('%s answers 400', async (_label, query, message) => {
    // Act
    const response = await client.get(
      `/stock/${PRODUCTS.WHISKY}/kardex?${query}`,
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include(message);
  });

  it('a request without credentials answers 401', async () => {
    // Act
    const response = await client.get(`/stock/${PRODUCTS.WHISKY}/kardex`, null);

    // Assert
    expect(response.status, 'status').to.equal(401);
  });
});
