import type { StockLevelDto } from '../dto/stock.dto';

export interface StockProductRow {
  id: string;
  name: string;
  caseSize: number;
  minimumStock: number | null;
  category: { name: string };
  brand: { name: string } | null;
  stockLevels: { quantityBase: number }[];
}

/** A product with no row yet has never moved, which is stock zero. */
export const toDto = (row: StockProductRow): StockLevelDto => {
  const quantityBase = row.stockLevels[0]?.quantityBase ?? 0;

  return {
    productId: row.id,
    productName: row.name,
    brandName: row.brand?.name ?? null,
    categoryName: row.category.name,
    quantityBase,
    caseSize: row.caseSize,
    minimumStock: row.minimumStock,
    isBelowMinimum: row.minimumStock !== null && quantityBase <= row.minimumStock,
  };
};
