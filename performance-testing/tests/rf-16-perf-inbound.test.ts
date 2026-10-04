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

/** One case of whisky (6 bottles), so every run also goes through the unit conversion. */
const BOTTLES_PER_CASE = 6;

const inbound = () => ({
  type: MovementType.INBOUND,
  locationId: LOCATIONS.MAIN,
  items: [{ productId: PRODUCTS.WHISKY, quantity: 1, unit: MovementUnit.CASE }],
});

const WHISKY_AT_MAIN = INITIAL_STOCK[LOCATIONS.MAIN][PRODUCTS.WHISKY];

describe('RF-16 Performance - Register an inbound (INBOUND)', { timeout: 30_000 }, () => {
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

  it(`POST /movements (inbound draft) keeps its response time within budget over ${VOLUME.iterations} requests`, async () => {
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async () => {
        const response = await client.post('/movements', inbound());
        expect(response.status, 'status').to.equal(201);
      },
    });

    assertWithinBudget('RF-16 create inbound draft', stats, BUDGETS.request);
  });

  it(`registering an inbound (create + confirm) stays within budget over ${VOLUME.iterations} runs`, async () => {
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: () => registerConfirmed(client, inbound()),
    });

    assertWithinBudget('RF-16 register inbound (create+confirm)', stats, BUDGETS.register);
    expect(
      api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.WHISKY),
      'every timed run really added one case',
    ).to.equal(WHISKY_AT_MAIN + (VOLUME.warmup + VOLUME.iterations) * BOTTLES_PER_CASE);
  });

  it(`${VOLUME.burst} concurrent inbound registrations finish within budget without losing stock updates`, async () => {
    const { totalMs, results } = await measureBurst(VOLUME.burst, () =>
      registerConfirmed(client, inbound()),
    );

    assertBurstWithinBudget(
      'RF-16 concurrent inbound registrations',
      VOLUME.burst,
      totalMs,
      BUDGETS.registerBurstMs,
    );
    expect(new Set(results.map((movement) => movement.code)).size, 'unique codes').to.equal(
      VOLUME.burst,
    );
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.WHISKY), 'stock after burst').to.equal(
      WHISKY_AT_MAIN + VOLUME.burst * BOTTLES_PER_CASE,
    );
  });
});
