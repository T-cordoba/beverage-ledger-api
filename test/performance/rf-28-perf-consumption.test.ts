import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../api/support/api-test-app';
import { MovementType, MovementUnit } from '../api/support/in-memory-ledger';
import {
  assertBurstWithinBudget,
  assertWithinBudget,
  BUDGETS,
  measureBurst,
  measureSequential,
  VOLUME,
} from './support/perf-metrics';

const HOUR_MS = 60 * 60 * 1000;

describe('RF-28 Performance - Consumption report', { timeout: 60_000 }, () => {
  let api: ApiTestApp;
  let client: ApiClient;
  let unitsOut: number;

  beforeAll(async () => {
    api = await startApiTestApp();
    client = apiClient(api.baseUrl);
  });

  afterAll(async () => {
    await api.close();
  });

  beforeEach(() => {
    api.ledger.reset();
    const productIds = api.ledger.seedBulkCatalog(VOLUME.catalogSize);
    unitsOut = 0;

    for (let index = 0; index < VOLUME.reportMovements; index += 1) {
      const quantity = (index % 4) + 1;
      unitsOut += quantity * 2;
      api.ledger.insertMovement({
        type: MovementType.OUTBOUND,
        occurredAt: new Date(Date.now() - (index % 600) * HOUR_MS),
        items: [
          { productId: productIds[index % 300]!, quantity, unit: MovementUnit.BOTTLE },
          { productId: productIds[(index * 7) % 500]!, quantity, unit: MovementUnit.BOTTLE },
        ],
      });
    }
  });

  it.each([
    ['product', 200],
    ['category', 2],
    ['brand', 1],
  ])(
    `GET /reports/consumption?groupBy=%s&limit=200 over ${VOLUME.reportMovements} outbounds stays within budget`,
    async (groupBy, expectedRows) => {
      // Act
      const stats = await measureSequential({
        iterations: VOLUME.iterations,
        operation: async () => {
          const response = await client.get(
            `/reports/consumption?groupBy=${groupBy}&limit=200`,
            UserRole.MANAGER,
          );
          expect(response.status, 'status').to.equal(200);
          expect(response.body.data, 'rows').to.have.lengthOf(expectedRows);

          const quantities = response.body.data.map(
            (row: { quantityBase: number }) => row.quantityBase,
          );
          expect(quantities, 'heaviest first').to.deep.equal([...quantities].sort((a, b) => b - a));
        },
      });

      // Assert
      assertWithinBudget(`RF-28 consumption by ${groupBy}`, stats, BUDGETS.read);
    },
  );

  it('grouping by brand adds every dispatched unit exactly once', async () => {
    // Act
    const response = await client.get('/reports/consumption?groupBy=brand', UserRole.MANAGER);

    // Assert
    expect(response.body.data[0].quantityBase, 'all units').to.equal(unitsOut);
    expect(response.body.data[0].movementCount, 'all movements').to.equal(VOLUME.reportMovements);
  });

  it(`GET /reports/summary over ${VOLUME.reportMovements} outbounds stays within budget`, async () => {
    // Act
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async () => {
        const response = await client.get('/reports/summary', UserRole.MANAGER);
        expect(response.status, 'status').to.equal(200);
        expect(response.body.unitsOut, 'units out').to.equal(unitsOut);
      },
    });

    // Assert
    assertWithinBudget('RF-28 summary', stats, BUDGETS.read);
  });

  it(`${VOLUME.burst} concurrent consumption reports finish within budget`, async () => {
    // Act
    const { totalMs, results } = await measureBurst(VOLUME.burst, () =>
      client.get('/reports/consumption?limit=200', UserRole.MANAGER),
    );

    // Assert
    assertBurstWithinBudget(
      'RF-28 concurrent consumption',
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
