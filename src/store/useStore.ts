/**
 * useStore.ts — Store global con Supabase como backend
 * ─────────────────────────────────────────────────────────────────────────────
 * • El estado vive en Zustand (en memoria, reactivo).
 * • Al iniciar la app se cargan los datos desde Supabase (initData).
 * • Cada mutación actualiza el estado local (optimista) y sincroniza con
 *   Supabase en segundo plano.
 * • Toda la lógica de cálculo (helpers.ts) permanece exactamente igual.
 */
import { create } from 'zustand';
import type { AppState } from '../types';
import { db } from '../lib/db';

export const useStore = create<AppState>()((set, get) => ({

  // ── Estado inicial vacío (se llena con initData) ──────────────────────────
  eventos:      [],
  ingresos:     [],
  gastos:       [],
  suplidos:     [],
  facturas:     [],
  equipo:       [],
  gastosEvento: [],
  pagosEvento:  [],
  _loaded:      false,
  _error:       null,

  // ── Carga inicial desde Supabase ──────────────────────────────────────────
  initData: async () => {
    try {
      const [eventos, ingresos, gastos, suplidos, facturas, equipo, gastosEvento, pagosEvento] =
        await Promise.all([
          db.eventos.getAll(),
          db.ingresos.getAll(),
          db.gastos.getAll(),
          db.suplidos.getAll(),
          db.facturas.getAll(),
          db.equipo.getAll(),
          db.gastosEvento.getAll(),
          db.pagosEvento.getAll(),
        ]);
      set({ eventos, ingresos, gastos, suplidos, facturas, equipo, gastosEvento, pagosEvento, _loaded: true, _error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Store] Error al cargar datos:', msg);
      set({ _loaded: true, _error: msg });
    }
  },

  // ── EVENTOS ───────────────────────────────────────────────────────────────
  addEvento: (e) => {
    set((s) => ({ eventos: [...s.eventos, e] }));
    db.eventos.insert(e).catch((err) => console.error('[Store] addEvento:', err));
  },
  updateEvento: (id, partial) => {
    set((s) => ({ eventos: s.eventos.map((x) => (x.id === id ? { ...x, ...partial } : x)) }));
    const updated = get().eventos.find((x) => x.id === id);
    if (updated) db.eventos.upsert(updated).catch((err) => console.error('[Store] updateEvento:', err));
  },
  deleteEvento: (id) => {
    set((s) => ({ eventos: s.eventos.filter((x) => x.id !== id) }));
    db.eventos.delete(id).catch((err) => console.error('[Store] deleteEvento:', err));
  },

  // ── INGRESOS ──────────────────────────────────────────────────────────────
  addIngreso: (i) => {
    set((s) => ({ ingresos: [...s.ingresos, i] }));
    db.ingresos.insert(i).catch((err) => console.error('[Store] addIngreso:', err));
  },
  updateIngreso: (id, partial) => {
    set((s) => ({ ingresos: s.ingresos.map((x) => (x.id === id ? { ...x, ...partial } : x)) }));
    const updated = get().ingresos.find((x) => x.id === id);
    if (updated) db.ingresos.upsert(updated).catch((err) => console.error('[Store] updateIngreso:', err));
  },
  deleteIngreso: (id) => {
    set((s) => ({ ingresos: s.ingresos.filter((x) => x.id !== id) }));
    db.ingresos.delete(id).catch((err) => console.error('[Store] deleteIngreso:', err));
  },

  // ── GASTOS ────────────────────────────────────────────────────────────────
  addGasto: (g) => {
    set((s) => ({ gastos: [...s.gastos, g] }));
    db.gastos.insert(g).catch((err) => console.error('[Store] addGasto:', err));
  },
  updateGasto: (id, partial) => {
    set((s) => ({ gastos: s.gastos.map((x) => (x.id === id ? { ...x, ...partial } : x)) }));
    const updated = get().gastos.find((x) => x.id === id);
    if (updated) db.gastos.upsert(updated).catch((err) => console.error('[Store] updateGasto:', err));
  },
  deleteGasto: (id) => {
    set((s) => ({ gastos: s.gastos.filter((x) => x.id !== id) }));
    db.gastos.delete(id).catch((err) => console.error('[Store] deleteGasto:', err));
  },

  // ── SUPLIDOS ──────────────────────────────────────────────────────────────
  addSuplido: (s) => {
    set((st) => ({ suplidos: [...st.suplidos, s] }));
    db.suplidos.insert(s).catch((err) => console.error('[Store] addSuplido:', err));
  },
  updateSuplido: (id, partial) => {
    set((st) => ({ suplidos: st.suplidos.map((x) => (x.id === id ? { ...x, ...partial } : x)) }));
    const updated = get().suplidos.find((x) => x.id === id);
    if (updated) db.suplidos.upsert(updated).catch((err) => console.error('[Store] updateSuplido:', err));
  },
  deleteSuplido: (id) => {
    set((st) => ({ suplidos: st.suplidos.filter((x) => x.id !== id) }));
    db.suplidos.delete(id).catch((err) => console.error('[Store] deleteSuplido:', err));
  },

  // ── FACTURAS ──────────────────────────────────────────────────────────────
  addFactura: (f) => {
    set((s) => ({ facturas: [...s.facturas, f] }));
    db.facturas.insert(f).catch((err) => console.error('[Store] addFactura:', err));
  },
  updateFactura: (id, partial) => {
    set((s) => ({ facturas: s.facturas.map((x) => (x.id === id ? { ...x, ...partial } : x)) }));
    const updated = get().facturas.find((x) => x.id === id);
    if (updated) db.facturas.upsert(updated).catch((err) => console.error('[Store] updateFactura:', err));
  },
  deleteFactura: (id) => {
    set((s) => ({ facturas: s.facturas.filter((x) => x.id !== id) }));
    db.facturas.delete(id).catch((err) => console.error('[Store] deleteFactura:', err));
  },

  // ── EQUIPO ────────────────────────────────────────────────────────────────
  addEquipo: (e) => {
    set((s) => ({ equipo: [...s.equipo, e] }));
    db.equipo.insert(e).catch((err) => console.error('[Store] addEquipo:', err));
  },
  updateEquipo: (id, partial) => {
    set((s) => ({ equipo: s.equipo.map((x) => (x.id === id ? { ...x, ...partial } : x)) }));
    const updated = get().equipo.find((x) => x.id === id);
    if (updated) db.equipo.upsert(updated).catch((err) => console.error('[Store] updateEquipo:', err));
  },
  deleteEquipo: (id) => {
    set((s) => ({ equipo: s.equipo.filter((x) => x.id !== id) }));
    db.equipo.delete(id).catch((err) => console.error('[Store] deleteEquipo:', err));
  },

  // ── GASTOS EVENTO ─────────────────────────────────────────────────────────
  addGastoEvento: (g) => {
    set((s) => ({ gastosEvento: [...s.gastosEvento, g] }));
    db.gastosEvento.insert(g).catch((err) => console.error('[Store] addGastoEvento:', err));
  },
  updateGastoEvento: (id, partial) => {
    set((s) => ({ gastosEvento: s.gastosEvento.map((x) => (x.id === id ? { ...x, ...partial } : x)) }));
    const updated = get().gastosEvento.find((x) => x.id === id);
    if (updated) db.gastosEvento.upsert(updated).catch((err) => console.error('[Store] updateGastoEvento:', err));
  },
  deleteGastoEvento: (id) => {
    set((s) => ({ gastosEvento: s.gastosEvento.filter((x) => x.id !== id) }));
    db.gastosEvento.delete(id).catch((err) => console.error('[Store] deleteGastoEvento:', err));
  },

  // ── PAGOS EVENTO ──────────────────────────────────────────────────────────
  addPagoEvento: (p) => {
    set((s) => ({ pagosEvento: [...s.pagosEvento, p] }));
    db.pagosEvento.insert(p).catch((err) => console.error('[Store] addPagoEvento:', err));
  },
  updatePagoEvento: (id, partial) => {
    set((s) => ({ pagosEvento: s.pagosEvento.map((x) => (x.id === id ? { ...x, ...partial } : x)) }));
    const updated = get().pagosEvento.find((x) => x.id === id);
    if (updated) db.pagosEvento.upsert(updated).catch((err) => console.error('[Store] updatePagoEvento:', err));
  },
  deletePagoEvento: (id) => {
    set((s) => ({ pagosEvento: s.pagosEvento.filter((x) => x.id !== id) }));
    db.pagosEvento.delete(id).catch((err) => console.error('[Store] deletePagoEvento:', err));
  },
}));
