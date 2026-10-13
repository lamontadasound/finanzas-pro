// ── Id de emisión persistente por ingreso ───────────────────────────────────
// Antes, el id de la factura a emitir se generaba con `useRef(uid())`: sobrevivía
// a un reintento DENTRO de la misma apertura del modal, pero un simple
// cerrar-y-reabrir (o recargar la pestaña) perdía el id — si la emisión ya
// se había confirmado en el servidor pero la respuesta nunca llegó al
// cliente, reabrir el modal generaba un id NUEVO, y el usuario podía acabar
// pidiendo una segunda factura real para la misma intención de facturar.
//
// La garantía real de que nunca se duplica un NÚMERO sigue viviendo en el
// servidor (`emitir_numero_factura` es idempotente por `factura_id` — ver
// la migración SQL). Lo que faltaba es que el CLIENTE consiga reenviar el
// MISMO `factura_id` de forma fiable entre sesiones del modal — eso es lo
// que resuelve este módulo, con `localStorage` (persiste per-navegador,
// sobrevive a cerrar la pestaña y a recargar). No es una garantía
// multi-dispositivo — de eso sigue encargándose el servidor.
const PREFIJO = 'mi-espacio:emision-pendiente:';

/** Devuelve el id de emisión pendiente para este ingreso si existe, sin crear uno nuevo. */
export function leerEmisionPendiente(ingresoId: string): string | null {
  try {
    return localStorage.getItem(PREFIJO + ingresoId);
  } catch {
    return null; // localStorage puede no estar disponible (privado, cuota, etc.) — nunca debe romper el flujo
  }
}

/** Devuelve el id de emisión pendiente existente, o crea y persiste uno nuevo. */
export function obtenerOCrearEmisionPendiente(ingresoId: string, crearId: () => string): string {
  const existente = leerEmisionPendiente(ingresoId);
  if (existente) return existente;
  const nuevo = crearId();
  try { localStorage.setItem(PREFIJO + ingresoId, nuevo); } catch { /* ver nota arriba */ }
  return nuevo;
}

/** Limpia el id pendiente — llamar tras confirmar la emisión (con o sin éxito definitivo) o al cancelar explícitamente. */
export function limpiarEmisionPendiente(ingresoId: string): void {
  try { localStorage.removeItem(PREFIJO + ingresoId); } catch { /* ver nota arriba */ }
}
