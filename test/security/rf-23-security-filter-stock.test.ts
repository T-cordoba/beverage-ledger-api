import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../api/support/api-test-app';
import { OTHER_TENANT, UNKNOWN_ID } from '../api/support/in-memory-ledger';
import { expectSafeError } from './support/safe-error';

const withoutTimestamp = ({
  timestamp: _timestamp,
  path: _path,
  ...rest
}: Record<string, unknown>) => rest;

describe('RF-23 Security - Filter stock', () => {
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
    ['a tautology', "' OR '1'='1"],
    ['a stacked statement', "'; DROP TABLE products; --"],
    ['a UNION', "' UNION SELECT password_hash FROM users --"],
    ['a comment and quotes', '"/**/--'],
    ['LIKE wildcards', '%_%'],
  ])(
    'a search carrying %s reaches the repository as a literal and matches nothing',
    async (_label, search) => {
      // Arrange
      const findPage = vi.spyOn(api.repositories.stock, 'findPage');

      // Act
      const response = await client.get(
        `/stock?search=${encodeURIComponent(search)}`,
        UserRole.OPERATOR,
      );

      // Assert
      expect(response.status, 'status').to.equal(200);
      expect(response.body.meta.total, 'total').to.equal(0);
      expect(findPage.mock.calls[0]![3].search, 'literal').to.equal(search);
    },
  );

  it('a search over 120 characters answers 400 before the repository is asked', async () => {
    // Arrange
    const findPage = vi.spyOn(api.repositories.stock, 'findPage');

    // Act
    const response = await client.get(
      `/stock?search=${encodeURIComponent(`' OR 1=1 -- ${'x'.repeat(120)}`)}`,
      UserRole.OPERATOR,
    );

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(
      'search must be shorter than or equal to 120 characters',
    );
    expect(findPage.mock.calls, 'repository untouched').to.have.lengthOf(0);
  });

  it('a search sent twice is rejected instead of being merged: 400', async () => {
    // Act
    const response = await client.get('/stock?search=ron&search=gin', UserRole.OPERATOR);

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include('search must be a string');
  });

  it('bracket syntax is not parsed into a filter object: 400', async () => {
    // Act
    const response = await client.get('/stock?search[contains]=ron', UserRole.OPERATOR);

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(
      'property search[contains] should not exist',
    );
  });

  it.each([
    ['categoryId', "1' OR '1'='1"],
    ['locationId', '../../locations'],
  ])(
    '%s carrying an injection answers 400 before the repository is asked',
    async (param, value) => {
      // Arrange
      const findPage = vi.spyOn(api.repositories.stock, 'findPage');

      // Act
      const response = await client.get(
        `/stock?${param}=${encodeURIComponent(value)}`,
        UserRole.OPERATOR,
      );

      // Assert
      expectSafeError(response, 400);
      expect(response.body.message, 'message').to.include(`${param} must be a UUID`);
      expect(findPage.mock.calls, 'repository untouched').to.have.lengthOf(0);
    },
  );

  it("another organization's location answers exactly like one that does not exist", async () => {
    // Arrange
    api.ledger.seedOtherTenant();

    // Act
    const foreign = await client.get(
      `/stock?locationId=${OTHER_TENANT.LOCATION}`,
      UserRole.OPERATOR,
    );
    const unknown = await client.get(`/stock?locationId=${UNKNOWN_ID}`, UserRole.OPERATOR);

    // Assert
    expectSafeError(foreign, 400);
    expect(withoutTimestamp(foreign.body), 'no existence oracle').to.deep.equal(
      withoutTimestamp(unknown.body),
    );
  });

  it("filtering by another organization's category reveals none of its products", async () => {
    // Arrange
    api.ledger.seedOtherTenant();

    // Act
    const response = await client.get(
      `/stock?categoryId=${OTHER_TENANT.CATEGORY}`,
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.data, 'data').to.deep.equal([]);
  });

  it('a search for another organization’s product name finds nothing', async () => {
    // Arrange
    api.ledger.seedOtherTenant();

    // Act
    const response = await client.get('/stock?search=vodka', UserRole.OPERATOR);

    // Assert
    expect(response.body.meta.total, 'total').to.equal(0);
  });

  it('a filter without credentials answers 401', async () => {
    // Act
    const response = await client.get('/stock?search=ron', null);

    // Assert
    expectSafeError(response, 401);
  });
});
