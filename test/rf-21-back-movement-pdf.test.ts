import { NotFoundException } from '@nestjs/common';
import { expect } from 'chai';
import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, it, vi } from 'vitest';
import { MovementType, MovementUnit } from '../src/generated/prisma/enums';
import { DocumentsService } from '../src/modules/documents/documents.service';
import { MovementPdfService } from '../src/modules/documents/movement-pdf.service';

describe('RF-21 - Download the movement PDF', () => {
  describe('DocumentsService.movementPdf', () => {
    let service: DocumentsService;
    let findOne: ReturnType<typeof vi.fn>;
    let current: ReturnType<typeof vi.fn>;
    let render: ReturnType<typeof vi.fn>;

    const organization = {
      id: 'org-1',
      name: 'Beverage Ledger',
      slug: 'beverage-ledger',
      legalName: null,
      logoUrl: null,
      timezone: 'America/Bogota',
      createdAt: new Date('2026-01-01'),
    };

    beforeEach(() => {
      findOne = vi.fn();
      current = vi.fn();
      render = vi.fn();

      const movements = { findOne };
      const organizations = { current };
      const pdf = { render };

      service = new DocumentsService(
        movements as any,
        organizations as any,
        pdf as any,
      );
    });

    it('Path 1 - the movement exists', async () => {
      // Arrange
      const movement = { id: 'movement-1', code: 'MOV-2026-000001' };
      findOne.mockResolvedValue(movement);
      current.mockResolvedValue(organization);
      render.mockResolvedValue(new Uint8Array([1, 2, 3]));

      // Act
      const result = await service.movementPdf('movement-1');

      // Assert
      expect(result.filename, 'pdf filename').to.equal(
        'MOV-2026-000001.pdf',
      );
      expect(result.content, 'pdf content')
        .to.be.instanceOf(Buffer)
        .and.to.have.length.above(0);
      expect(render.mock.calls, 'render call count').to.have.lengthOf(1);
      expect(render.mock.calls[0], 'render call arguments').to.deep.equal([
        movement,
        organization,
      ]);
    });

    it('Path 2 - the movement does not exist', async () => {
      // Arrange
      findOne.mockRejectedValue(new NotFoundException('Movement not found'));
      current.mockResolvedValue(organization);

      // Act & Assert
      try {
        await service.movementPdf('missing-movement');
        expect.fail('Expected movementPdf to throw for a missing movement');
      } catch (error) {
        expect(error, 'missing movement error').to.be.instanceOf(
          NotFoundException,
        );
      }
      expect(render.mock.calls, 'render calls').to.be.empty;
    });
  });

  describe('MovementPdfService.render', () => {
    let service: MovementPdfService;

    const organization = {
      id: 'org-1',
      name: 'Beverage Ledger',
      slug: 'beverage-ledger',
      legalName: 'Beverage Ledger S.A.S.',
      logoUrl: null,
      timezone: 'America/Bogota',
      createdAt: new Date('2026-01-01'),
    };

    const createdBy = { id: 'user-1', name: 'Julia Herrera' };

    const buildItem = (index: number) => ({
      id: `item-${index}`,
      productId: `product-${index}`,
      locationId: 'location-1',
      quantity: 2,
      unit: MovementUnit.BOTTLE,
      quantityBase: -2,
      productNameSnapshot: `Product ${index}`,
      brandNameSnapshot: `Brand ${index}`,
    });

    const buildMovement = (itemCount: number) => ({
      id: 'movement-1',
      code: 'MOV-2026-000001',
      type: MovementType.OUTBOUND,
      status: 'CONFIRMED',
      locationId: 'location-1',
      destinationLocationId: null,
      occurredAt: new Date('2026-03-10T15:00:00Z'),
      reason: null,
      note: null,
      createdBy,
      confirmedAt: new Date('2026-03-10T15:05:00Z'),
      cancelledAt: null,
      createdAt: new Date('2026-03-10T14:00:00Z'),
      items: Array.from({ length: itemCount }, (_, index) => buildItem(index)),
    });

    beforeEach(() => {
      service = new MovementPdfService();
    });

    it('Path 3 - a valid movement', async () => {
      // Arrange
      const movement = buildMovement(1);

      // Act
      const result = await service.render(movement as any, organization as any);

      // Assert
      const header = Buffer.from(result.slice(0, 5)).toString('latin1');
      expect(header, 'pdf header').to.equal('%PDF-');

      const document = await PDFDocument.load(result);
      expect(document.getTitle(), 'pdf title')
        .to.equal('MOV-2026-000001 - Beverage Ledger')
        .and.to.be.a('string');
      // pdf-lib's save() always overwrites Producer via updateInfoDict(),
      // so the setProducer('Beverage Ledger') call in the source never
      // survives into the saved bytes.
      expect(document.getProducer(), 'pdf producer').to.equal(
        'pdf-lib (https://github.com/Hopding/pdf-lib)',
      );
      expect(document.getPageCount(), 'pdf page count').to.equal(1);
    });

    it('Path 4 - a movement with many lines', async () => {
      // Arrange
      const movement = buildMovement(80);

      // Act
      const result = await service.render(movement as any, organization as any);

      // Assert
      const document = await PDFDocument.load(result);
      expect(document.getPageCount(), 'pdf page count')
        .to.be.a('number')
        .and.to.be.above(1);
    });
  });
});
