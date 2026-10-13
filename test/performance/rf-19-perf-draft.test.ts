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
  LOCATIONS,
  MovementStatus,
  MovementType,
  MovementUnit,
  PRODUCTS,
  USERS,
} from '../api/support/in-memory-ledger';
import {
  assertBurstWithinBudget,
  assertWithinBudget,
  BUDGETS,
  measureBurst,
  measureSequential,
  VOLUME,
} from './support/perf-metrics';

const OPEN_DRAFT_QUERY = `/movements?type=${MovementType.OUTBOUND}&status=${MovementStatus.DRAFT}&createdByUserId=${USERS.OPERATOR.id}&pageSize=1`;

const largeDraftLines = (quantity: number) =>
  Array.from({ length: VOLUME.largeDraftLines }, (_, index) => ({
    productId: index % 2 === 0 ? PRODUCTS.RUM : PRODUCTS.WHISKY,
    quantity,
    unit: MovementUnit.BOTTLE,
  }));

describe('RF-19 Performance - Keep and resume a movement draft', { timeout: 60_000 }, () => {
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

  function seedHistoryAndOneDraft(): string {
    const statuses = [MovementStatus.CONFIRMED, MovementStatus.CANCELLED, MovementStatus.DRAFT];

    for (let index = 0; index < VOLUME.kardexLines; index += 1) {
      api.ledger.insertMovement({
        type: index % 2 === 0 ? MovementType.OUTBOUND : MovementType.INBOUND,
        status: statuses[index % statuses.length],
        createdByUserId: USERS.MANAGER.id,
        items: [{ productId: PRODUCTS.RUM, quantity: 1, unit: MovementUnit.BOTTLE }],
      });
    }

    return api.ledger.insertMovement({
      type: MovementType.OUTBOUND,
      status: MovementStatus.DRAFT,
      createdByUserId: USERS.OPERATOR.id,
      items: [{ productId: PRODUCTS.RUM, quantity: 2, unit: MovementUnit.BOTTLE }],
    });
  }

  it(`looking up the open draft among ${VOLUME.kardexLines} movements stays within budget`, async () => {
    // Arrange
    const draftId = seedHistoryAndOneDraft();

    // Act
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async () => {
        const response = await client.get(OPEN_DRAFT_QUERY, UserRole.OPERATOR);
        expect(response.status, 'status').to.equal(200);
        expect(response.body.data[0].id, 'the draft').to.equal(draftId);
      },
    });

    // Assert
    assertWithinBudget('RF-19 find open draft', stats, BUDGETS.read);
  });

  it(`PATCH of a ${VOLUME.largeDraftLines}-line draft stays within budget and keeps every line`, async () => {
    // Arrange
    const draft = await client.post(
      '/movements',
      { type: MovementType.OUTBOUND, locationId: LOCATIONS.MAIN, items: largeDraftLines(1) },
      UserRole.OPERATOR,
    );

    // Act
    const stats = await measureSequential({
      iterations: VOLUME.iterations,
      operation: async (_prepared, round) => {
        const response = await client.patch(
          `/movements/${draft.body.id}`,
          { items: largeDraftLines((round % 5) + 1) },
          UserRole.OPERATOR,
        );
        expect(response.status, 'status').to.equal(200);
        expect(response.body.items, 'lines').to.have.lengthOf(VOLUME.largeDraftLines);
      },
    });

    // Assert
    assertWithinBudget('RF-19 patch large draft', stats, BUDGETS.largeDraftPatch);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'a draft spends nothing').to.equal(
      100,
    );
  });

  it(`${VOLUME.burst} concurrent draft lookups finish within budget`, async () => {
    // Arrange
    const draftId = seedHistoryAndOneDraft();

    // Act
    const { totalMs, results } = await measureBurst(VOLUME.burst, () =>
      client.get(OPEN_DRAFT_QUERY, UserRole.OPERATOR),
    );

    // Assert
    assertBurstWithinBudget(
      'RF-19 concurrent draft lookups',
      VOLUME.burst,
      totalMs,
      BUDGETS.readBurstMs,
    );
    expect(
      results.map((response) => response.body.data[0].id),
      'every lookup found it',
    ).to.deep.equal(Array(VOLUME.burst).fill(draftId));
  });
});
