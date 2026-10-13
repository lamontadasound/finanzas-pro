import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { lineaDeIngreso, lineaDeGasto, lineaDeFactura } from '../lib/contabilidad';
import type { Impuesto } from '../types';

// ── Filtro de permisos por línea — Fase F ────────────────────────────────
// Fuente única para Contabilidad (Resumen, Pagos, Facturas, Informe,
// Impuestos): el acceso al MÓDULO "Contabilidad" no implica ver TODAS las
// líneas — un usuario solo ve, dentro de Contabilidad, las líneas que
// además tiene permitidas (`lineasVisibles()`, la misma fuente que usan
// Sidebar/Dock/Dashboard/rutas). Defensa en profundidad: el store hoy trae
// todas las filas de Supabase sin filtrar (RLS real está preparada, no
// ejecutada) — sin este filtro, Contabilidad enseñaría cifras de líneas
// ajenas a cualquier usuario con el módulo activado.
const impuestoLineaMatch = (linea: Impuesto['lineaNegocio'], lineasVisibles: string[]): boolean => {
  if (!linea) return true; // sin línea asignada = impuesto de la sociedad, visible para todo el que vea Contabilidad
  const map: Record<string, string> = { 'La Montada Sound': 'montada_sound', DJs: 'dj', 'Real Madrid': 'real_madrid' };
  const id = map[linea];
  return id ? lineasVisibles.includes(id) : true;
};

export function usePermittedFinancialData() {
  const allIngresos = useStore((s) => s.ingresos);
  const allGastos = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const allFacturas = useStore((s) => s.facturas);
  const allImpuestos = useStore((s) => s.impuestos);
  const lineasVisibles = useAuthStore((s) => s.lineasVisibles());

  const ingresos = useMemo(
    () => allIngresos.filter((i) => lineasVisibles.includes(lineaDeIngreso(i))),
    [allIngresos, lineasVisibles],
  );
  const gastos = useMemo(
    () => allGastos.filter((g) => lineasVisibles.includes(lineaDeGasto(g))),
    [allGastos, lineasVisibles],
  );
  const ingresoIdsPermitidos = useMemo(() => new Set(ingresos.map((i) => i.id)), [ingresos]);
  const gastosEvento = useMemo(
    () => allGastosEvento.filter((g) => ingresoIdsPermitidos.has(g.ingresoId)),
    [allGastosEvento, ingresoIdsPermitidos],
  );
  const facturas = useMemo(
    () => allFacturas.filter((f) => lineasVisibles.includes(lineaDeFactura(f))),
    [allFacturas, lineasVisibles],
  );
  const impuestos = useMemo(
    () => allImpuestos.filter((i) => impuestoLineaMatch(i.lineaNegocio, lineasVisibles)),
    [allImpuestos, lineasVisibles],
  );

  return { ingresos, gastos, gastosEvento, facturas, impuestos, lineasVisibles };
}
