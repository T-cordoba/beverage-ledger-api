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

const adjustment = (quantity: number) => ({
  type: MovementType.ADJUSTMENT,
  locationId: LOCATIONS.MAIN,
  reason: 'Conteo fisico de fin de mes',
  items: [{ productId: PRODUCTS.WHISKY, quantity, unit: MovementUnit.BOTTLE }],
});

const WHISKY_AT_MAIN = INITIAL_STOCK[LOCATIONS.MAIN][PRODUCTS.WHISKY];

describe('RF-18 Performance - Register an adjustment (ADJUSTMENT)', { timeout: 30_000 }, () => {
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

  it(`POST /movements (adjustment draft) keeps its response time within budget over ${VOLUME.iterations} requests`, async () => {
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async () => {
        const response = await client.post('/movements', adjustment(1));
        expect(response.status, 'status').to.equal(201);
      },
    });

    assertWithinBudget('RF-18 create adjustment draft', stats, BUDGETS.request);
  });

  it(`registering an adjustment (create + confirm) stays within budget over ${VOLUME.iterations} runs`, async () => {
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: () => registerConfirmed(client, adjustment(1)),
    });

    assertWithinBudget('RF-18 register adjustment (create+confirm)', stats, BUDGETS.register);
    expect(
      api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.WHISKY),
      'every timed run really added one bottle',
    ).to.equal(WHISKY_AT_MAIN + VOLUME.warmup + VOLUME.iterations);
  });

  it(`${VOLUME.burst} concurrent positive and negative adjustments finish within budget and net out`, async () => {
    // Half +1, half -1. The stock (10) covers every -1 even if they all land
    // first, so all must succeed and the net effect must be zero.
    const { totalMs } = await measureBurst(VOLUME.burst, (index) =>
      registerConfirmed(client, adjustment(index % 2 === 0 ? 1 : -1)),
    );

    assertBurstWithinBudget(
      'RF-18 concurrent adjustments (+1/-1)',
      VOLUME.burst,
      totalMs,
      BUDGETS.registerBurstMs,
    );
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.WHISKY), 'net stock').to.equal(
      WHISKY_AT_MAIN,
    );
  });
});
