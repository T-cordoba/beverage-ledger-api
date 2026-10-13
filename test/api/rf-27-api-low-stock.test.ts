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

const namesOf = (data: { productName: string }[]) => data.map((row) => row.productName);

describe('RF-27 API - List products below their minimum stock', () => {
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

  it('GET /stock/low lists what sits at or under its threshold, most urgent first', async () => {
    // Act
    const response = await client.get('/stock/low', UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body, 'a plain list, not a page').to.be.an('array');
    expect(namesOf(response.body), 'names').to.deep.equal([
      'Aguardiente Antioqueño',
      'Old Parr 12',
    ]);
  });

  it('each row carries the stock level contract with isBelowMinimum set', async () => {
    // Act
    const response = await client.get('/stock/low', UserRole.OPERATOR);

    // Assert
    expect(response.body[1], 'whisky').to.deep.equal({
      productId: PRODUCTS.WHISKY,
      productName: 'Old Parr 12',
      brandName: 'Diageo',
      categoryName: 'Whisky',
      quantityBase: 10,
      caseSize: 6,
      minimumStock: 12,
      isBelowMinimum: true,
    });
  });

  it('ties on the stock-to-minimum ratio are broken by name', async () => {
    // Act
    const response = await client.get(`/stock/low?locationId=${LOCATIONS.BAR}`, UserRole.OPERATOR);

    // Assert
    expect(
      response.body.map((row: { productName: string; quantityBase: number }) => [
        row.productName,
        row.quantityBase,
      ]),
      'bar',
    ).to.deep.equal([
      ['Aguardiente Antioqueño', 0],
      ['Old Parr 12', 0],
      ['Ron Viejo de Caldas', 5],
    ]);
  });

  it('a product stays listed at the threshold and drops off once it passes it', async () => {
    // Arrange
    await registerConfirmed(client, {
      type: MovementType.INBOUND,
      items: [{ productId: PRODUCTS.WHISKY, quantity: 2, unit: MovementUnit.BOTTLE }],
    });
    const atThreshold = await client.get('/stock/low', UserRole.OPERATOR);
    await registerConfirmed(client, {
      type: MovementType.INBOUND,
      items: [{ productId: PRODUCTS.WHISKY, quantity: 1, unit: MovementUnit.BOTTLE }],
    });

    // Act
    const pastThreshold = await client.get('/stock/low', UserRole.OPERATOR);

    // Assert
    expect(namesOf(atThreshold.body), 'at 12 of 12').to.include('Old Parr 12');
    expect(namesOf(pastThreshold.body), 'at 13 of 12').not.to.include('Old Parr 12');
  });

  it('a deactivated product never shows up, however low it is', async () => {
    // Act
    const response = await client.get('/stock/low', UserRole.OPERATOR);

    // Assert
    expect(response.body.map((row: { productId: string }) => row.productId)).not.to.include(
      PRODUCTS.RETIRED_GIN,
    );
  });

  it('limit caps the list', async () => {
    // Act
    const response = await client.get('/stock/low?limit=1', UserRole.OPERATOR);

    // Assert
    expect(namesOf(response.body), 'names').to.deep.equal(['Aguardiente Antioqueño']);
  });

  it('without a limit the repository is asked for 25 at the default location', async () => {
    // Arrange
    const findBelowMinimum = vi.spyOn(api.repositories.stock, 'findBelowMinimum');

    // Act
    await client.get('/stock/low', UserRole.OPERATOR);

    // Assert
    expect(findBelowMinimum.mock.calls, 'calls').to.deep.equal([[LOCATIONS.MAIN, 25]]);
  });

  it('nothing below minimum answers an empty list', async () => {
    // Arrange
    await registerConfirmed(client, {
      type: MovementType.INBOUND,
      items: [
        { productId: PRODUCTS.WHISKY, quantity: 1, unit: MovementUnit.CASE },
        { productId: PRODUCTS.AGUARDIENTE, quantity: 1, unit: MovementUnit.CASE },
      ],
    });

    // Act
    const response = await client.get('/stock/low', UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body, 'body').to.deep.equal([]);
  });

  it.each([
    ['limit=0', 'limit must not be less than 1'],
    ['limit=101', 'limit must not be greater than 100'],
    ['limit=many', 'limit must be an integer number'],
    ['locationId=bar', 'locationId must be a UUID'],
  ])('GET /stock/low?%s answers 400', async (query, message) => {
    // Act
    const response = await client.get(`/stock/low?${query}`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include(message);
  });

  it('a location that does not exist answers 400', async () => {
    // Act
    const response = await client.get(`/stock/low?locationId=${UNKNOWN_ID}`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('That location does not exist');
  });

  it('a request without credentials answers 401', async () => {
    // Act
    const response = await client.get('/stock/low', null);

    // Assert
    expect(response.status, 'status').to.equal(401);
  });
});
