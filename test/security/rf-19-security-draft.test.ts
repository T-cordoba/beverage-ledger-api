import { expect } from 'chai';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  registerConfirmed,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../api/support/api-test-app';
import {
  LOCATIONS,
  MovementStatus,
  MovementType,
  MovementUnit,
  OTHER_TENANT,
  PRODUCTS,
  USERS,
} from '../api/support/in-memory-ledger';
import { expectSafeError } from './support/safe-error';

const outbound = (overrides: Record<string, unknown> = {}) => ({
  type: MovementType.OUTBOUND,
  items: [{ productId: PRODUCTS.RUM, quantity: 2, unit: MovementUnit.BOTTLE }],
  ...overrides,
});

describe('RF-19 Security - Keep and resume a movement draft', () => {
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
    vi.restoreAllMocks();
  });

  it.each([
    ['type', MovementType.INBOUND],
    ['status', MovementStatus.CONFIRMED],
    ['createdByUserId', USERS.MANAGER.id],
    ['locationId', LOCATIONS.BAR],
    ['destinationLocationId', LOCATIONS.BAR],
    ['confirmedAt', '2026-01-01T00:00:00.000Z'],
  ])('PATCH may not rewrite %s: 400 and the draft is untouched', async (field, value) => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);
    const before = structuredClone(api.ledger.movements.get(draft.body.id));

    // Act
    const response = await client.patch(
      `/movements/${draft.body.id}`,
      { [field]: value },
      UserRole.OPERATOR,
    );

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(`property ${field} should not exist`);
    expect(api.ledger.movements.get(draft.body.id), 'draft').to.deep.equal(before);
  });

  it.each([
    ['confirmed', MovementStatus.CONFIRMED],
    ['cancelled', MovementStatus.CANCELLED],
  ])('a %s movement cannot be rewritten through PATCH: 409', async (_label, status) => {
    // Arrange
    const confirmed = await registerConfirmed(client, outbound());
    if (status === MovementStatus.CANCELLED) {
      await client.post(`/movements/${confirmed.id}/cancel`, { reason: 'Registrado por error' });
    }
    const stockBefore = api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM);

    // Act
    const response = await client.patch(`/movements/${confirmed.id}`, {
      items: [{ productId: PRODUCTS.RUM, quantity: 90, unit: MovementUnit.BOTTLE }],
    });

    // Assert
    expectSafeError(response, 409);
    expect(response.body.message, 'message').to.equal(
      `A ${status} movement can no longer be edited`,
    );
    expect(api.ledger.movements.get(confirmed.id)!.items[0]!.quantity, 'lines').to.equal(2);
    expect(api.ledger.stockOf(LOCATIONS.MAIN, PRODUCTS.RUM), 'stock').to.equal(stockBefore);
  });

  it.each([MovementType.INBOUND, MovementType.ADJUSTMENT, MovementType.TRANSFER])(
    'an OPERATOR may not edit a %s draft: 403',
    async (type) => {
      // Arrange
      const draft = await client.post(
        '/movements',
        {
          type,
          reason: 'Conteo físico',
          ...(type === MovementType.TRANSFER ? { destinationLocationId: LOCATIONS.BAR } : {}),
          items: [{ productId: PRODUCTS.RUM, quantity: 1, unit: MovementUnit.BOTTLE }],
        },
        UserRole.MANAGER,
      );

      // Act
      const response = await client.patch(
        `/movements/${draft.body.id}`,
        { note: 'Cambio' },
        UserRole.OPERATOR,
      );

      // Assert
      expectSafeError(response, 403);
      expect(response.body.message, 'message').to.equal(`You may not record ${type} movements`);
      expect(api.ledger.movements.get(draft.body.id)!.note, 'note').to.equal(null);
    },
  );

  it('a negative quantity cannot turn an outbound draft into an inbound: 400', async () => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);

    // Act
    const response = await client.patch(
      `/movements/${draft.body.id}`,
      { items: [{ productId: PRODUCTS.RUM, quantity: -50, unit: MovementUnit.BOTTLE }] },
      UserRole.OPERATOR,
    );

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.equal(
      'A OUTBOUND line must be positive; the movement type carries the direction',
    );
  });

  it.each([
    ['a deactivated product', PRODUCTS.RETIRED_GIN, 'These products are deactivated: Gin Retirado'],
    [
      "another organization's product",
      OTHER_TENANT.PRODUCT,
      `Unknown products: ${OTHER_TENANT.PRODUCT}`,
    ],
  ])('PATCH may not swap a line to %s: 400', async (_label, productId, message) => {
    // Arrange
    api.ledger.seedOtherTenant();
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);

    // Act
    const response = await client.patch(
      `/movements/${draft.body.id}`,
      { items: [{ productId, quantity: 1, unit: MovementUnit.BOTTLE }] },
      UserRole.OPERATOR,
    );

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.equal(message);
  });

  it("another organization's draft answers 404, the same as one that does not exist", async () => {
    // Arrange
    api.ledger.seedOtherTenant();
    const foreignDraft = api.ledger.insertMovement({
      organizationId: OTHER_TENANT.ORGANIZATION_ID,
      status: MovementStatus.DRAFT,
      type: MovementType.OUTBOUND,
      locationId: OTHER_TENANT.LOCATION,
      items: [{ productId: OTHER_TENANT.PRODUCT, quantity: 1, unit: MovementUnit.BOTTLE }],
    });

    // Act
    const response = await client.patch(`/movements/${foreignDraft}`, { note: 'Hola' });

    // Assert
    expectSafeError(response, 404);
    expect(response.body.message, 'message').to.equal('Movement not found');
    expect(api.ledger.movements.get(foreignDraft)!.note, 'untouched').to.equal(null);
  });

  it("the open-draft lookup never returns another organization's drafts", async () => {
    // Arrange
    api.ledger.seedOtherTenant();
    api.ledger.insertMovement({
      organizationId: OTHER_TENANT.ORGANIZATION_ID,
      status: MovementStatus.DRAFT,
      type: MovementType.OUTBOUND,
      createdByUserId: USERS.OPERATOR.id,
      locationId: OTHER_TENANT.LOCATION,
      items: [{ productId: OTHER_TENANT.PRODUCT, quantity: 1, unit: MovementUnit.BOTTLE }],
    });

    // Act
    const response = await client.get(
      `/movements?type=OUTBOUND&status=DRAFT&createdByUserId=${USERS.OPERATOR.id}`,
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.meta.total, 'total').to.equal(0);
  });

  it('a script in the note is stored and returned as plain JSON text', async () => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);
    const note = '<script>alert(document.cookie)</script>';

    // Act
    const response = await client.patch(`/movements/${draft.body.id}`, { note }, UserRole.OPERATOR);

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.headers.get('content-type'), 'content type').to.include('application/json');
    expect(response.body.note, 'note').to.equal(note);
  });

  it('an SQL fragment in the code search reaches the repository as a literal string', async () => {
    // Arrange
    const findPage = vi.spyOn(api.repositories.movements, 'findPage');
    const search = "' OR 1=1 --";

    // Act
    const response = await client.get(
      `/movements?search=${encodeURIComponent(search)}`,
      UserRole.OPERATOR,
    );

    // Assert
    expect(response.status, 'status').to.equal(200);
    expect(response.body.meta.total, 'nothing matched').to.equal(0);
    expect(findPage.mock.calls[0]![2].search, 'literal').to.equal(search);
  });

  it('more than 500 lines in a PATCH answers 400', async () => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);
    const items = Array.from({ length: 501 }, () => ({
      productId: PRODUCTS.RUM,
      quantity: 1,
      unit: MovementUnit.BOTTLE,
    }));

    // Act
    const response = await client.patch(
      `/movements/${draft.body.id}`,
      { items },
      UserRole.OPERATOR,
    );

    // Assert
    expectSafeError(response, 400);
    expect(response.body.message, 'message').to.include(
      'items must contain no more than 500 elements',
    );
  });

  it.each([
    ['a path traversal', '..%2F..%2Fstock'],
    ['an SQL fragment', encodeURIComponent("1' OR '1'='1")],
  ])('PATCH with %s as id answers 400 without reaching the ledger', async (_label, id) => {
    // Arrange
    const findById = vi.spyOn(api.repositories.movements, 'findById');

    // Act
    const response = await client.patch(`/movements/${id}`, { note: 'x' });

    // Assert
    expectSafeError(response, 400);
    expect(findById.mock.calls, 'ledger untouched').to.have.lengthOf(0);
  });

  it.each([
    ['no role header', null],
    ['a role the API does not know', 'SUPERUSER' as UserRole],
  ])('with %s both the lookup and the edit answer 401', async (_label, role) => {
    // Arrange
    const draft = await client.post('/movements', outbound(), UserRole.OPERATOR);

    // Act
    const lookup = await client.get('/movements?status=DRAFT', role);
    const edit = await client.patch(`/movements/${draft.body.id}`, { note: 'x' }, role);

    // Assert
    expectSafeError(lookup, 401);
    expectSafeError(edit, 401);
  });
});
