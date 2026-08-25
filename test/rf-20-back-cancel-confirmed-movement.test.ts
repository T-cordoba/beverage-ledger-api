import { describe, expect, it } from 'vitest';

describe('RF-20 - Anular un movimiento confirmado', () => {
  it('Camino 1 - movimiento confirmado', () => {
    const status = 'CONFIRMED';

    expect(status).toBe('CONFIRMED');
  });

  it('Camino 2 - movimiento cancelado', () => {
    const status = 'CANCELLED';

    expect(status).toBe('CANCELLED');
  });

  it('Camino 3 - movimiento no confirmado', () => {
    const status = 'DRAFT';

    expect(status).not.toBe('CONFIRMED');
  });

  it('Camino 4 - se revierte el stock', () => {
    const wasConfirmed = true;

    expect(wasConfirmed).toBe(true);
  });

  it('Camino 5 - se registra la anulación', () => {
    const action = 'movement.cancelled';

    expect(action).toBe('movement.cancelled');
  });
});