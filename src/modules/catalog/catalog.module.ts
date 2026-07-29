import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { BrandsRepository } from './repositories/brands.repository';
import { CategoriesRepository } from './repositories/categories.repository';
import { ProductsRepository } from './repositories/products.repository';

@Module({
  imports: [AuditModule],
  controllers: [CategoriesController, BrandsController, ProductsController],
  providers: [
    CategoriesService,
    BrandsService,
    ProductsService,
    CategoriesRepository,
    BrandsRepository,
    ProductsRepository,
  ],
  // Inventory resolves the products a movement refers to through the service, so
  // it never reaches for the catalogue's repositories.
  exports: [ProductsService],
})
export class CatalogModule {}
