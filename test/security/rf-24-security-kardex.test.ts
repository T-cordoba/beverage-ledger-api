import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../api/support/api-test-app';
import { OTHER_TENANT, PRODUCTS, UNKNOWN_ID } from '../api/support/in-memory-ledger';
import { expectSafeError } from './support/safe-error';

const withoutVolatile = ({
  timestamp: _timestamp,
  path: _path,
  ...rest
}: Record<string, unknown>) => rest;

describe('RF-24 Security - Read the kardex of a product', () => {
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
    ['a path traversal', '..%2F..%2Fusers'],
    ['an encoded traversal', '%2E%2E%2F%2E%2E%2Fetc%2Fpasswd'],
    ['an SQL tautology', encodeURIComponent("' OR '1'='1")],
    ['a stacked statement', encodeURIComponent(`${PRODUCTS.RUM}'; DROP TABLE movements; --`)],
    ['a null byte', `${PRODUCTS.RUM}%00`],
    ['a UUID with trailing junk', `${PRODUCTS.RUM}x`],
  ])('a productId carrying %s answers 400 without reaching any repository', async (_label, id) => {
    // Arrange
    const findById = vi.spyOn(api.repositories.products, 'findById');
    const kardex = vi.spyOn(api.repositories.movements, 'kardex');

    // Act
    const response = await client.get(`/stock/${id}/kardex`, UserRole.OPERATOR);

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.equal('Validation failed (uuid is expected)');
    expect(findById.mock.calls, 'catalogue untouched').to.have.lengthOf(0);
    expect(kardex.mock.calls, 'ledger untouched').to.have.lengthOf(0);
  });

  it("another organization's product answers 404, identical to one that does not exist", async () => {
    // Arrange
    api.ledger.seedOtherTenant();
    const kardex = vi.spyOn(api.repositories.movements, 'kardex');

    // Act
    const foreign = await client.get(`/stock/${OTHER_TENANT.PRODUCT}/kardex`, UserRole.OPERATOR);
    const unknown = await client.get(`/stock/${UNKNOWN_ID}/kardex`, UserRole.OPERATOR);

    // Assert
    expectSafeError(foreign, 404);
    expect(withoutVolatile(foreign.body), 'no existence oracle').to.deep.equal(
      withoutVolatile(unknown.body),
    );
    expect(kardex.mock.calls, 'ledger untouched').to.have.lengthOf(0);
    expect(foreign.raw.toString('utf8'), 'name').not.to.include('Vodka Secreto');
  });

  it("another organization's location answers 400 even for one of our products", async () => {
    // Arrange
    api.ledger.seedOtherTenant();

    // Act
    const response = await client.get(
      `/stock/${PRODUCTS.RUM}/kardex?locationId=${OTHER_TENANT.LOCATION}`,
      UserRole.OPERATOR,
    );

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.equal('That location does not exist');
  });

  it.each([
    ['organizationId', OTHER_TENANT.ORGANIZATION_ID],
    ['status', 'DRAFT'],
    ['includeCancelled', 'true'],
  ])('a query param the DTO does not declare (%s) answers 400', async (param, value) => {
    // Act
    const response = await client.get(
      `/stock/${PRODUCTS.RUM}/kardex?${param}=${value}`,
      UserRole.OPERATOR,
    );

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(`property ${param} should not exist`);
  });

  it('a pageSize far over the limit cannot dump the whole ledger: 400', async () => {
    // Act
    const response = await client.get(
      `/stock/${PRODUCTS.RUM}/kardex?pageSize=100000`,
      UserRole.OPERATOR,
    );

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include('pageSize must not be greater than 100');
  });

  it.each([
    ['no role header', null],
    ['a role the API does not know', 'AUDITOR' as UserRole],
  ])('with %s the kardex answers 401', async (_label, role) => {
    // Act
    const response = await client.get(`/stock/${PRODUCTS.RUM}/kardex`, role);

    // Assert
    expectSafeError(response, 401);
  });
});
