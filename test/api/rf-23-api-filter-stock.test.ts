import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from './support/api-test-app';
import { CATEGORIES, LOCATIONS, PRODUCTS, UNKNOWN_ID } from './support/in-memory-ledger';

const namesOf = (data: { productName: string }[]) => data.map((row) => row.productName);

describe('RF-23 API - Filter stock by name, category and location', () => {
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
    ['lower case', 'parr'],
    ['upper case', 'PARR'],
    ['a fragment in the middle', 'ar'],
  ])('search matches part of the name in %s, ignoring case', async (_label, search) => {
    // Act
    const response = await client.get(`/stock?search=${search}`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(namesOf(response.body.data), 'names').to.include('Old Parr 12');
  });

  it('search counts only what matched in the meta', async () => {
    // Act
    const response = await client.get('/stock?search=ron', UserRole.OPERATOR);

    // Assert
    expect(namesOf(response.body.data), 'names').to.deep.equal(['Ron Viejo de Caldas']);
    expect(response.body.meta, 'meta').to.include({ total: 1, pageCount: 1, count: 1 });
  });

  it('search that matches nothing answers an empty first page, not an error', async () => {
    // Act
    const response = await client.get('/stock?search=tequila', UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.data, 'data').to.deep.equal([]);
    expect(response.body.meta, 'meta').to.deep.equal({
      page: 1,
      pageSize: 25,
      total: 0,
      pageCount: 1,
      count: 0,
    });
  });

  it('search with accents and spaces is matched as typed', async () => {
    // Act
    const response = await client.get(
      `/stock?search=${encodeURIComponent('Antioqueño')}`,
      UserRole.OPERATOR,
    );

    // Assert
    expect(namesOf(response.body.data), 'names').to.deep.equal(['Aguardiente Antioqueño']);
  });

  it('categoryId keeps only the products of that category', async () => {
    // Act
    const response = await client.get(`/stock?categoryId=${CATEGORIES.WHISKY}`, UserRole.OPERATOR);

    // Assert
    expect(namesOf(response.body.data), 'names').to.deep.equal(['Old Parr 12']);
  });

  it('search and categoryId combine: both must hold', async () => {
    // Act
    const response = await client.get(
      `/stock?search=ron&categoryId=${CATEGORIES.WHISKY}`,
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.body.meta.total, 'total').to.equal(0);
  });

  it('locationId reads the quantities of that location', async () => {
    // Act
    const response = await client.get(`/stock?locationId=${LOCATIONS.BAR}`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(
      response.body.data.map((row: { productId: string; quantityBase: number }) => [
        row.productId,
        row.quantityBase,
      ]),
      'quantities at the bar',
    ).to.deep.equal([
      [PRODUCTS.AGUARDIENTE, 0],
      [PRODUCTS.WHISKY, 0],
      [PRODUCTS.RUM, 5],
    ]);
  });

  it('the filters reach the repository exactly as sent, with the page turned into skip and take', async () => {
    // Arrange
    const findPage = vi.spyOn(api.repositories.stock, 'findPage');

    // Act
    await client.get(
      `/stock?search=Old&categoryId=${CATEGORIES.WHISKY}&locationId=${LOCATIONS.BAR}&page=3&pageSize=10`,
      UserRole.OPERATOR,
    );

    // Assert
    expect(findPage.mock.calls, 'calls').to.deep.equal([
      [
        20,
        10,
        LOCATIONS.BAR,
        { search: 'Old', categoryId: CATEGORIES.WHISKY, productIds: undefined },
      ],
    ]);
  });

  it('a location that does not exist answers 400 before the repository is asked', async () => {
    // Arrange
    const findPage = vi.spyOn(api.repositories.stock, 'findPage');

    // Act
    const response = await client.get(`/stock?locationId=${UNKNOWN_ID}`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('That location does not exist');
    expect(findPage.mock.calls, 'repository untouched').to.have.lengthOf(0);
  });

  it('an organization with no default location answers 400 when none is named', async () => {
    // Arrange
    vi.spyOn(api.repositories.locations, 'findDefaultId').mockResolvedValueOnce(null);

    // Act
    const response = await client.get('/stock', UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('The organization has no default location');
  });

  it.each([
    [
      'a search longer than 120 characters',
      `search=${'a'.repeat(121)}`,
      'search must be shorter than or equal to 120 characters',
    ],
    ['a categoryId that is not a UUID', 'categoryId=ron', 'categoryId must be a UUID'],
    ['a locationId that is not a UUID', 'locationId=bar', 'locationId must be a UUID'],
  ])('%s answers 400', async (_label, query, message) => {
    // Act
    const response = await client.get(`/stock?${query}`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include(message);
  });

  it('a search of exactly 120 characters is accepted', async () => {
    // Act
    const response = await client.get(`/stock?search=${'a'.repeat(120)}`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.meta.total, 'total').to.equal(0);
  });
});
