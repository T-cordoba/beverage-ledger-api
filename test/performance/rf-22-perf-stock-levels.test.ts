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

const PAGE_SIZE = 100;

describe('RF-22 Performance - Check current stock levels', { timeout: 60_000 }, () => {
  let api: ApiTestApp;
  let client: ApiClient;
  let total: number;
  let pageCount: number;

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
    total = VOLUME.catalogSize + 3;
    pageCount = Math.ceil(total / PAGE_SIZE);
  });

  it(`GET /stock in pages of ${PAGE_SIZE} over ${VOLUME.catalogSize} products stays within budget`, async () => {
    // Act
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async (_prepared, round) => {
        const page = (round % pageCount) + 1;
        const response = await client.get(
          `/stock?page=${page}&pageSize=${PAGE_SIZE}`,
          UserRole.OPERATOR,
        );
        expect(response.status, 'status').to.equal(200);
        expect(response.body.meta, 'meta').to.include({ page, total, pageCount });
        expect(response.body.data, 'rows').to.have.lengthOf(
          page < pageCount ? PAGE_SIZE : total - PAGE_SIZE * (pageCount - 1),
        );
      },
    });

    // Assert
    assertWithinBudget('RF-22 stock page of 100', stats, BUDGETS.read);
  });

  it('walking every page returns each product exactly once, in name order', async () => {
    // Act
    const names: string[] = [];
    for (let page = 1; page <= pageCount; page += 1) {
      const response = await client.get(
        `/stock?page=${page}&pageSize=${PAGE_SIZE}`,
        UserRole.OPERATOR,
      );
      names.push(...response.body.data.map((row: { productName: string }) => row.productName));
    }

    // Assert
    expect(names, 'count').to.have.lengthOf(total);
    expect(new Set(names).size, 'no repeats').to.equal(total);
    expect(names, 'order').to.deep.equal([...names].sort((a, b) => a.localeCompare(b)));
  });

  it(`${VOLUME.burst} concurrent stock pages finish within budget`, async () => {
    // Act
    const { totalMs, results } = await measureBurst(VOLUME.burst, (index) =>
      client.get(`/stock?page=${(index % pageCount) + 1}&pageSize=${PAGE_SIZE}`, UserRole.OPERATOR),
    );

    // Assert
    assertBurstWithinBudget(
      'RF-22 concurrent stock pages',
      VOLUME.burst,
      totalMs,
      BUDGETS.readBurstMs,
    );
    expect(
      results.map((response) => response.status),
      'statuses',
    ).to.deep.equal(Array(VOLUME.burst).fill(200));
  });
});
