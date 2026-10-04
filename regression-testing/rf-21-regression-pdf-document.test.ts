import { StreamableFile } from '@nestjs/common';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { expect } from 'chai';
import { PDFDocument } from 'pdf-lib';
import { describe, it, vi } from 'vitest';
import { MovementStatus, MovementType, MovementUnit } from '../src/generated/prisma/enums';
import { DocumentsController } from '../src/modules/documents/documents.controller';
import { DocumentsService } from '../src/modules/documents/documents.service';
import { MovementPdfService } from '../src/modules/documents/movement-pdf.service';

const organization = {
  id: 'org-1',
  name: 'Beverage Ledger',
  slug: 'beverage-ledger',
  legalName: 'Beverage Ledger S.A.S.',
  logoUrl: null,
  timezone: 'America/Bogota',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const movement = {
  id: 'movement-1',
  code: 'MOV-2026-000042',
  type: MovementType.OUTBOUND,
  status: MovementStatus.CONFIRMED,
  locationId: 'loc-1',
  destinationLocationId: null,
  occurredAt: new Date('2026-09-30T15:00:00Z'),
  reason: null,
  note: 'Pedido mesa 4',
  createdBy: { id: 'user-1', name: 'Operador Uno' },
  confirmedAt: new Date('2026-09-30T15:05:00Z'),
  cancelledAt: null,
  createdAt: new Date('2026-09-30T15:00:00Z'),
  items: [
    {
      id: 'item-1',
      productId: 'p1',
      locationId: 'loc-1',
      quantity: 2,
      unit: MovementUnit.CASE,
      quantityBase: -24,
      productNameSnapshot: 'Ron Añejo',
      brandNameSnapshot: 'Havana Club',
    },
  ],
};

/** The real renderer behind a DocumentsService whose lookups are doubles. */
function buildDocuments() {
  const movements = { findOne: vi.fn().mockResolvedValue(movement) };
  const organizations = { current: vi.fn().mockResolvedValue(organization) };

  return new DocumentsService(movements as any, organizations as any, new MovementPdfService());
}

describe('RF-21 regression - The movement PDF document', () => {
  it('the rendered content is a valid PDF titled with the movement code and organization', async () => {
    // Arrange
    const documents = buildDocuments();

    // Act
    const { filename, content } = await documents.movementPdf('movement-1');

    // Assert
    expect(filename, 'filename').to.equal('MOV-2026-000042.pdf');
    expect(content.subarray(0, 5).toString('latin1'), 'PDF signature').to.equal('%PDF-');
    const parsed = await PDFDocument.load(content);
    expect(parsed.getPageCount(), 'page count').to.be.at.least(1);
    expect(parsed.getTitle(), 'document title').to.equal('MOV-2026-000042 - Beverage Ledger');
  });

  it('text outside the PDF font still renders instead of failing the download', async () => {
    // Arrange
    const pdf = new MovementPdfService();
    const unusual = {
      ...movement,
      note: 'Entrega 🚚 urgente',
      items: [{ ...movement.items[0], productNameSnapshot: 'Sake 日本酒' }],
    };

    // Act
    const content = await pdf.render(unusual as any, organization);

    // Assert
    const parsed = await PDFDocument.load(content);
    expect(parsed.getPageCount(), 'page count').to.be.at.least(1);
  });

  it('the download endpoint declares application/pdf as its Content-Type', () => {
    // Arrange
    const handler = DocumentsController.prototype.download;

    // Act
    const headers = Reflect.getMetadata(HEADERS_METADATA, handler);

    // Assert
    expect(headers, 'response headers').to.deep.include({
      name: 'Content-Type',
      value: 'application/pdf',
    });
  });

  it('the download is served as an attachment named after the movement code', async () => {
    // Arrange
    const controller = new DocumentsController(buildDocuments());
    const response = { setHeader: vi.fn() };

    // Act
    const file = await controller.download('movement-1', response as any);

    // Assert
    expect(file, 'response body').to.be.instanceOf(StreamableFile);
    expect(response.setHeader.mock.calls, 'Content-Disposition').to.deep.equal([
      ['Content-Disposition', 'attachment; filename="MOV-2026-000042.pdf"'],
    ]);
  });
});
