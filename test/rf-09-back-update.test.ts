
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsService } from '../src/modules/catalog/products.service';
import type { UpdateProductDto } from '../src/modules/catalog/dto/product.dto';

describe('ProductsService.update', () => {
  let products: ProductsService;

  let findById: ReturnType<typeof vi.fn>;
  let existsWithName: ReturnType<typeof vi.fn>;
  let categoryExists: ReturnType<typeof vi.fn>;
  let brandExists: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let record: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findById = vi.fn();
    existsWithName = vi.fn();
    categoryExists = vi.fn();
    brandExists = vi.fn();
    update = vi.fn();
    record = vi.fn();

    products = new ProductsService(
      {
        findById,
        existsWithName,
        categoryExists,
        brandExists,
        update,
      } as any,
      {
        record,
      } as any,
    );
  });

  it('Camino 1 - dto sin nombre ni desactivacion, producto actualizado sin cambios de nombre', async () => {
    // Arrange
    const producto = {
      id: 'product-1',
      name: 'Whisky Escoces',
      isActive: true,
    };

    findById.mockResolvedValue(producto);
    update.mockResolvedValue(undefined);
    record.mockResolvedValue(undefined);

    const dto: UpdateProductDto = {
      origin: 'Escocia',
    };

    // Act
    const resultado = await products.update('product-1', dto);

    // Assert
    expect(resultado.id).toBe('product-1');
    expect(resultado.name).toBe('Whisky Escoces');
    expect(resultado.isActive).toBe(true);
    expect(update).toHaveBeenCalledWith('product-1', dto);
  });

  it('Camino 2 - dto con nombre igual al actual, no hay cambio de nombre', async () => {
    // Arrange
    const producto = {
      id: 'product-2',
      name: 'Whisky Original',
      isActive: true,
    };

    findById.mockResolvedValue(producto);
    update.mockResolvedValue(undefined);
    record.mockResolvedValue(undefined);

    const dto: UpdateProductDto = {
      name: 'Whisky Original',
    };

    // Act
    const resultado = await products.update('product-2', dto);

    // Assert
    expect(resultado.name).toBe('Whisky Original');
    expect(existsWithName).not.toHaveBeenCalled();
  });

  it('Camino 3 - dto con nombre distinto al actual, nombre actualizado', async () => {
    // Arrange
    const producto = {
      id: 'product-3',
      name: 'Nombre Original',
      isActive: true,
    };

    const nuevoNombre = 'Nombre Nuevo';

    findById
      .mockResolvedValueOnce(producto)
      .mockResolvedValueOnce({
        ...producto,
        name: nuevoNombre,
      });

    existsWithName.mockResolvedValue(false);
    update.mockResolvedValue(undefined);
    record.mockResolvedValue(undefined);

    const dto: UpdateProductDto = {
      name: nuevoNombre,
    };

    // Act
    const resultado = await products.update('product-3', dto);

    // Assert
    expect(resultado.name).toBe(nuevoNombre);
    expect(existsWithName).toHaveBeenCalledWith(nuevoNombre, 'product-3');
    expect(update).toHaveBeenCalledWith('product-3', dto);
  });

  it('Camino 4 - dto con isActive=false pero producto ya inactivo, sin cambio efectivo', async () => {
    // Arrange
    const producto = {
      id: 'product-4',
      name: 'Producto Inactivo',
      isActive: false,
    };

    findById
      .mockResolvedValueOnce(producto)
      .mockResolvedValueOnce(producto);

    update.mockResolvedValue(undefined);
    record.mockResolvedValue(undefined);

    const dto: UpdateProductDto = {
      isActive: false,
    };

    // Act
    const resultado = await products.update('product-4', dto);

    // Assert
    expect(resultado.isActive).toBe(false);
    expect(update).toHaveBeenCalledWith('product-4', dto);
  });

  it('Camino 5 - dto con isActive=false y producto activo, producto desactivado', async () => {
    // Arrange
    const producto = {
      id: 'product-5',
      name: 'Producto Activo',
      isActive: true,
    };

    const productoDesactivado = {
      ...producto,
      isActive: false,
    };

    findById
      .mockResolvedValueOnce(producto)
      .mockResolvedValueOnce(productoDesactivado);

    update.mockResolvedValue(undefined);
    record.mockResolvedValue(undefined);

    const dto: UpdateProductDto = {
      isActive: false,
    };

    // Act
    const resultado = await products.update('product-5', dto);

    // Assert
    expect(resultado.isActive).toBe(false);
    expect(update).toHaveBeenCalledWith('product-5', dto);
    expect(record).toHaveBeenCalled();
  });
});
