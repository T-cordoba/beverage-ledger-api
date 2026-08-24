import { describe, expect, it } from 'vitest';
import { toDto } from '../src/modules/inventory/repositories/stock.repository';

/**
 * RF-22 - BACK - toDto(row)
 * Un test por cada camino de la tabla de docs/testing/RF-22-existencias-actuales.md.
 * Lo que recibe son filas de producto, que son datos y no dobles de prueba.
 */
describe('toDto', () => {
  // Los campos que ninguna decision toca. Cada camino le agrega los tres que si.
  const PRODUCTO = {
    id: 'e3f1c0aa-0000-4000-8000-000000000001',
    name: 'Absolut Blue 750ml',
    caseSize: 12,
    category: { name: 'Vodka' },
  };

  const CON_EXISTENCIAS = [{ quantityBase: 40 }];
  const SIN_EXISTENCIAS: { quantityBase: number }[] = [];
  const MARCA = { name: 'Absolut' };

  it('Camino 1 - hay existencias, hay marca y no hay minimo definido', () => {
    const dto = toDto({
      ...PRODUCTO,
      stockLevels: CON_EXISTENCIAS,
      brand: MARCA,
      minimumStock: null,
    });

    expect(dto.quantityBase).toBe(40);
    expect(dto.brandName).toBe('Absolut');
    expect(dto.isBelowMinimum).toBe(false);
  });

  it('Camino 2 - hay existencias, hay marca y estan por debajo del minimo', () => {
    const dto = toDto({
      ...PRODUCTO,
      stockLevels: CON_EXISTENCIAS,
      brand: MARCA,
      minimumStock: 50,
    });

    expect(dto.quantityBase).toBe(40);
    expect(dto.brandName).toBe('Absolut');
    expect(dto.isBelowMinimum).toBe(true);
  });

  it('Camino 3 - hay existencias, hay marca y estan por encima del minimo', () => {
    const dto = toDto({
      ...PRODUCTO,
      stockLevels: CON_EXISTENCIAS,
      brand: MARCA,
      minimumStock: 10,
    });

    expect(dto.quantityBase).toBe(40);
    expect(dto.brandName).toBe('Absolut');
    expect(dto.isBelowMinimum).toBe(false);
  });

  it('Camino 4 - hay existencias, no hay marca y no hay minimo definido', () => {
    const dto = toDto({
      ...PRODUCTO,
      stockLevels: CON_EXISTENCIAS,
      brand: null,
      minimumStock: null,
    });

    expect(dto.quantityBase).toBe(40);
    expect(dto.brandName).toBeNull();
    expect(dto.isBelowMinimum).toBe(false);
  });

  it('Camino 5 - hay existencias, no hay marca y estan por debajo del minimo', () => {
    const dto = toDto({ ...PRODUCTO, stockLevels: CON_EXISTENCIAS, brand: null, minimumStock: 50 });

    expect(dto.quantityBase).toBe(40);
    expect(dto.brandName).toBeNull();
    expect(dto.isBelowMinimum).toBe(true);
  });

  it('Camino 6 - hay existencias, no hay marca y estan por encima del minimo', () => {
    const dto = toDto({ ...PRODUCTO, stockLevels: CON_EXISTENCIAS, brand: null, minimumStock: 10 });

    expect(dto.quantityBase).toBe(40);
    expect(dto.brandName).toBeNull();
    expect(dto.isBelowMinimum).toBe(false);
  });

  it('Camino 7 - el producto nunca se ha movido, hay marca y no hay minimo definido', () => {
    const dto = toDto({
      ...PRODUCTO,
      stockLevels: SIN_EXISTENCIAS,
      brand: MARCA,
      minimumStock: null,
    });

    expect(dto.quantityBase).toBe(0);
    expect(dto.brandName).toBe('Absolut');
    expect(dto.isBelowMinimum).toBe(false);
  });

  it('Camino 8 - el producto nunca se ha movido, hay marca y el cero esta bajo el minimo', () => {
    const dto = toDto({
      ...PRODUCTO,
      stockLevels: SIN_EXISTENCIAS,
      brand: MARCA,
      minimumStock: 50,
    });

    expect(dto.quantityBase).toBe(0);
    expect(dto.brandName).toBe('Absolut');
    expect(dto.isBelowMinimum).toBe(true);
  });

  it('Camino 9 - el producto nunca se ha movido, no hay marca y no hay minimo definido', () => {
    const dto = toDto({
      ...PRODUCTO,
      stockLevels: SIN_EXISTENCIAS,
      brand: null,
      minimumStock: null,
    });

    expect(dto.quantityBase).toBe(0);
    expect(dto.brandName).toBeNull();
    expect(dto.isBelowMinimum).toBe(false);
  });

  it('Camino 10 - el producto nunca se ha movido, no hay marca y el cero esta bajo el minimo', () => {
    const dto = toDto({ ...PRODUCTO, stockLevels: SIN_EXISTENCIAS, brand: null, minimumStock: 50 });

    expect(dto.quantityBase).toBe(0);
    expect(dto.brandName).toBeNull();
    expect(dto.isBelowMinimum).toBe(true);
  });
});
