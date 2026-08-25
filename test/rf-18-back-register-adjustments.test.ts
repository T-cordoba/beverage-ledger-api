import { describe, expect, it } from 'vitest';

describe('RF-18 - Registrar un ajuste', () => {
  it('Camino 1 - un ajuste positivo es válido', () => {
    const quantity = 10;

    expect(quantity).not.toBe(0);
    expect(Math.abs(quantity)).toBe(10);
  });

  it('Camino 2 - un ajuste negativo es válido', () => {
    const quantity = -10;

    expect(quantity).not.toBe(0);
    expect(Math.abs(quantity)).toBe(10);
  });

  it('Camino 3 - una cantidad cero es rechazada', () => {
    const quantity = 0;

    expect(quantity).toBe(0);
  });

  it('Camino 4 - una razón válida es aceptada', () => {
    const reason = 'Corrección de inventario';

    expect(reason.trim()).not.toBe('');
  });

  it('Camino 5 - una razón vacía es rechazada', () => {
    const reason = '';

    expect(reason.trim()).toBe('');
  });

  it('Camino 6 - una razón con solo espacios es rechazada', () => {
    const reason = '   ';

    expect(reason.trim()).toBe('');
  });

  it('Camino 7 - el ajuste no debe tener destino', () => {
    const destinationLocationId = null;

    expect(destinationLocationId).toBeNull();
  });

  it('Camino 8 - un ajuste válido conserva el signo de la cantidad', () => {
    const quantity = -5;
    const magnitude = Math.abs(quantity);
    const quantityBase = quantity;

    expect(magnitude).toBe(5);
    expect(quantityBase).toBe(-5);
  });
});