import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { LocationsService } from './locations.service';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';
import { LocationsRepository } from './repositories/locations.repository';
import { MovementsRepository } from './repositories/movements.repository';
import { StockRepository } from './repositories/stock.repository';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [AuditModule, CatalogModule],
  controllers: [MovementsController, StockController],
  providers: [
    MovementsService,
    StockService,
    LocationsService,
    MovementsRepository,
    StockRepository,
    LocationsRepository,
  ],
  // Documents renders a movement; reports read the same ledger.
  exports: [MovementsService, LocationsService],
})
export class InventoryModule {}
