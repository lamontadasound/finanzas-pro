// ── Transporte de Drive SIMULADO — solo para pruebas y para el arnés local ──
// Implementa `DriveTransport` en memoria, sin red ni credenciales. Permite
// forzar fallos (para probar reintentos) y contenido duplicado. NUNCA se usa
// en producción — la cuenta real de Drive sigue sin conectarse.
import type { DriveTransport, DriveUploadResult } from './driveSync';

export function crearTransporteDriveSimulado(opts: { fallarSiempreEnFacturaId?: string; fallarNVeces?: number } = {}) {
  const archivosPorFactura = new Map<string, DriveUploadResult>();
  const archivosPorHash = new Map<string, DriveUploadResult>();
  let intentosFallidos = 0;
  let subidasReales = 0;

  const transport: DriveTransport = {
    async buscarExistente(facturaId) {
      return archivosPorFactura.get(facturaId) ?? null;
    },
    async buscarPorHash(hash) {
      return archivosPorHash.get(hash) ?? null;
    },
    async upload({ facturaId, contenidoHash, carpetaId }) {
      const debeFallar =
        facturaId === opts.fallarSiempreEnFacturaId ||
        (opts.fallarNVeces != null && intentosFallidos < opts.fallarNVeces);
      if (debeFallar) {
        intentosFallidos += 1;
        throw new Error('Fallo simulado de red/API de Drive');
      }
      subidasReales += 1;
      const resultado: DriveUploadResult = {
        fileId: `sim-file-${facturaId}-${subidasReales}`,
        folderId: carpetaId,
        link: `https://drive.example/simulado/${facturaId}`,
      };
      archivosPorFactura.set(facturaId, resultado);
      archivosPorHash.set(contenidoHash, resultado);
      return resultado;
    },
  };

  return { transport, contarSubidasReales: () => subidasReales, contarIntentosFallidos: () => intentosFallidos };
}
