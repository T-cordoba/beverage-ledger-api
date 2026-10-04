import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../support/api-test-app';
import {
  LOCATIONS,
  MovementStatus,
  MovementType,
  MovementUnit,
  PRODUCTS,
} from '../support/in-memory-ledger';

const adjustment = (quantity: number, overrides: Record<string, unknown> = {}) => ({
  type: MovementType.ADJUSTMENT,
  reason: 'Conteo fisico de fin de mes',
  items: [{ productId: PRODUCTS.WHISKY, quantity, unit: MovementUnit.BOTTLE }],
  ...overrides,
});

describe('RF-18 API - Register an adjustment (ADJUSTMENT)', () => {
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

  it('POST /movements opens an adjustment draft with 201 and keeps its reason', async () => {
    const response = await client.post('/movements', adjustment(3), UserRole.MANAGER);

    expect(response.status, 'status').to.equal(201);
    expect(response.body, 'body').to.include({
      type: MovementType.ADJUSTMENT,
      status: MovementStatus.DRAFT,
      reason: 'Conteo fisico de fin de mes',
      destinationLocationId: null,
    });
    expect(response.body.items[0].quantityBase, 'positive correction').to.equal(3);
  });

  it('a positive adjustment, once confirmed, raises the stock', async () => {
    const created = await client.post('/movements', adjustment(3), UserRole.MANAGER);

    const response = await client.post(
      `/movements/${created.body.id}/confirm`,
      undefined,
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(201);
    expect(response.body.status, 'status field').to.equal(MovementStatus.CONFIRMED);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.WHISKY), 'stock').to.equal(13);
  });

  it('a negative adjustment keeps its sign and, once confirmed, lowers the stock', async () => {
    const created = await client.post('/movements', adjustment(-4), UserRole.ORG_ADMIN);

    const response = await client.post(
      `/movements/${created.body.id}/confirm`,
      undefined,
      UserRole.ORG_ADMIN,
    );

    expect(created.body.items[0].quantityBase, 'negative correction').to.equal(-4);
    expect(response.status, 'status').to.equal(201);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.WHISKY), 'stock').to.equal(6);
  });

  it('a negative adjustment that would leave stock below zero answers 400 on confirm', async () => {
    const created = await client.post('/movements', adjustment(-11), UserRole.MANAGER);

    const response = await client.post(
      `/movements/${created.body.id}/confirm`,
      undefined,
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include('Not enough stock');
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.WHISKY), 'stock').to.equal(10);
  });

  it.each([
    ['without a reason', adjustment(3, { reason: undefined })],
    ['with a blank reason', adjustment(3, { reason: '      ' })],
  ])('an adjustment %s answers 400', async (_label, body) => {
    const response = await client.post('/movements', body, UserRole.MANAGER);

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('An adjustment needs a reason');
  });

  it('a reason shorter than 4 characters is rejected with 400 by validation', async () => {
    const response = await client.post(
      '/movements',
      adjustment(3, { reason: 'abc' }),
      UserRole.MANAGER,
    );

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'validation messages').to.be.an('array').that.is.not.empty;
  });

  it('an adjustment line of zero answers 400', async () => {
    const response = await client.post('/movements', adjustment(0), UserRole.MANAGER);

    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('An adjustment line cannot be zero');
  });

  it('an OPERATOR may not record an adjustment: 403', async () => {
    const response = await client.post('/movements', adjustment(3), UserRole.OPERATOR);

    expect(response.status, 'status').to.equal(403);
    expect(response.body.message, 'message').to.equal('You may not record ADJUSTMENT movements');
  });
});
