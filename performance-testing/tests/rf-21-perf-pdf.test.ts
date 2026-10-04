import { expect } from 'chai';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  apiClient,
  registerConfirmed,
  startApiTestApp,
  type ApiClient,
  type ApiTestApp,
} from '../../api-testing/support/api-test-app';
import {
  LOCATIONS,
  MovementStatus,
  MovementType,
  MovementUnit,
  ORGANIZATION_ID,
  PRODUCTS,
  USERS,
} from '../../api-testing/support/in-memory-ledger';
import type { MovementDto } from '../../src/modules/inventory/dto/movement.dto';
import { MovementPdfService } from '../../src/modules/documents/movement-pdf.service';
import type { OrganizationDto } from '../../src/modules/organizations/dto/organization.dto';
import {
  assertBurstWithinBudget,
  assertWithinBudget,
  BUDGETS,
  measureBurst,
  measureSequential,
  VOLUME,
} from '../support/perf-metrics';

const PDF_SIGNATURE = '%PDF-';

const ORGANIZATION: OrganizationDto = {
  id: ORGANIZATION_ID,
  name: 'Licorera La Esquina',
  slug: 'licorera-la-esquina',
  legalName: 'Licorera La Esquina S.A.S.',
  logoUrl: null,
  timezone: 'America/Bogota',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

/** A confirmed outbound voucher with `lines` rows, built directly for the renderer. */
function voucher(lines: number): MovementDto {
  const at = new Date('2026-09-15T15:30:00Z');

  return {
    id: 'b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0',
    code: 'MOV-2026-000001',
    type: MovementType.OUTBOUND,
    status: MovementStatus.CONFIRMED,
    locationId: LOCATIONS.MAIN,
    destinationLocationId: null,
    occurredAt: at,
    reason: null,
    note: 'Pedido de prueba de rendimiento',
    createdBy: { id: USERS.MANAGER.id, name: USERS.MANAGER.name },
    confirmedAt: at,
    cancelledAt: null,
    createdAt: at,
    items: Array.from({ length: lines }, (_, index) => ({
      id: `c0c0c0c0-c0c0-4c0c-8c0c-${String(index).padStart(12, '0')}`,
      productId: PRODUCTS.RUM,
      locationId: LOCATIONS.MAIN,
      quantity: -(index + 1),
      unit: MovementUnit.BOTTLE,
      quantityBase: -(index + 1),
      productNameSnapshot: `Producto de prueba número ${String(index + 1).padStart(3, '0')}`,
      brandNameSnapshot: 'Marca Añeja',
    })),
  };
}

async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe('RF-21 Performance - Download the movement voucher as PDF', { timeout: 30_000 }, () => {
  let api: ApiTestApp;
  let client: ApiClient;
  let renderer: MovementPdfService;

  beforeAll(async () => {
    api = await startApiTestApp();
    client = apiClient(api.baseUrl);
    renderer = api.app.get(MovementPdfService);
  });

  afterAll(async () => {
    await api.close();
  });

  beforeEach(() => {
    api.ledger.reset();
  });

  it(`GET /movements/:id/pdf keeps its response time within budget over ${VOLUME.pdfIterations} downloads`, async () => {
    const movement = await registerConfirmed(client, {
      type: MovementType.OUTBOUND,
      items: [
        { productId: PRODUCTS.RUM, quantity: 2, unit: MovementUnit.CASE },
        { productId: PRODUCTS.WHISKY, quantity: 3, unit: MovementUnit.BOTTLE },
      ],
    });

    const stats = await measureSequential({
      iterations: VOLUME.pdfIterations,
      operation: async () => {
        const response = await client.get(`/movements/${movement.id}/pdf`);
        expect(response.status, 'status').to.equal(200);
        expect(response.raw.subarray(0, 5).toString('latin1'), 'signature').to.equal(
          PDF_SIGNATURE,
        );
      },
    });

    assertWithinBudget('RF-21 download voucher PDF (HTTP)', stats, BUDGETS.pdfDownload);
  });

  it(`generating a one-line voucher stays within budget over ${VOLUME.pdfIterations} renders`, async () => {
    const movement = voucher(1);

    const stats = await measureSequential({
      iterations: VOLUME.pdfIterations,
      operation: async () => {
        const bytes = await renderer.render(movement, ORGANIZATION);
        expect(bytes.byteLength, 'non-empty document').to.be.greaterThan(0);
      },
    });

    assertWithinBudget('RF-21 render 1-line voucher', stats, BUDGETS.pdfRenderSmall);
  });

  it(`generating a multi-page voucher (${VOLUME.largeVoucherLines} lines) stays within budget`, async () => {
    const movement = voucher(VOLUME.largeVoucherLines);
    let last: Uint8Array = new Uint8Array();

    const stats = await measureSequential({
      iterations: VOLUME.pdfIterations,
      operation: async () => {
        last = await renderer.render(movement, ORGANIZATION);
      },
    });

    assertWithinBudget(
      `RF-21 render ${VOLUME.largeVoucherLines}-line voucher`,
      stats,
      BUDGETS.pdfRenderLarge,
    );
    expect(await pageCount(last), 'the table really spilled onto several pages').to.be.greaterThan(
      1,
    );
  });

  it(`${VOLUME.pdfBurst} concurrent PDF downloads finish within budget and are all valid`, async () => {
    const movements: { id: string; code: string }[] = [];
    for (let i = 0; i < VOLUME.pdfBurst; i += 1) {
      movements.push(
        await registerConfirmed(client, {
          type: MovementType.INBOUND,
          items: [{ productId: PRODUCTS.WHISKY, quantity: i + 1, unit: MovementUnit.BOTTLE }],
        }),
      );
    }

    const { totalMs, results } = await measureBurst(VOLUME.pdfBurst, (index) =>
      client.get(`/movements/${movements[index]!.id}/pdf`),
    );

    assertBurstWithinBudget(
      'RF-21 concurrent PDF downloads',
      VOLUME.pdfBurst,
      totalMs,
      BUDGETS.pdfBurstMs,
    );
    results.forEach((response, index) => {
      expect(response.status, `status #${index}`).to.equal(200);
      expect(response.headers.get('content-disposition'), `filename #${index}`).to.equal(
        `attachment; filename="${movements[index]!.code}.pdf"`,
      );
      expect(response.raw.subarray(0, 5).toString('latin1'), `signature #${index}`).to.equal(
        PDF_SIGNATURE,
      );
    });
  });
});
