import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsAdminService } from '../src/modules/catalog/products-admin.service';
import { ProductsService } from '../src/modules/catalog/products.service';
import type { CreateProductDto } from '../src/modules/catalog/dto/product.dto';

describe('ProductsAdminService.create', () => {
  let products: ProductsAdminService;

  let existsWithName: ReturnType<typeof vi.fn>;
  let categoryExists: ReturnType<typeof vi.fn>;
  let brandExists: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let record: ReturnType<typeof vi.fn>;

  const CREADO = {
    id: 'product-1',
    name: 'Havana Club 7',
    category: { name: 'Ron' },
  };

  beforeEach(() => {
    existsWithName = vi.fn().mockResolvedValue(false);
    categoryExists = vi.fn().mockResolvedValue(true);
    brandExists = vi.fn().mockResolvedValue(true);
    create = vi.fn().mockResolvedValue(CREADO);
    record = vi.fn().mockResolvedValue(undefined);

    const repository = {
      findById: vi.fn(),
      existsWithName,
      categoryExists,
      brandExists,
      create,
    } as any;

    products = new ProductsAdminService(repository, new ProductsService(repository), {
      record,
    } as any);
  });

  it('con todos los opcionales presentes, los guarda tal cual', async () => {
    // Arrange
    const dto: CreateProductDto = {
      name: 'Havana Club 7',
      categoryId: 'category-1',
      brandId: 'brand-1',
      subcategory: 'Anejo',
      abv: 40,
      origin: 'Cuba',
      age: '7 anos',
      caseSize: 6,
      minimumStock: 12,
    };

    // Act
    const resultado = await products.create(dto);

    // Assert
    expect(create).toHaveBeenCalledWith({
      name: 'Havana Club 7',
      categoryId: 'category-1',
      brandId: 'brand-1',
      subcategory: 'Anejo',
      abv: 40,
      origin: 'Cuba',
      age: '7 anos',
      caseSize: 6,
      minimumStock: 12,
    });
    expect(record).toHaveBeenCalledOnce();
    expect(resultado).toBe(CREADO);
  });

  it('sin opcionales, los deja nulos y la caja en doce', async () => {
    // Arrange
    const dto: CreateProductDto = {
      name: 'Havana Club 7',
      categoryId: 'category-1',
    };

    // Act
    await products.create(dto);

    // Assert
    expect(create).toHaveBeenCalledWith({
      name: 'Havana Club 7',
      categoryId: 'category-1',
      brandId: null,
      subcategory: null,
      abv: null,
      origin: null,
      age: null,
      caseSize: 12,
      minimumStock: null,
    });
  });

  it('con el nombre ya usado, lanza ConflictException y no crea nada', async () => {
    // Arrange
    existsWithName.mockResolvedValue(true);

    // Act & Assert
    await expect(
      products.create({ name: 'Havana Club 7', categoryId: 'category-1' }),
    ).rejects.toThrow(ConflictException);

    expect(create).not.toHaveBeenCalled();
  });

  it('con una categoria inexistente, lanza BadRequestException', async () => {
    // Arrange
    categoryExists.mockResolvedValue(false);

    // Act & Assert
    await expect(
      products.create({ name: 'Havana Club 7', categoryId: 'category-fantasma' }),
    ).rejects.toThrow(BadRequestException);

    expect(create).not.toHaveBeenCalled();
  });

  it('con una marca inexistente, lanza BadRequestException', async () => {
    // Arrange
    brandExists.mockResolvedValue(false);

    // Act & Assert
    await expect(
      products.create({
        name: 'Havana Club 7',
        categoryId: 'category-1',
        brandId: 'brand-fantasma',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(create).not.toHaveBeenCalled();
  });
});
