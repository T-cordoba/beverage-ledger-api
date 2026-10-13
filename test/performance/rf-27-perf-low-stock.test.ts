import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../api/support/api-test-app';
import {
  assertBurstWithinBudget,
  assertWithinBudget,
  BUDGETS,
  measureBurst,
  measureSequential,
  VOLUME,
} from './support/perf-metrics';

const ratioOf = (row: { quantityBase: number; minimumStock: number }) =>
  row.quantityBase / row.minimumStock;

describe('RF-27 Performance - List products below their minimum', { timeout: 60_000 }, () => {
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
    api.ledger.seedBulkCatalog(VOLUME.catalogSize);
  });

  it(`GET /stock/low?limit=100 over ${VOLUME.catalogSize} products stays within budget, sorted by urgency`, async () => {
    // Act
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async () => {
        const response = await client.get('/stock/low?limit=100', UserRole.OPERATOR);
        expect(response.status, 'status').to.equal(200);
        expect(response.body, 'rows').to.have.lengthOf(100);

        const ratios = response.body.map(ratioOf);
        expect(ratios, 'most urgent first').to.deep.equal([...ratios].sort((a, b) => a - b));
        expect(
          response.body.every((row: { isBelowMinimum: boolean }) => row.isBelowMinimum),
          'flag',
        ).to.equal(true);
      },
    });

    // Assert
    assertWithinBudget('RF-27 low stock limit 100', stats, BUDGETS.read);
  });

  it(`${VOLUME.burst} concurrent low-stock reads finish within budget with the same answer`, async () => {
    // Act
    const { totalMs, results } = await measureBurst(VOLUME.burst, () =>
      client.get('/stock/low?limit=100', UserRole.OPERATOR),
    );

    // Assert
    assertBurstWithinBudget(
      'RF-27 concurrent low stock',
      VOLUME.burst,
      totalMs,
      BUDGETS.readBurstMs,
    );
    const first = JSON.stringify(results[0]!.body);
    expect(
      results.every((response) => JSON.stringify(response.body) === first),
      'same list every time',
    ).to.equal(true);
  });
});
