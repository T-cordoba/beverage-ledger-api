import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
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

const STOCK_LEVEL_KEYS = [
  'productId',
  'productName',
  'brandName',
  'categoryName',
  'quantityBase',
  'caseSize',
  'minimumStock',
  'isBelowMinimum',
];

const namesOf = (data: { productName: string }[]) => data.map((row) => row.productName);

describe('RF-22 API - Check current stock levels', () => {
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

  it('GET /stock lists every active product at the default location, by name, with the page meta', async () => {
    // Act
    const response = await client.get('/stock', UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.headers.get('content-type'), 'content type').to.include('application/json');
    expect(namesOf(response.body.data), 'names').to.deep.equal([
      'Aguardiente Antioqueño',
      'Old Parr 12',
      'Ron Viejo de Caldas',
    ]);
    expect(response.body.meta, 'meta').to.deep.equal({
      page: 1,
      pageSize: 25,
      total: 3,
      pageCount: 1,
      count: 3,
    });
  });

  it('each row carries the stock level contract', async () => {
    // Act
    const response = await client.get('/stock', UserRole.OPERATOR);
    const rum = response.body.data.find(
      (row: { productId: string }) => row.productId === PRODUCTS.RUM,
    );

    // Assert
    expect(Object.keys(rum), 'keys').to.have.members(STOCK_LEVEL_KEYS);
    expect(rum, 'rum').to.deep.equal({
      productId: PRODUCTS.RUM,
      productName: 'Ron Viejo de Caldas',
      brandName: 'ILC',
      categoryName: 'Ron',
      quantityBase: 100,
      caseSize: 12,
      minimumStock: 24,
      isBelowMinimum: false,
    });
  });

  it('a product that never moved is listed at zero instead of disappearing', async () => {
    // Act
    const response = await client.get('/stock', UserRole.OPERATOR);
    const aguardiente = response.body.data.find(
      (row: { productId: string }) => row.productId === PRODUCTS.AGUARDIENTE,
    );

    // Assert
    expect(aguardiente.quantityBase, 'quantity').to.equal(0);
    expect(aguardiente.isBelowMinimum, 'below minimum').to.equal(true);
  });

  it('a deactivated product is not listed', async () => {
    // Act
    const response = await client.get('/stock', UserRole.OPERATOR);

    // Assert
    expect(response.body.data.map((row: { productId: string }) => row.productId)).not.to.include(
      PRODUCTS.RETIRED_GIN,
    );
  });

  it('isBelowMinimum is true at the threshold itself, not only under it', async () => {
    // Arrange
    await registerConfirmed(client, {
      type: MovementType.INBOUND,
      items: [{ productId: PRODUCTS.WHISKY, quantity: 2, unit: MovementUnit.BOTTLE }],
    });

    // Act
    const response = await client.get(`/stock?productIds=${PRODUCTS.WHISKY}`, UserRole.OPERATOR);

    // Assert
    expect(response.body.data[0], 'whisky').to.include({
      quantityBase: 12,
      minimumStock: 12,
      isBelowMinimum: true,
    });
  });

  it('a confirmed movement is reflected in the next read, a draft is not', async () => {
    // Arrange
    await registerConfirmed(
      client,
      {
        type: MovementType.OUTBOUND,
        items: [{ productId: PRODUCTS.RUM, quantity: 1, unit: MovementUnit.CASE }],
      },
      UserRole.OPERATOR,
    );
    await client.post(
      '/movements',
      {
        type: MovementType.OUTBOUND,
        items: [{ productId: PRODUCTS.RUM, quantity: 50, unit: MovementUnit.BOTTLE }],
      },
      UserRole.OPERATOR,
    );

    // Act
    const response = await client.get(`/stock?productIds=${PRODUCTS.RUM}`, UserRole.OPERATOR);

    // Assert
    expect(response.body.data[0].quantityBase, 'rum').to.equal(88);
  });

  it('pages split the list and the meta counts across every page', async () => {
    // Act
    const first = await client.get('/stock?page=1&pageSize=2', UserRole.OPERATOR);
    const second = await client.get('/stock?page=2&pageSize=2', UserRole.OPERATOR);

    // Assert
    expect(namesOf(first.body.data), 'page 1').to.deep.equal([
      'Aguardiente Antioqueño',
      'Old Parr 12',
    ]);
    expect(namesOf(second.body.data), 'page 2').to.deep.equal(['Ron Viejo de Caldas']);
    expect(second.body.meta, 'meta').to.deep.equal({
      page: 2,
      pageSize: 2,
      total: 3,
      pageCount: 2,
      count: 1,
    });
  });

  it('a page past the end answers 200 with no rows and the real total', async () => {
    // Act
    const response = await client.get('/stock?page=9', UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.data, 'data').to.deep.equal([]);
    expect(response.body.meta, 'meta').to.include({ page: 9, total: 3, count: 0 });
  });

  it('productIds narrows the page to the products a capture screen already holds', async () => {
    // Act
    const response = await client.get(
      `/stock?productIds=${PRODUCTS.WHISKY},${PRODUCTS.RUM}`,
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(namesOf(response.body.data), 'names').to.deep.equal([
      'Old Parr 12',
      'Ron Viejo de Caldas',
    ]);
  });

  it('productIds naming nothing in the catalogue answers an empty page', async () => {
    // Act
    const response = await client.get(`/stock?productIds=${UNKNOWN_ID}`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.meta.total, 'total').to.equal(0);
  });

  it('every role holding stock:read may list stock', async () => {
    // Act
    const statuses = await Promise.all(
      [UserRole.OPERATOR, UserRole.MANAGER, UserRole.ORG_ADMIN].map(
        async (role) => (await client.get('/stock', role)).status,
      ),
    );

    // Assert
    expect(statuses, 'statuses').to.deep.equal([200, 200, 200]);
  });

  it.each([
    ['page=0', 'page must not be less than 1'],
    ['pageSize=0', 'pageSize must not be less than 1'],
    ['pageSize=101', 'pageSize must not be greater than 100'],
    ['page=abc', 'page must be an integer number'],
    ['productIds=rum', 'each value in productIds must be a UUID'],
  ])('GET /stock?%s answers 400', async (query, message) => {
    // Act
    const response = await client.get(`/stock?${query}`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include(message);
    expect(response.body.path, 'path').to.equal(`/api/v1/stock?${query}`);
  });

  it('a request without credentials answers 401', async () => {
    // Act
    const response = await client.get('/stock', null);

    // Assert
    expect(response.status, 'status').to.equal(401);
  });

  it('the default location is the one read when none is named', async () => {
    // Act
    const implicit = await client.get('/stock', UserRole.OPERATOR);
    const explicit = await client.get(`/stock?locationId=${LOCATIONS.MAIN}`, UserRole.OPERATOR);

    // Assert
    expect(implicit.body, 'same answer').to.deep.equal(explicit.body);
  });
});
