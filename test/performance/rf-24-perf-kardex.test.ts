import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../api/support/api-test-app';
import { MovementType, MovementUnit, PRODUCTS } from '../api/support/in-memory-ledger';
import {
  assertBurstWithinBudget,
  assertWithinBudget,
  BUDGETS,
  measureBurst,
  measureSequential,
  VOLUME,
} from './support/perf-metrics';

const PAGE_SIZE = 100;
const PAGE_COUNT = Math.ceil(VOLUME.kardexLines / PAGE_SIZE);
const FIRST_DAY = Date.UTC(2025, 0, 1);
const HOUR_MS = 60 * 60 * 1000;

describe('RF-24 Performance - Read the kardex of a product', { timeout: 60_000 }, () => {
  let api: ApiTestApp;
  let client: ApiClient;
  let finalBalance: number;

  beforeAll(async () => {
    api = await startApiTestApp();
    client = apiClient(api.baseUrl);
  });

  afterAll(async () => {
    await api.close();
  });

  beforeEach(() => {
    api.ledger.reset();
    finalBalance = 0;

    for (let index = 0; index < VOLUME.kardexLines; index += 1) {
      const isInbound = index % 3 !== 2;
      finalBalance += isInbound ? 2 : -1;
      api.ledger.insertMovement({
        type: isInbound ? MovementType.INBOUND : MovementType.OUTBOUND,
        occurredAt: new Date(FIRST_DAY + index * HOUR_MS),
        items: [
          {
            productId: PRODUCTS.WHISKY,
            quantity: isInbound ? 2 : 1,
            unit: MovementUnit.BOTTLE,
          },
        ],
      });
    }
  });

  it(`the newest page of a ${VOLUME.kardexLines}-line kardex stays within budget`, async () => {
    // Act
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async () => {
        const response = await client.get(
          `/stock/${PRODUCTS.WHISKY}/kardex?pageSize=${PAGE_SIZE}`,
          UserRole.OPERATOR,
        );
        expect(response.status, 'status').to.equal(200);
        expect(response.body.data[0].balanceAfter, 'latest balance').to.equal(finalBalance);
        expect(response.body.meta.total, 'total').to.equal(VOLUME.kardexLines);
      },
    });

    // Assert
    assertWithinBudget('RF-24 kardex newest page', stats, BUDGETS.read);
  });

  it('the oldest page, which needs the whole running sum behind it, stays within budget', async () => {
    // Act
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async () => {
        const response = await client.get(
          `/stock/${PRODUCTS.WHISKY}/kardex?page=${PAGE_COUNT}&pageSize=${PAGE_SIZE}`,
          UserRole.OPERATOR,
        );
        const oldest = response.body.data.at(-1);
        expect(oldest.quantityBase, 'first line').to.equal(2);
        expect(oldest.balanceAfter, 'first balance').to.equal(2);
      },
    });

    // Assert
    assertWithinBudget('RF-24 kardex oldest page', stats, BUDGETS.read);
  });

  it(`${VOLUME.burst} concurrent kardex pages finish within budget and agree with each other`, async () => {
    // Act
    const { totalMs, results } = await measureBurst(VOLUME.burst, (index) =>
      client.get(
        `/stock/${PRODUCTS.WHISKY}/kardex?page=${(index % PAGE_COUNT) + 1}&pageSize=${PAGE_SIZE}`,
        UserRole.OPERATOR,
      ),
    );

    // Assert
    assertBurstWithinBudget(
      'RF-24 concurrent kardex pages',
      VOLUME.burst,
      totalMs,
      BUDGETS.readBurstMs,
    );
    for (const response of results) {
      const [newest, next] = response.body.data;
      expect(newest.balanceAfter - newest.quantityBase, 'balances chain').to.equal(
        next.balanceAfter,
      );
    }
  });
});
