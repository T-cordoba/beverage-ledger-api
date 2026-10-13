import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  registerConfirmed,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../api/support/api-test-app';
import {
  MovementType,
  MovementUnit,
  OTHER_TENANT,
  PRODUCTS,
} from '../api/support/in-memory-ledger';
import { expectSafeError } from './support/safe-error';

const REPORT_ROUTES = ['/reports/consumption', '/reports/summary', '/reports/activity'];

describe('RF-28 Security - Consumption report', () => {
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

  it.each(REPORT_ROUTES)(
    'an OPERATOR is refused %s with 403 before any query runs',
    async (route) => {
      // Arrange
      const spies = (['summary', 'catalogueSnapshot', 'consumption'] as const).map((method) =>
        vi.spyOn(api.repositories.reports, method),
      );

      // Act
      const response = await client.get(route, UserRole.OPERATOR);

      // Assert
      expectSafeError(response, 403);
      expect(response.body.message, 'message').to.equal('Insufficient permissions');
      expect(
        spies.map((spy) => spy.mock.calls.length),
        'no report query',
      ).to.deep.equal([0, 0, 0]);
    },
  );

  it.each(REPORT_ROUTES)('without credentials %s answers 401', async (route) => {
    // Act
    const response = await client.get(route, null);

    // Assert
    expectSafeError(response, 401);
  });

  it.each([
    ['a stacked statement', encodeURIComponent('product; DROP TABLE movements; --')],
    ['a column name', 'p.name'],
    ['a raw column', 'quantity_base'],
    ['two values', 'product&groupBy=brand'],
  ])('a groupBy carrying %s answers 400 before the raw query is built', async (_label, groupBy) => {
    // Arrange
    const consumption = vi.spyOn(api.repositories.reports, 'consumption');

    // Act
    const response = await client.get(`/reports/consumption?groupBy=${groupBy}`, UserRole.MANAGER);

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(
      'groupBy must be one of the following values: product, category, brand',
    );
    expect(consumption.mock.calls, 'repository untouched').to.have.lengthOf(0);
  });

  it.each([
    ['a limit over the cap', 'limit=100000', 'limit must not be greater than 200'],
    [
      'a limit carrying SQL',
      `limit=${encodeURIComponent('20 OFFSET 0; --')}`,
      'limit must be an integer number',
    ],
    [
      'a from that is not a date',
      `from=${encodeURIComponent("2026-01-01' OR '1'='1")}`,
      'from must be a Date instance',
    ],
    [
      'an organizationId',
      `organizationId=${OTHER_TENANT.ORGANIZATION_ID}`,
      'property organizationId should not exist',
    ],
  ])('%s answers 400 before the raw query is built', async (_label, query, message) => {
    // Arrange
    const consumption = vi.spyOn(api.repositories.reports, 'consumption');

    // Act
    const response = await client.get(`/reports/consumption?${query}`, UserRole.MANAGER);

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(message);
    expect(consumption.mock.calls, 'repository untouched').to.have.lengthOf(0);
  });

  it('an inverted range answers 400 before the raw query is built', async () => {
    // Arrange
    const consumption = vi.spyOn(api.repositories.reports, 'consumption');

    // Act
    const response = await client.get(
      '/reports/consumption?from=2026-12-31T00:00:00Z&to=2026-01-01T00:00:00Z',
      UserRole.MANAGER,
    );

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.equal('The range starts after it ends');
    expect(consumption.mock.calls, 'repository untouched').to.have.lengthOf(0);
  });

  it('only validated values reach the raw query: a grouping enum, a number and two dates', async () => {
    // Arrange
    const consumption = vi.spyOn(api.repositories.reports, 'consumption');

    // Act
    await client.get(
      '/reports/consumption?groupBy=brand&limit=5&from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z',
      UserRole.MANAGER,
    );
    const [from, to, groupBy, limit] = consumption.mock.calls[0]!;

    // Assert
    expect(from, 'from').to.be.instanceOf(Date);
    expect(to, 'to').to.be.instanceOf(Date);
    expect(groupBy, 'groupBy').to.equal('brand');
    expect(limit, 'limit').to.be.a('number').and.equal(5);
  });

  it("another organization's dispatches never enter the report", async () => {
    // Arrange
    api.ledger.seedOtherTenant();
    await registerConfirmed(client, {
      type: MovementType.OUTBOUND,
      items: [{ productId: PRODUCTS.RUM, quantity: 1, unit: MovementUnit.BOTTLE }],
    });

    // Act
    const consumption = await client.get('/reports/consumption', UserRole.MANAGER);
    const summary = await client.get('/reports/summary', UserRole.MANAGER);

    // Assert
    expect(consumption.body.data, 'rows').to.deep.equal([
      { id: PRODUCTS.RUM, name: 'Ron Viejo de Caldas', quantityBase: 1, movementCount: 1 },
    ]);
    expect(consumption.raw.toString('utf8'), 'name').not.to.include('Vodka Secreto');
    expect(summary.body, 'summary').to.include({ outboundMovements: 1, unitsOut: 1 });
  });
});
