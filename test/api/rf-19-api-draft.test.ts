import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  registerConfirmed,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from './support/api-test-app';
import {
  LOCATIONS,
  MovementStatus,
  MovementType,
  MovementUnit,
  PRODUCTS,
  UNKNOWN_ID,
  USERS,
} from './support/in-memory-ledger';

const outbound = (overrides: Record<string, unknown> = {}) => ({
  type: MovementType.OUTBOUND,
  items: [{ productId: PRODUCTS.RUM, quantity: 2, unit: MovementUnit.BOTTLE }],
  ...overrides,
});

const openDraftQuery = (userId: string, type: MovementType = MovementType.OUTBOUND) =>
  `/movements?type=${type}&status=${MovementStatus.DRAFT}&createdByUserId=${userId}&pageSize=1`;

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

describe('RF-19 API - Keep and resume a movement draft', () => {
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

  it('GET /movements finds the open draft of that type and author, and only that one', async () => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);
    await registerConfirmed(client, outbound(), UserRole.OPERATOR);
    await client.post('/movements', outbound(), UserRole.MANAGER);
    await client.post(
      '/movements',
      { ...outbound(), type: MovementType.INBOUND },
      UserRole.MANAGER,
    );

    // Act
    const response = await client.get(openDraftQuery(USERS.OPERATOR.id), UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.meta, 'meta').to.deep.equal({
      page: 1,
      pageSize: 1,
      total: 1,
      pageCount: 1,
      count: 1,
    });
    expect(response.body.data[0], 'summary').to.include({
      id: draft.body.id,
      code: draft.body.code,
      type: MovementType.OUTBOUND,
      status: MovementStatus.DRAFT,
      itemCount: 1,
    });
    expect(response.body.data[0].createdBy, 'author').to.deep.equal({
      id: USERS.OPERATOR.id,
      name: USERS.OPERATOR.name,
    });
  });

  it('GET /movements answers an empty page when the user has no open draft', async () => {
    // Arrange
    await registerConfirmed(client, outbound(), UserRole.OPERATOR);

    // Act
    const response = await client.get(openDraftQuery(USERS.OPERATOR.id), UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.data, 'data').to.deep.equal([]);
    expect(response.body.meta, 'meta').to.include({ total: 0, pageCount: 1, count: 0 });
  });

  it('PATCH /movements/:id replaces the lines wholesale and leaves stock untouched', async () => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);

    // Act
    const response = await client.patch(
      `/movements/${draft.body.id}`,
      {
        note: 'Recuperado en otro equipo',
        items: [
          { productId: PRODUCTS.WHISKY, quantity: 1, unit: MovementUnit.CASE },
          { productId: PRODUCTS.RUM, quantity: 3, unit: MovementUnit.BOTTLE },
        ],
      },
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body, 'body').to.include({
      id: draft.body.id,
      code: draft.body.code,
      status: MovementStatus.DRAFT,
      note: 'Recuperado en otro equipo',
    });
    expect(
      response.body.items.map((item: { productId: string; quantityBase: number }) => [
        item.productId,
        item.quantityBase,
      ]),
      'lines',
    ).to.deep.equal([
      [PRODUCTS.WHISKY, -6],
      [PRODUCTS.RUM, -3],
    ]);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'rum').to.equal(100);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.WHISKY), 'whisky').to.equal(10);
  });

  it('PATCH without items keeps the lines and only changes what it names', async () => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);
    const occurredAt = '2026-03-01T15:30:00.000Z';

    // Act
    const response = await client.patch(
      `/movements/${draft.body.id}`,
      { occurredAt },
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.occurredAt, 'occurredAt').to.equal(occurredAt);
    expect(response.body.items, 'lines').to.have.lengthOf(1);
    expect(response.body.items[0].quantityBase, 'line').to.equal(-2);
  });

  it('confirming a resumed draft applies the lines it was edited to', async () => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);
    await client.patch(
      `/movements/${draft.body.id}`,
      { items: [{ productId: PRODUCTS.RUM, quantity: 7, unit: MovementUnit.BOTTLE }] },
      UserRole.OPERATOR,
    );

    // Act
    const response = await client.post(
      `/movements/${draft.body.id}/confirm`,
      undefined,
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(201);
    expect(response.body.status, 'status field').to.equal(MovementStatus.CONFIRMED);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'stock').to.equal(93);
  });

  it('PATCH with a future occurredAt answers 400', async () => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);

    // Act
    const response = await client.patch(
      `/movements/${draft.body.id}`,
      { occurredAt: tomorrow() },
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('A movement cannot be dated in the future');
  });

  it('POST /movements with a future occurredAt answers 400 and writes nothing', async () => {
    // Act
    const response = await client.post(
      '/movements',
      outbound({ occurredAt: tomorrow() }),
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('A movement cannot be dated in the future');
    expect(api.ledger.movements.size, 'nothing written').to.equal(0);
  });

  it('PATCH with an occurredAt that is not a date answers 400', async () => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);

    // Act
    const response = await client.patch(
      `/movements/${draft.body.id}`,
      { occurredAt: 'yesterday' },
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include('occurredAt must be a Date instance');
  });

  it('PATCH with an empty item list answers 400', async () => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);

    // Act
    const response = await client.patch(
      `/movements/${draft.body.id}`,
      { items: [] },
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.include('items must contain at least 1 elements');
  });

  it('PATCH of a confirmed movement answers 409', async () => {
    // Arrange
    const confirmed = await registerConfirmed(client, outbound(), UserRole.OPERATOR);

    // Act
    const response = await client.patch(
      `/movements/${confirmed.id}`,
      { note: 'Tarde' },
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(409);
    expect(response.body.message, 'message').to.equal(
      'A CONFIRMED movement can no longer be edited',
    );
  });

  it('an OPERATOR may not edit an inbound draft: 403', async () => {
    // Arrange
    const draft = await client.post(
      '/movements',
      { ...outbound(), type: MovementType.INBOUND },
      UserRole.MANAGER,
    );

    // Act
    const response = await client.patch(
      `/movements/${draft.body.id}`,
      { note: 'Cambio' },
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(403);
    expect(response.body.message, 'message').to.equal('You may not record INBOUND movements');
  });

  it('PATCH of a movement that does not exist answers 404', async () => {
    // Act
    const response = await client.patch(
      `/movements/${UNKNOWN_ID}`,
      { note: 'Nada' },
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(404);
    expect(response.body.message, 'message').to.equal('Movement not found');
  });

  it('PATCH with a malformed id answers 400', async () => {
    // Act
    const response = await client.patch('/movements/not-a-uuid', { note: 'x' }, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message, 'message').to.equal('Validation failed (uuid is expected)');
  });

  it.each([
    ['an unknown status', 'status=OPEN', 'status must be one of the following values'],
    ['a pageSize over 100', 'pageSize=101', 'pageSize must not be greater than 100'],
    [
      'a createdByUserId that is not a UUID',
      'createdByUserId=olga',
      'createdByUserId must be a UUID',
    ],
  ])('GET /movements with %s answers 400', async (_label, query, message) => {
    // Act
    const response = await client.get(`/movements?${query}`, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(400);
    expect(response.body.message.join(' '), 'message').to.include(message);
  });

  it('a request without credentials answers 401 on both the lookup and the edit', async () => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);

    // Act
    const lookup = await client.get(openDraftQuery(USERS.OPERATOR.id), null);
    const edit = await client.patch(`/movements/${draft.body.id}`, { note: 'x' }, null);

    // Assert
    expect(lookup.status, 'lookup').to.equal(401);
    expect(edit.status, 'edit').to.equal(401);
    expect(api.ledger.movements.get(draft.body.id)!.note, 'unchanged').to.be.null;
  });
});
