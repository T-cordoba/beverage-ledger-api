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

const transfer = () => ({
  type: MovementType.TRANSFER,
  locationId: LOCATIONS.MAIN,
  destinationLocationId: LOCATIONS.BAR,
  items: [{ productId: PRODUCTS.RUM, quantity: 1, unit: MovementUnit.BOTTLE }],
});

const RUM_AT_MAIN = INITIAL_STOCK[LOCATIONS.MAIN][PRODUCTS.RUM];
const RUM_AT_BAR = INITIAL_STOCK[LOCATIONS.BAR][PRODUCTS.RUM];

describe('RF-17 Performance - Register a transfer (TRANSFER)', { timeout: 30_000 }, () => {
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

  it(`POST /movements (transfer draft) keeps its response time within budget over ${VOLUME.iterations} requests`, async () => {
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async () => {
        const response = await client.post('/movements', transfer());
        expect(response.status, 'status').to.equal(201);
      },
    });

    assertWithinBudget('RF-17 create transfer draft', stats, BUDGETS.request);
  });

  it(`registering a transfer (create + confirm) stays within budget over ${VOLUME.iterations} runs`, async () => {
    const runs = VOLUME.warmup + VOLUME.iterations;

    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: () => registerConfirmed(client, transfer()),
    });

    assertWithinBudget('RF-17 register transfer (create+confirm)', stats, BUDGETS.register);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'origin').to.equal(RUM_AT_MAIN - runs);
    expect(api.ledger.stockOf(LOCATIONS.BAR, PRODUCTS.RUM), 'destination').to.equal(
      RUM_AT_BAR + runs,
    );
  });

  it(`${VOLUME.burst} concurrent transfers finish within budget and keep both locations consistent`, async () => {
    const { totalMs, results } = await measureBurst(VOLUME.burst, () =>
      registerConfirmed(client, transfer()),
    );

    assertBurstWithinBudget(
      'RF-17 concurrent transfers',
      VOLUME.burst,
      totalMs,
      BUDGETS.registerBurstMs,
    );
    expect(new Set(results.map((movement) => movement.code)).size, 'unique codes').to.equal(
      VOLUME.burst,
    );
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'origin').to.equal(
      RUM_AT_MAIN - VOLUME.burst,
    );
    expect(api.ledger.stockOf(LOCATIONS.BAR, PRODUCTS.RUM), 'destination').to.equal(
      RUM_AT_BAR + VOLUME.burst,
    );
  });
});
