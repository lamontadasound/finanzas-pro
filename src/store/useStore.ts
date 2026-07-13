import { create } from 'zustand';
import type { AppState } from '../types';
import { db } from '../lib/db';

export const useStore = create<AppState>()((set, get) => ({

  eventos: [], ingresos: [], gastos: [], suplidos: [], facturas: [],
  equipo: [], gastosEvento: [], pagosEvento: [], documentos: [], usuarios: [],
  _loaded: false, _error: null,

  // ── Carga inicial ─────────────────────────────────────────────────────────
  initData: async () => {
    try {
      const [eventos, ingresos, gastos, suplidos, facturas, equipo, gastosEvento, pagosEvento, documentos, usuarios] =
        await Promise.all([
          db.eventos.getAll(), db.ingresos.getAll(), db.gastos.getAll(),
          db.suplidos.getAll(), db.facturas.getAll(), db.equipo.getAll(),
          db.gastosEvento.getAll(), db.pagosEvento.getAll(),
          db.documentos.getAll(), db.usuarios.getAll(),
        ]);
      set({ eventos, ingresos, gastos, suplidos, facturas, equipo, gastosEvento, pagosEvento, documentos, usuarios, _loaded: true, _error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Store] Error al cargar datos:', msg);
      set({ _loaded: true, _error: msg });
    }
  },

  // ── EVENTOS ───────────────────────────────────────────────────────────────
  addEvento: (e) => { set((s) => ({ eventos: [...s.eventos, e] })); db.eventos.insert(e).catch(console.error); },
  updateEvento: (id, p) => {
    set((s) => ({ eventos: s.eventos.map((x) => x.id === id ? { ...x, ...p } : x) }));
    const u = get().eventos.find((x) => x.id === id);
    if (u) db.eventos.upsert(u).catch(console.error);
  },
  deleteEvento: (id) => { set((s) => ({ eventos: s.eventos.filter((x) => x.id !== id) })); db.eventos.delete(id).catch(console.error); },

  // ── INGRESOS ─────────────────────────────────────────────────────────────
  addIngreso: (i) => { set((s) => ({ ingresos: [...s.ingresos, i] })); db.ingresos.insert(i).catch(console.error); },
  updateIngreso: (id, p) => {
    set((s) => ({ ingresos: s.ingresos.map((x) => x.id === id ? { ...x, ...p } : x) }));
    const u = get().ingresos.find((x) => x.id === id);
    if (u) db.ingresos.upsert(u).catch(console.error);
  },
  deleteIngreso: (id) => { set((s) => ({ ingresos: s.ingresos.filter((x) => x.id !== id) })); db.ingresos.delete(id).catch(console.error); },

  // ── GASTOS ────────────────────────────────────────────────────────────────
  addGasto: (g) => { set((s) => ({ gastos: [...s.gastos, g] })); db.gastos.insert(g).catch(console.error); },
  updateGasto: (id, p) => {
    set((s) => ({ gastos: s.gastos.map((x) => x.id === id ? { ...x, ...p } : x) }));
    const u = get().gastos.find((x) => x.id === id);
    if (u) db.gastos.upsert(u).catch(console.error);
  },
  deleteGasto: (id) => { set((s) => ({ gastos: s.gastos.filter((x) => x.id !== id) })); db.gastos.delete(id).catch(console.error); },

  // ── SUPLIDOS ──────────────────────────────────────────────────────────────
  addSuplido: (s) => { set((st) => ({ suplidos: [...st.suplidos, s] })); db.suplidos.insert(s).catch(console.error); },
  updateSuplido: (id, p) => {
    set((st) => ({ suplidos: st.suplidos.map((x) => x.id === id ? { ...x, ...p } : x) }));
    const u = get().suplidos.find((x) => x.id === id);
    if (u) db.suplidos.upsert(u).catch(console.error);
  },
  deleteSuplido: (id) => { set((st) => ({ suplidos: st.suplidos.filter((x) => x.id !== id) })); db.suplidos.delete(id).catch(console.error); },

  // ── FACTURAS ──────────────────────────────────────────────────────────────
  addFactura: (f) => { set((s) => ({ facturas: [...s.facturas, f] })); db.facturas.insert(f).catch(console.error); },
  updateFactura: (id, p) => {
    set((s) => ({ facturas: s.facturas.map((x) => x.id === id ? { ...x, ...p } : x) }));
    const u = get().facturas.find((x) => x.id === id);
    if (u) db.facturas.upsert(u).catch(console.error);
  },
  deleteFactura: (id) => { set((s) => ({ facturas: s.facturas.filter((x) => x.id !== id) })); db.facturas.delete(id).catch(console.error); },

  // ── EQUIPO ────────────────────────────────────────────────────────────────
  addEquipo: (e) => { set((s) => ({ equipo: [...s.equipo, e] })); db.equipo.insert(e).catch(console.error); },
  updateEquipo: (id, p) => {
    set((s) => ({ equipo: s.equipo.map((x) => x.id === id ? { ...x, ...p } : x) }));
    const u = get().equipo.find((x) => x.id === id);
    if (u) db.equipo.upsert(u).catch(console.error);
  },
  deleteEquipo: (id) => { set((s) => ({ equipo: s.equipo.filter((x) => x.id !== id) })); db.equipo.delete(id).catch(console.error); },

  // ── GASTOS EVENTO ─────────────────────────────────────────────────────────
  addGastoEvento: (g) => { set((s) => ({ gastosEvento: [...s.gastosEvento, g] })); db.gastosEvento.insert(g).catch(console.error); },
  updateGastoEvento: (id, p) => {
    set((s) => ({ gastosEvento: s.gastosEvento.map((x) => x.id === id ? { ...x, ...p } : x) }));
    const u = get().gastosEvento.find((x) => x.id === id);
    if (u) db.gastosEvento.upsert(u).catch(console.error);
  },
  deleteGastoEvento: (id) => { set((s) => ({ gastosEvento: s.gastosEvento.filter((x) => x.id !== id) })); db.gastosEvento.delete(id).catch(console.error); },

  // ── PAGOS EVENTO ──────────────────────────────────────────────────────────
  addPagoEvento: (p) => { set((s) => ({ pagosEvento: [...s.pagosEvento, p] })); db.pagosEvento.insert(p).catch(console.error); },
  updatePagoEvento: (id, pa) => {
    set((s) => ({ pagosEvento: s.pagosEvento.map((x) => x.id === id ? { ...x, ...pa } : x) }));
    const u = get().pagosEvento.find((x) => x.id === id);
    if (u) db.pagosEvento.upsert(u).catch(console.error);
  },
  deletePagoEvento: (id) => { set((s) => ({ pagosEvento: s.pagosEvento.filter((x) => x.id !== id) })); db.pagosEvento.delete(id).catch(console.error); },

  // ── DOCUMENTOS ────────────────────────────────────────────────────────────
  addDocumento: (d) => { set((s) => ({ documentos: [...s.documentos, d] })); db.documentos.insert(d).catch(console.error); },
  deleteDocumento: (id) => { set((s) => ({ documentos: s.documentos.filter((x) => x.id !== id) })); db.documentos.delete(id).catch(console.error); },

  // ── USUARIOS ──────────────────────────────────────────────────────────────
  addUsuario: (u) => { set((s) => ({ usuarios: [...s.usuarios, u] })); db.usuarios.insert(u).catch(console.error); },
  updateUsuario: (id, p) => {
    set((s) => ({ usuarios: s.usuarios.map((x) => x.id === id ? { ...x, ...p } : x) }));
    const u = get().usuarios.find((x) => x.id === id);
    if (u) db.usuarios.upsert(u).catch(console.error);
  },
  deleteUsuario: (id) => { set((s) => ({ usuarios: s.usuarios.filter((x) => x.id !== id) })); db.usuarios.delete(id).catch(console.error); },
}));
