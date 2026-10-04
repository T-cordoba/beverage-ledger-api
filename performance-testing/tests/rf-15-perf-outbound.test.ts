import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  apiClient,
  registerConfirmed,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../../api-testing/support/api-test-app';
import {
  INITIAL_STOCK,
  LOCATIONS,
  MovementType,
  MovementUnit,
  PRODUCTS,
} from '../../api-testing/support/in-memory-ledger';
import {
  assertBurstWithinBudget,
  assertWithinBudget,
  BUDGETS,
  measureBurst,
  measureSequential,
  VOLUME,
} from '../support/perf-metrics';

const outbound = () => ({
  type: MovementType.OUTBOUND,
  locationId: LOCATIONS.MAIN,
  items: [{ productId: PRODUCTS.RUM, quantity: 1, unit: MovementUnit.BOTTLE }],
});

const RUM_AT_MAIN = INITIAL_STOCK[LOCATIONS.MAIN][PRODUCTS.RUM];

describe('RF-15 Performance - Register an outbound (OUTBOUND)', { timeout: 30_000 }, () => {
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
  });

  it(`POST /movements (outbound draft) keeps its response time within budget over ${VOLUME.iterations} requests`, async () => {
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async () => {
        const response = await client.post('/movements', outbound());
        expect(response.status, 'status').to.equal(201);
      },
    });

    assertWithinBudget('RF-15 create outbound draft', stats, BUDGETS.request);
  });

  it(`registering an outbound (create + confirm) stays within budget over ${VOLUME.iterations} runs`, async () => {
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: () => registerConfirmed(client, outbound()),
    });

    assertWithinBudget('RF-15 register outbound (create+confirm)', stats, BUDGETS.register);
    expect(
      api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM),
      'every timed run really discounted one bottle',
    ).to.equal(RUM_AT_MAIN - VOLUME.warmup - VOLUME.iterations);
  });

  it(`${VOLUME.burst} concurrent outbound registrations finish within budget without losing stock updates`, async () => {
    const { totalMs, results } = await measureBurst(VOLUME.burst, () =>
      registerConfirmed(client, outbound()),
    );

    assertBurstWithinBudget(
      'RF-15 concurrent outbound registrations',
      VOLUME.burst,
      totalMs,
      BUDGETS.registerBurstMs,
    );
    expect(new Set(results.map((movement) => movement.code)).size, 'unique codes').to.equal(
      VOLUME.burst,
    );
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'stock after burst').to.equal(
      RUM_AT_MAIN - VOLUME.burst,
    );
  });
});
