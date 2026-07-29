import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { MovementPdfService } from './movement-pdf.service';

/**
 * Its controller shares the /movements prefix so the document keeps the natural
 * URL, while rendering stays out of the inventory module: one owns the ledger,
 * the other owns how it is printed.
 */
@Module({
  imports: [InventoryModule, OrganizationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, MovementPdfService],
})
export class DocumentsModule {}
