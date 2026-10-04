import { expect } from 'chai';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { UserRole } from '../../src/generated/prisma/enums';
import {
  apiClient,
  registerConfirmed,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../support/api-test-app';
import {
  LOCATIONS,
  MovementType,
  MovementUnit,
  PRODUCTS,
  UNKNOWN_ID,
} from '../support/in-memory-ledger';

describe('RF-21 API - Download the movement voucher as PDF', () => {
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

  it('GET /movements/:id/pdf answers 200 with a PDF attachment named after the code', async () => {
    const movement = await registerConfirmed(client, {
      type: MovementType.OUTBOUND,
      items: [{ productId: PRODUCTS.RUM, quantity: 3, unit: MovementUnit.BOTTLE }],
    });

    const response = await client.get(`/movements/${movement.id}/pdf`, UserRole.MANAGER);

    expect(response.status, 'status').to.equal(200);
    expect(response.headers.get('content-type'), 'content type').to.include('application/pdf');
    expect(response.headers.get('content-disposition'), 'disposition').to.equal(
      `attachment; filename="${movement.code}.pdf"`,
    );
    expect(response.raw.subarray(0, 5).toString('latin1'), 'PDF signature').to.equal('%PDF-');
  });

  it('the downloaded file is a valid PDF titled with the movement code and organization', async () => {
    const movement = await registerConfirmed(client, {
      type: MovementType.ADJUSTMENT,
      reason: 'Botella rota en bodega',
      items: [{ productId: PRODUCTS.WHISKY, quantity: -1, unit: MovementUnit.BOTTLE }],
    });

    const response = await client.get(`/movements/${movement.id}/pdf`, UserRole.MANAGER);
    const document = await PDFDocument.load(response.raw);

    expect(response.status, 'status').to.equal(200);
    expect(document.getPageCount(), 'pages').to.be.at.least(1);
    expect(document.getTitle(), 'title').to.equal(`${movement.code} - Licorera La Esquina`);
  });

  it('a transfer voucher downloads as well', async () => {
    const movement = await registerConfirmed(client, {
      type: MovementType.TRANSFER,
      locationId: LOCATIONS.MAIN,
      destinationLocationId: LOCATIONS.BAR,
      items: [{ productId: PRODUCTS.RUM, quantity: 2, unit: MovementUnit.CASE }],
    });

    const response = await client.get(`/movements/${movement.id}/pdf`, UserRole.MANAGER);

    expect(response.status, 'status').to.equal(200);
    expect(response.raw.length, 'non-empty body').to.be.above(0);
  });

  it('an OPERATOR holds movement:read and may download the voucher', async () => {
    const movement = await registerConfirmed(
      client,
      {
        type: MovementType.OUTBOUND,
        items: [{ productId: PRODUCTS.RUM, quantity: 1, unit: MovementUnit.BOTTLE }],
      },
      UserRole.OPERATOR,
    );

    const response = await client.get(`/movements/${movement.id}/pdf`, UserRole.OPERATOR);

    expect(response.status, 'status').to.equal(200);
    expect(response.headers.get('content-type'), 'content type').to.include('application/pdf');
  });

  it('a voucher for a movement that does not exist answers 404 with the error body', async () => {
    const response = await client.get(`/movements/${UNKNOWN_ID}/pdf`, UserRole.MANAGER);

    // @Header('Content-Type', 'application/pdf') also stamps the error response,
    // so the JSON error body arrives labelled as a PDF and has to be parsed raw.
    const body = JSON.parse(response.raw.toString('utf8'));

    expect(response.status, 'status').to.equal(404);
    expect(body, 'error body').to.include({
      statusCode: 404,
      error: 'Not Found',
      message: 'Movement not found',
      path: `/api/v1/movements/${UNKNOWN_ID}/pdf`,
    });
  });

  it('a voucher requested with a malformed id answers 400', async () => {
    const response = await client.get('/movements/MOV-2026-000001/pdf', UserRole.MANAGER);
    const body = JSON.parse(response.raw.toString('utf8'));

    expect(response.status, 'status').to.equal(400);
    expect(body.message, 'message').to.equal('Validation failed (uuid is expected)');
  });

  it('a voucher requested without credentials answers 401 and leaks no document', async () => {
    const movement = await registerConfirmed(client, {
      type: MovementType.OUTBOUND,
      items: [{ productId: PRODUCTS.RUM, quantity: 1, unit: MovementUnit.BOTTLE }],
    });

    const response = await client.get(`/movements/${movement.id}/pdf`, null);

    expect(response.status, 'status').to.equal(401);
    expect(response.raw.subarray(0, 5).toString('latin1'), 'no PDF').to.not.equal('%PDF-');
  });
});
