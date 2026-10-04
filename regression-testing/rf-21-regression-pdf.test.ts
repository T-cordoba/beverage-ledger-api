import { NotFoundException } from '@nestjs/common';
import { expect } from 'chai';
import { beforeEach, describe, it, vi } from 'vitest';
import { DocumentsService } from '../src/modules/documents/documents.service';

/**
 * Builds a fresh DocumentsService wired to its own mocks, so each test owns
 * its data and no state leaks between tests (FIRST: Independent).
 */
function buildService(mocks: {
  findOne: ReturnType<typeof vi.fn>;
  current: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
}): DocumentsService {
  const movements = { findOne: mocks.findOne };
  const organizations = { current: mocks.current };
  const pdf = { render: mocks.render };

  return new DocumentsService(movements as any, organizations as any, pdf as any);
}

describe('RF-21 regression - Download the movement PDF', () => {
  const organization = { id: 'org-1', name: 'Beverage Ledger' };

  let findOne: ReturnType<typeof vi.fn>;
  let current: ReturnType<typeof vi.fn>;
  let render: ReturnType<typeof vi.fn>;
  let service: DocumentsService;

  beforeEach(() => {
    findOne = vi.fn();
    current = vi.fn().mockResolvedValue(organization);
    render = vi.fn();

    service = buildService({ findOne, current, render });
  });

  it('the filename is the movement code plus .pdf', async () => {
    // Arrange
    findOne.mockResolvedValue({ id: 'movement-1', code: 'MOV-2026-000001' });
    render.mockResolvedValue(new Uint8Array([1, 2, 3]));

    // Act
    const result = await service.movementPdf('movement-1');

    // Assert
    expect(result.filename, 'pdf filename').to.equal('MOV-2026-000001.pdf');
  });

  it('the content is a non-empty Buffer', async () => {
    // Arrange
    findOne.mockResolvedValue({ id: 'movement-2', code: 'MOV-2026-000002' });
    render.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

    // Act
    const result = await service.movementPdf('movement-2');

    // Assert
    expect(result.content, 'pdf content')
      .to.be.instanceOf(Buffer)
      .and.to.have.length.above(0);
  });

  it('a missing movement throws NotFoundException', async () => {
    // Arrange
    findOne.mockRejectedValue(new NotFoundException('Movement not found'));

    // Act & Assert
    try {
      await service.movementPdf('missing-movement');
      expect.fail('Expected movementPdf to throw for a missing movement');
    } catch (error) {
      expect(error, 'missing movement error').to.be.instanceOf(NotFoundException);
    }
    expect(render.mock.calls, 'render calls on a missing movement').to.be.empty;
  });
});
