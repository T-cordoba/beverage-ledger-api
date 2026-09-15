import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentsService } from '../src/modules/documents/documents.service';

describe('RF-21 - Descarga del comprobante en PDF - Back', () => {
  let service: DocumentsService;
  let findOne: ReturnType<typeof vi.fn>;
  let current: ReturnType<typeof vi.fn>;
  let render: ReturnType<typeof vi.fn>;

  const fakeMovement = {
    id: 'movement-1',
    code: 'MOV-001',
    type: 'OUTBOUND',
    status: 'CONFIRMED',
    items: [{ productId: 'p1', locationId: 'loc-1', quantityBase: 5 }],
  };

  const fakeOrganization = {
    id: 'org-1',
    name: 'Empresa de prueba',
    timezone: 'America/Bogota',
  };

  const fakePdfContent = new Uint8Array([37, 80, 68, 70]); // %PDF

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

  it('Camino 1 - se genera y retorna correctamente el comprobante PDF', async () => {
    // Arrange
    findOne.mockResolvedValue(fakeMovement);
    current.mockResolvedValue(fakeOrganization);
    render.mockResolvedValue(fakePdfContent);

    // Act
    const result = await service.movementPdf('movement-1');

    // Assert
    expect(findOne).toHaveBeenCalledWith('movement-1');
    expect(current).toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith(fakeMovement, fakeOrganization);
    expect(result.filename).toBe('MOV-001.pdf');
    expect(result.content).toBeInstanceOf(Buffer);
  });
});