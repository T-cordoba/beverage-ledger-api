import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../api/support/api-test-app';
import { OTHER_TENANT } from '../api/support/in-memory-ledger';
import { expectSafeError } from './support/safe-error';

describe('RF-27 Security - List products below their minimum', () => {
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
    ['a limit far over the cap', 'limit=1000000', 'limit must not be greater than 100'],
    ['a negative limit', 'limit=-5', 'limit must not be less than 1'],
    [
      'a limit carrying SQL',
      `limit=${encodeURIComponent('10; DROP TABLE products')}`,
      'limit must be an integer number',
    ],
    ['a fractional limit', 'limit=2.5', 'limit must be an integer number'],
    ['a limit sent twice', 'limit=1&limit=100', 'limit must be an integer number'],
  ])('%s answers 400 before the raw query is built', async (_label, query, message) => {
    // Arrange
    const findBelowMinimum = vi.spyOn(api.repositories.stock, 'findBelowMinimum');

    // Act
    const response = await client.get(`/stock/low?${query}`, UserRole.OPERATOR);

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(message);
    expect(findBelowMinimum.mock.calls, 'repository untouched').to.have.lengthOf(0);
  });

  it('the limit reaches the raw query as a number, never as request text', async () => {
    // Arrange
    const findBelowMinimum = vi.spyOn(api.repositories.stock, 'findBelowMinimum');

    // Act
    await client.get('/stock/low?limit=7', UserRole.OPERATOR);

    // Assert
    expect(findBelowMinimum.mock.calls[0]![1], 'limit').to.be.a('number').and.equal(7);
  });

  it.each([
    ['organizationId', OTHER_TENANT.ORGANIZATION_ID],
    ['minimumStock', '0'],
    ['threshold', '1000'],
  ])('a query param the DTO does not declare (%s) answers 400', async (param, value) => {
    // Act
    const response = await client.get(`/stock/low?${param}=${value}`, UserRole.OPERATOR);

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(`property ${param} should not exist`);
  });

  it("another organization's product never shows up, however far below minimum it is", async () => {
    // Arrange
    api.ledger.seedOtherTenant();

    // Act
    const response = await client.get('/stock/low?limit=100', UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.map((row: { productId: string }) => row.productId)).not.to.include(
      OTHER_TENANT.PRODUCT,
    );
    expect(response.raw.toString('utf8'), 'name').not.to.include('Vodka Secreto');
  });

  it("another organization's location answers 400", async () => {
    // Arrange
    api.ledger.seedOtherTenant();

    // Act
    const response = await client.get(
      `/stock/low?locationId=${OTHER_TENANT.LOCATION}`,
      UserRole.OPERATOR,
    );

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.equal('That location does not exist');
  });

  it.each([
    ['no role header', null],
    ['a role the API does not know', 'GUEST' as UserRole],
  ])('with %s the list answers 401', async (_label, role) => {
    // Act
    const response = await client.get('/stock/low', role);

    // Assert
    expectSafeError(response, 401);
  });
});
