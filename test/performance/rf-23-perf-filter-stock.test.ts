import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../api/support/api-test-app';
import { CATEGORIES, LOCATIONS } from '../api/support/in-memory-ledger';
import { assertWithinBudget, BUDGETS, measureSequential, VOLUME } from './support/perf-metrics';

describe('RF-23 Performance - Filter stock', { timeout: 60_000 }, () => {
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

  it.each([
    ['a name search', 'search=producto%2000', 99],
    ['a category', `categoryId=${CATEGORIES.WHISKY}`, Math.floor(VOLUME.catalogSize / 3) + 1],
    [
      'a search and a category together',
      `search=producto%2000&categoryId=${CATEGORIES.WHISKY}`,
      33,
    ],
    ['another location', `locationId=${LOCATIONS.BAR}`, VOLUME.catalogSize + 3],
  ])(
    `filtering ${VOLUME.catalogSize} products by %s stays within budget and counts right`,
    async (label, query, expectedTotal) => {
      // Act
      const stats = await measureSequential({
        iterations: VOLUME.iterations,
        operation: async () => {
          const response = await client.get(`/stock?${query}&pageSize=100`, UserRole.OPERATOR);
          expect(response.status, 'status').to.equal(200);
          expect(response.body.meta.total, 'total').to.equal(expectedTotal);
        },
      });

      // Assert
      assertWithinBudget(`RF-23 filter by ${label}`, stats, BUDGETS.read);
    },
  );

  it('a search that matches nothing answers as fast as one that matches', async () => {
    // Act
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async () => {
        const response = await client.get('/stock?search=tequila', UserRole.OPERATOR);
        expect(response.body.meta.total, 'total').to.equal(0);
      },
    });

    // Assert
    assertWithinBudget('RF-23 filter with no match', stats, BUDGETS.read);
  });
});
