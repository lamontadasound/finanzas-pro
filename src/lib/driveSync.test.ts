// ── Pruebas del backend de Drive — subida, error, reintento, duplicados ────
// Contra un transporte SIMULADO (sin red, sin credenciales, sin conectar la
// cuenta real) — exactamente lo pedido: "pruebas simuladas de subida,
// error, reintento y prevención de duplicados. La autorización de la
// cuenta queda para después".
import { describe, it, expect } from 'vitest';
import { sincronizarFacturaConDrive } from './driveSync';
import { crearTransporteDriveSimulado } from './driveSync.simulado';

const factura = (id: string) => ({ id, driveNombreArchivo: `factura-${id}.pdf` });

describe('Subida — caso normal', () => {
  it('sube el archivo y devuelve fileId/folderId/link', async () => {
    const { transport } = crearTransporteDriveSimulado();
    const r = await sincronizarFacturaConDrive(factura('f1'), 'hash-abc', 'carpeta-2026', transport);
    expect(r.ok).toBe(true);
    expect(r.resultado?.fileId).toBeTruthy();
    expect(r.resultado?.folderId).toBe('carpeta-2026');
  });
});

describe('Error — la factura nunca se marca como sincronizada si falla', () => {
  it('un fallo de transporte devuelve ok:false y reintentable:true, sin resultado', async () => {
    const { transport } = crearTransporteDriveSimulado({ fallarSiempreEnFacturaId: 'f2' });
    const r = await sincronizarFacturaConDrive(factura('f2'), 'hash-x', 'carpeta-2026', transport);
    expect(r.ok).toBe(false);
    expect(r.reintentable).toBe(true);
    expect(r.resultado).toBeUndefined();
    expect(r.error).toMatch(/Fallo simulado/);
  });
});

describe('Reintento — sin duplicados tras un fallo transitorio', () => {
  it('falla las 2 primeras veces, la 3ª sube correctamente, y solo hay UNA subida real', async () => {
    const { transport, contarSubidasReales, contarIntentosFallidos } = crearTransporteDriveSimulado({ fallarNVeces: 2 });
    const r1 = await sincronizarFacturaConDrive(factura('f3'), 'hash-y', 'carpeta-2026', transport);
    expect(r1.ok).toBe(false);
    const r2 = await sincronizarFacturaConDrive(factura('f3'), 'hash-y', 'carpeta-2026', transport);
    expect(r2.ok).toBe(false);
    const r3 = await sincronizarFacturaConDrive(factura('f3'), 'hash-y', 'carpeta-2026', transport);
    expect(r3.ok).toBe(true);
    expect(contarIntentosFallidos()).toBe(2);
    expect(contarSubidasReales()).toBe(1); // nunca dos subidas reales para la misma factura
  });

  it('reintentar DESPUÉS de un éxito no vuelve a subir — se detecta por facturaId (idempotencia)', async () => {
    const { transport, contarSubidasReales } = crearTransporteDriveSimulado();
    await sincronizarFacturaConDrive(factura('f4'), 'hash-z', 'carpeta-2026', transport);
    const segundaLlamada = await sincronizarFacturaConDrive(factura('f4'), 'hash-z', 'carpeta-2026', transport);
    expect(segundaLlamada.ok).toBe(true);
    expect(contarSubidasReales()).toBe(1); // la segunda llamada reutilizó el archivo existente, no subió otro
  });
});

describe('Prevención de duplicados por contenido', () => {
  it('si ya existe un archivo con el mismo hash en la carpeta (subido por otra factura/usuario), se marca como duplicado en vez de subir una copia', async () => {
    const { transport, contarSubidasReales } = crearTransporteDriveSimulado();
    await sincronizarFacturaConDrive(factura('original'), 'hash-compartido', 'carpeta-2026', transport);
    const r = await sincronizarFacturaConDrive(factura('otra-factura-distinta'), 'hash-compartido', 'carpeta-2026', transport);
    expect(r.ok).toBe(true);
    expect(r.resultado?.duplicadoDe).toBeTruthy();
    expect(contarSubidasReales()).toBe(1); // solo la primera subida fue real; la segunda detectó el duplicado
  });
});
