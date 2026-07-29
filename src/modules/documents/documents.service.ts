import { Injectable } from '@nestjs/common';
import { MovementsService } from '../inventory/movements.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { MovementPdfService } from './movement-pdf.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly movements: MovementsService,
    private readonly organizations: OrganizationsService,
    private readonly pdf: MovementPdfService,
  ) {}

  /**
   * @throws {NotFoundException} which is also the answer for another
   * organization's movement, since the lookup is scoped.
   */
  async movementPdf(id: string): Promise<{ filename: string; content: Buffer }> {
    const [movement, organization] = await Promise.all([
      this.movements.findOne(id),
      this.organizations.current(),
    ]);

    const content = await this.pdf.render(movement, organization);

    return { filename: `${movement.code}.pdf`, content: Buffer.from(content) };
  }
}
