import { randomUUID } from 'node:crypto';
import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../api/support/api-test-app';
import { OTHER_TENANT, PRODUCTS } from '../api/support/in-memory-ledger';
import { expectSafeError } from './support/safe-error';

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

describe('RF-22 Security - Check current stock levels', () => {
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

  it.each([
    ['no role header', null],
    ['a role the API does not know', 'SUPERUSER' as UserRole],
    ['an empty role header', '' as UserRole],
  ])('with %s GET /stock answers 401 without reaching the repository', async (_label, role) => {
    // Arrange
    const findPage = vi.spyOn(api.repositories.stock, 'findPage');

    // Act
    const response = await client.get('/stock', role);

    // Assert
    expectSafeError(response, 401);
    expect(findPage.mock.calls, 'repository untouched').to.have.lengthOf(0);
  });

  it.each([
    ['organizationId', OTHER_TENANT.ORGANIZATION_ID],
    ['isActive', 'false'],
    ['includeInactive', 'true'],
    ['orderBy', 'quantityBase'],
  ])('a query param the DTO does not declare (%s) answers 400', async (param, value) => {
    // Act
    const response = await client.get(`/stock?${param}=${value}`, UserRole.OPERATOR);

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(`property ${param} should not exist`);
  });

  it('more than 200 productIds answers 400 before the repository is asked', async () => {
    // Arrange
    const findPage = vi.spyOn(api.repositories.stock, 'findPage');
    const ids = Array.from({ length: 201 }, () => randomUUID()).join(',');

    // Act
    const response = await client.get(`/stock?productIds=${ids}`, UserRole.OPERATOR);

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(
      'productIds must contain no more than 200 elements',
    );
    expect(findPage.mock.calls, 'repository untouched').to.have.lengthOf(0);
  });

  it('exactly 200 productIds are accepted', async () => {
    // Arrange
    const ids = [PRODUCTS.RUM, ...Array.from({ length: 199 }, () => randomUUID())].join(',');

    // Act
    const response = await client.get(`/stock?productIds=${ids}`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.meta.total, 'only the real one').to.equal(1);
  });

  it.each([
    ['an SQL fragment', `${PRODUCTS.RUM},' OR 1=1 --`],
    ['a path traversal', `${PRODUCTS.RUM},../../etc/passwd`],
    ['a wildcard', '*'],
  ])('productIds with %s answers 400 before the repository is asked', async (_label, value) => {
    // Arrange
    const findPage = vi.spyOn(api.repositories.stock, 'findPage');

    // Act
    const response = await client.get(
      `/stock?productIds=${encodeURIComponent(value)}`,
      UserRole.OPERATOR,
    );

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include('each value in productIds must be a UUID');
    expect(findPage.mock.calls, 'repository untouched').to.have.lengthOf(0);
  });

  it("another organization's product id in productIds returns nothing about it", async () => {
    // Arrange
    api.ledger.seedOtherTenant();

    // Act
    const response = await client.get(
      `/stock?productIds=${OTHER_TENANT.PRODUCT}`,
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.data, 'data').to.deep.equal([]);
    expect(response.raw.toString('utf8'), 'name').not.to.include('Vodka Secreto');
  });

  it("the full list never includes another organization's products", async () => {
    // Arrange
    api.ledger.seedOtherTenant();

    // Act
    const response = await client.get('/stock?pageSize=100', UserRole.OPERATOR);

    // Assert
    expect(response.body.meta.total, 'total').to.equal(3);
    expect(response.raw.toString('utf8'), 'name').not.to.include('Vodka Secreto');
  });

  it('a row exposes only the declared fields, never tenant or internal ids', async () => {
    // Act
    const response = await client.get('/stock', UserRole.OPERATOR);

    // Assert
    for (const row of response.body.data) {
      expect(Object.keys(row), 'keys').to.have.members(STOCK_LEVEL_KEYS);
    }
  });

  it.each([
    ['a pageSize far over the limit', 'pageSize=1000000', 'pageSize must not be greater than 100'],
    ['a negative page', 'page=-1', 'page must not be less than 1'],
    ['a page given as an array', 'page=1&page=2', 'page must be an integer number'],
  ])('%s answers 400', async (_label, query, message) => {
    // Act
    const response = await client.get(`/stock?${query}`, UserRole.OPERATOR);

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(message);
  });
});
