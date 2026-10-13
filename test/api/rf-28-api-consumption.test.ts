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
  BRANDS,
  CATEGORIES,
  MovementType,
  MovementUnit,
  PRODUCTS,
} from './support/in-memory-ledger';

const DAY_MS = 24 * 60 * 60 * 1000;

const outbound = (
  productId: string,
  quantity: number,
  unit: MovementUnit = MovementUnit.BOTTLE,
) => ({
  type: MovementType.OUTBOUND,
  items: [{ productId, quantity, unit }],
});

describe('RF-28 API - Consumption report', () => {
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

  async function aMonthOfSales() {
    await registerConfirmed(client, {
      type: MovementType.INBOUND,
      items: [{ productId: PRODUCTS.AGUARDIENTE, quantity: 1, unit: MovementUnit.CASE }],
    });
    await registerConfirmed(client, outbound(PRODUCTS.RUM, 10));
    await registerConfirmed(client, outbound(PRODUCTS.RUM, 1, MovementUnit.CASE));
    await registerConfirmed(client, outbound(PRODUCTS.WHISKY, 4));
    await registerConfirmed(client, outbound(PRODUCTS.AGUARDIENTE, 3));
    await registerConfirmed(client, {
      type: MovementType.ADJUSTMENT,
      reason: 'Conteo físico',
      items: [{ productId: PRODUCTS.WHISKY, quantity: -2, unit: MovementUnit.BOTTLE }],
    });
  }

  it('GET /reports/consumption groups dispatched units by product, heaviest first', async () => {
    // Arrange
    await aMonthOfSales();

    // Act
    const response = await client.get('/reports/consumption', UserRole.MANAGER);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.groupBy, 'groupBy').to.equal('product');
    expect(response.body.data, 'rows').to.deep.equal([
      { id: PRODUCTS.RUM, name: 'Ron Viejo de Caldas', quantityBase: 22, movementCount: 2 },
      { id: PRODUCTS.WHISKY, name: 'Old Parr 12', quantityBase: 4, movementCount: 1 },
      {
        id: PRODUCTS.AGUARDIENTE,
        name: 'Aguardiente Antioqueño',
        quantityBase: 3,
        movementCount: 1,
      },
    ]);
  });

  it('groupBy=category adds up the products of each category', async () => {
    // Arrange
    await aMonthOfSales();

    // Act
    const response = await client.get('/reports/consumption?groupBy=category', UserRole.MANAGER);

    // Assert
    expect(response.body.groupBy, 'groupBy').to.equal('category');
    expect(response.body.data, 'rows').to.deep.equal([
      { id: CATEGORIES.RUM, name: 'Ron', quantityBase: 22, movementCount: 2 },
      { id: CATEGORIES.WHISKY, name: 'Whisky', quantityBase: 4, movementCount: 1 },
      { id: CATEGORIES.AGUARDIENTE, name: 'Aguardiente', quantityBase: 3, movementCount: 1 },
    ]);
  });

  it('groupBy=brand adds up every product of the brand', async () => {
    // Arrange
    await aMonthOfSales();

    // Act
    const response = await client.get('/reports/consumption?groupBy=brand', UserRole.MANAGER);

    // Assert
    expect(response.body.data, 'rows').to.deep.equal([
      { id: BRANDS.ILC, name: 'ILC', quantityBase: 25, movementCount: 3 },
      { id: BRANDS.DIAGEO, name: 'Diageo', quantityBase: 4, movementCount: 1 },
    ]);
  });

  it('inbounds, adjustments, drafts and cancelled outbounds are not consumption', async () => {
    // Arrange
    await registerConfirmed(client, {
      type: MovementType.INBOUND,
      items: [{ productId: PRODUCTS.RUM, quantity: 50, unit: MovementUnit.BOTTLE }],
    });
    await client.post('/movements', outbound(PRODUCTS.RUM, 9));
    const voided = await registerConfirmed(client, outbound(PRODUCTS.RUM, 8));
    await client.post(`/movements/${voided.id}/cancel`, { reason: 'Registrado por error' });

    // Act
    const response = await client.get('/reports/consumption', UserRole.MANAGER);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.data, 'rows').to.deep.equal([]);
  });

  it('limit keeps only the heaviest rows', async () => {
    // Arrange
    await aMonthOfSales();

    // Act
    const response = await client.get('/reports/consumption?limit=1', UserRole.MANAGER);

    // Assert
    expect(
      response.body.data.map((row: { id: string }) => row.id),
      'ids',
    ).to.deep.equal([PRODUCTS.RUM]);
  });

  it('without a range it covers the last 30 days and echoes the range it applied', async () => {
    // Arrange
    const findConsumption = vi.spyOn(api.repositories.reports, 'consumption');
    api.ledger.insertMovement({
      type: MovementType.OUTBOUND,
      occurredAt: new Date(Date.now() - 31 * DAY_MS),
      items: [{ productId: PRODUCTS.RUM, quantity: 40, unit: MovementUnit.BOTTLE }],
    });
    await registerConfirmed(client, outbound(PRODUCTS.RUM, 1));

    // Act
    const response = await client.get('/reports/consumption', UserRole.MANAGER);
    const [from, to, groupBy, limit] = findConsumption.mock.calls[0]!;

    // Assert
    expect(response.body.data[0].quantityBase, 'only the recent sale').to.equal(1);
    expect(to.getTime() - from.getTime(), 'span').to.equal(30 * DAY_MS);
    expect(Date.now() - to.getTime(), 'ends now').to.be.lessThan(5_000);
    expect([groupBy, limit], 'defaults').to.deep.equal(['product', 20]);
    expect(response.body.range, 'echo').to.deep.equal({
      from: from.toISOString(),
      to: to.toISOString(),
    });
  });

  it('an explicit range reaches back further and is inclusive at both ends', async () => {
    // Arrange
    api.ledger.insertMovement({
      type: MovementType.OUTBOUND,
      occurredAt: new Date('2026-01-10T00:00:00.000Z'),
      items: [{ productId: PRODUCTS.WHISKY, quantity: 2, unit: MovementUnit.BOTTLE }],
    });
    api.ledger.insertMovement({
      type: MovementType.OUTBOUND,
      occurredAt: new Date('2026-01-20T23:59:59.000Z'),
      items: [{ productId: PRODUCTS.WHISKY, quantity: 3, unit: MovementUnit.BOTTLE }],
    });
    api.ledger.insertMovement({
      type: MovementType.OUTBOUND,
      occurredAt: new Date('2026-01-21T00:00:00.000Z'),
      items: [{ productId: PRODUCTS.WHISKY, quantity: 100, unit: MovementUnit.BOTTLE }],
    });

    // Act
    const response = await client.get(
      '/reports/consumption?from=2026-01-10T00:00:00.000Z&to=2026-01-20T23:59:59.000Z',
      UserRole.MANAGER,
    );

    // Assert
    expect(response.body.data, 'rows').to.deep.equal([
      { id: PRODUCTS.WHISKY, name: 'Old Parr 12', quantityBase: 5, movementCount: 2 },
    ]);
    expect(response.body.range, 'echo').to.deep.equal({
      from: '2026-01-10T00:00:00.000Z',
      to: '2026-01-20T23:59:59.000Z',
    });
  });

  it('a range that starts after it ends answers 400', async () => {
    // Act
    const response = await client.get(
      '/reports/consumption?from=2026-02-01T00:00:00Z&to=2026-01-01T00:00:00Z',
      UserRole.MANAGER,
    );

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('The range starts after it ends');
  });

  it.each([
    ['groupBy=supplier', 'groupBy must be one of the following values: product, category, brand'],
    ['limit=0', 'limit must not be less than 1'],
    ['limit=201', 'limit must not be greater than 200'],
    ['from=ayer', 'from must be a Date instance'],
  ])('GET /reports/consumption?%s answers 400', async (query, message) => {
    // Act
    const response = await client.get(`/reports/consumption?${query}`, UserRole.MANAGER);

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include(message);
  });

  it('GET /reports/summary adds up the range and the catalogue as it stands', async () => {
    // Arrange
    await aMonthOfSales();

    // Act
    const response = await client.get('/reports/summary', UserRole.MANAGER);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body, 'figures').to.include({
      movements: 6,
      inboundMovements: 1,
      outboundMovements: 4,
      adjustmentMovements: 1,
      unitsIn: 24,
      unitsOut: 29,
      unitsAdjusted: -2,
      productsMoved: 3,
      unitsOnHand: 105 - 22 + 10 - 4 - 2 + 24 - 3,
      activeProducts: 3,
      productsBelowMinimum: 1,
    });
    expect(Object.keys(response.body.range), 'range').to.have.members(['from', 'to']);
  });

  it('ORG_ADMIN may read the reports as well as MANAGER', async () => {
    // Act
    const consumption = await client.get('/reports/consumption', UserRole.ORG_ADMIN);
    const summary = await client.get('/reports/summary', UserRole.ORG_ADMIN);

    // Assert
    expect([consumption.status, summary.status], 'statuses').to.deep.equal([200, 200]);
  });

  it('an OPERATOR may not read reports: 403', async () => {
    // Act
    const response = await client.get('/reports/consumption', UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(403);
    expect(response.body.message, 'message').to.equal('Insufficient permissions');
  });

  it('a request without credentials answers 401', async () => {
    // Act
    const response = await client.get('/reports/consumption', null);

    // Assert
    expect(response.status, 'status').to.equal(401);
  });
});
