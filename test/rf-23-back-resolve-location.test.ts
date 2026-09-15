import { totalmem } from 'node:os';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { LocationsService } from '../src/modules/inventory/locations.service';
import type { AuditService } from '../src/modules/audit/audit.service';
import type { LocationsRepository } from '../src/modules/inventory/repositories/locations.repository';

describe('resolve', () => {
  const BODEGA = 'a1b2c3d4-0000-4000-8000-000000000002';
  const BODEGA_AJENA = '00000000-0000-4000-8000-000000000000';

  const nuevoServicio = (existe: boolean, porDefecto: string | null) => {
    const repo = {
      exists: vi.fn().mockResolvedValue(existe),
      findDefaultId: vi.fn().mockResolvedValue(porDefecto),
    } as unknown as LocationsRepository;

    return { locations: new LocationsService(repo, {} as AuditService), repo };
  };

  it('Camino 1 - la bodega pedida existe y se devuelve tal cual', async () => {
    const { locations, repo } = nuevoServicio(true, BODEGA);

    const resuelta = await locations.resolve(BODEGA);

    expect(resuelta).toBe(BODEGA);
    expect(repo.exists).toHaveBeenCalledWith(BODEGA);
    expect(repo.findDefaultId).not.toHaveBeenCalled();
  });

  it('Camino 2 - la bodega pedida no es de la organizacion y se rechaza', async () => {
    const { locations, repo } = nuevoServicio(false, BODEGA);

    await expect(locations.resolve(BODEGA_AJENA)).rejects.toThrow(BadRequestException);
    await expect(locations.resolve(BODEGA_AJENA)).rejects.toThrow('That location does not exist');
    expect(repo.findDefaultId).not.toHaveBeenCalled();
  });

  it('Camino 3 - no se pide bodega y se devuelve la que esta por defecto', async () => {
    const { locations, repo } = nuevoServicio(true, BODEGA);

    const resuelta = await locations.resolve();

    expect(resuelta).toBe(BODEGA);
    expect(repo.exists).not.toHaveBeenCalled();
    expect(repo.findDefaultId).toHaveBeenCalledTimes(1);
  });

  it('Camino 4 - no se pide bodega y la organizacion no tiene una por defecto', async () => {
    const { locations, repo } = nuevoServicio(true, null);

    await expect(locations.resolve()).rejects.toThrow(BadRequestException);
    await expect(locations.resolve()).rejects.toThrow('The organization has no default location');
    expect(repo.exists).not.toHaveBeenCalled();
  });

  it('Metricas - uso de CPU y de memoria del proceso', async () => {
    const { locations } = nuevoServicio(true, BODEGA);
    const VUELTAS = 2_000_000;

    const cpuInicial = process.cpuUsage();
    const inicio = Date.now();

    for (let i = 0; i < VUELTAS; i++) await locations.resolve(BODEGA);

    const cpu = process.cpuUsage(cpuInicial);
    const ms = Date.now() - inicio;
    const tcpu = (cpu.user + cpu.system) / 1000;
    const rss = process.memoryUsage().rss / 1024 / 1024;
    const total = totalmem() / 1024 / 1024;

    console.log(`CPU: ${tcpu.toFixed(1)} ms / ${ms} ms = ${((tcpu / ms) * 100).toFixed(1)} %`);
    console.log(
      `Memoria: ${rss.toFixed(1)} MB / ${total.toFixed(0)} MB = ${((rss / total) * 100).toFixed(2)} %`,
    );

    expect(ms).toBeGreaterThan(0);
  });
});
