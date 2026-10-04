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
  MovementStatus,
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

const CANCEL = { reason: 'Registrado por error' };

const outbound = () => ({
  type: MovementType.OUTBOUND,
  locationId: LOCATIONS.MAIN,
  items: [{ productId: PRODUCTS.RUM, quantity: 1, unit: MovementUnit.BOTTLE }],
});

const RUM_AT_MAIN = INITIAL_STOCK[LOCATIONS.MAIN][PRODUCTS.RUM];

describe('RF-20 Performance - Cancel a confirmed movement', { timeout: 30_000 }, () => {
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

  it(`POST /movements/:id/cancel keeps its response time within budget over ${VOLUME.iterations} cancellations`, async () => {
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      // Registering the movement is setup, not the operation under test.
      prepare: () => registerConfirmed(client, outbound()),
      operation: async (movement) => {
        const response = await client.post(`/movements/${movement.id}/cancel`, CANCEL);
        expect(response.status, 'status').to.equal(201);
        expect(response.body.status, 'status field').to.equal(MovementStatus.CANCELLED);
      },
    });

    assertWithinBudget('RF-20 cancel confirmed movement', stats, BUDGETS.request);
    expect(
      api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM),
      'every cancellation gave its bottle back',
    ).to.equal(RUM_AT_MAIN);
  });

  it(`${VOLUME.burst} concurrent cancellations of different movements finish within budget`, async () => {
    const movements: { id: string; code: string }[] = [];
    for (let i = 0; i < VOLUME.burst; i += 1) {
      movements.push(await registerConfirmed(client, outbound()));
    }

    const { totalMs, results } = await measureBurst(VOLUME.burst, (index) =>
      client.post(`/movements/${movements[index]!.id}/cancel`, CANCEL),
    );

    assertBurstWithinBudget(
      'RF-20 concurrent cancellations (distinct)',
      VOLUME.burst,
      totalMs,
      BUDGETS.cancelBurstMs,
    );
    expect(results.map((response) => response.status), 'statuses').to.deep.equal(
      Array(VOLUME.burst).fill(201),
    );
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'stock restored').to.equal(
      RUM_AT_MAIN,
    );
  });

  it(`${VOLUME.burst} concurrent cancellations of the same movement resolve fast with exactly one winner`, async () => {
    const movement = await registerConfirmed(client, outbound());

    const { totalMs, results } = await measureBurst(VOLUME.burst, () =>
      client.post(`/movements/${movement.id}/cancel`, CANCEL),
    );

    assertBurstWithinBudget(
      'RF-20 concurrent cancellations (same movement)',
      VOLUME.burst,
      totalMs,
      BUDGETS.cancelBurstMs,
    );

    const statuses = results.map((response) => response.status);
    expect(statuses.filter((status) => status === 201), 'one winner').to.have.length(1);
    expect(statuses.filter((status) => status === 409), 'the rest conflict').to.have.length(
      VOLUME.burst - 1,
    );
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'stock restored once').to.equal(
      RUM_AT_MAIN,
    );
  });
});
