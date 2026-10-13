import {normalizeEventCategory} from '../lib/eventCategories';
import { create } from 'zustand';
import type { AppState } from '../types';
import { db } from '../lib/db';
import { useAuthStore } from './useAuthStore';

export const useStore = create<AppState>()((set, get) => ({

  eventos: [], ingresos: [], gastos: [], suplidos: [], facturas: [],
  equipo: [], gastosEvento: [], pagosEvento: [], documentos: [], usuarios: [],
  socios: [], movimientosSocios: [], impuestos: [],
  clientes: [], emisores: [], proyectoEmisorMap: {}, permisosFacturacion: {},
  _loaded: false, _error: null, _saveError: null,

  // ── Carga inicial ─────────────────────────────────────────────────────────
  initData: async () => {
    const auth = useAuthStore.getState();
    const profile = auth.profile;
    if (!profile?.activo) return;
    set({_loaded:false,_error:null});
    try {
      const [eventos, ingresos, gastos, suplidos, facturas, equipo, gastosEvento, pagosEvento, documentos, usuarios] =
        await Promise.all([
          db.eventos.getAll(), db.ingresos.getAll(), db.gastos.getAll(),
          db.suplidos.getAll(), db.facturas.getAll(), db.equipo.getAll(),
          db.gastosEvento.getAll(), db.pagosEvento.getAll(),
          db.documentos.getAll(), auth.isAdmin() ? db.profiles.getAll() : Promise.resolve([]),
        ]);
      // Las tablas requeridas deben existir: los errores no se convierten en datos vacíos.
      const [socios, movimientosSocios, impuestos, clientes, emisores, proyectoEmisorRows, permisosFacturacion] = await Promise.all([
        (auth.canViewLinea('montada_sound') || auth.canViewLinea('montada_installations')) ? db.socios.getAll() : Promise.resolve([]),
        (auth.canViewLinea('montada_sound') || auth.canViewLinea('montada_installations')) ? db.movimientosSocios.getAll() : Promise.resolve([]),
        auth.canViewModulo('impuestos') ? db.impuestos.getAll() : Promise.resolve([]),
        (auth.canViewModulo('contabilidad') || auth.canEmitirFacturas()) ? db.clientes.getAll() : Promise.resolve([]),
        db.emisores.getAll(),
        db.proyectoEmisor.getAll(),
        auth.isAdmin() ? db.permisosFacturacion.getAll() : Promise.resolve({}),
      ]);
      const proyectoEmisorMap = Object.fromEntries(proyectoEmisorRows.map((r) => [r.lineaId, r.emisorId]));
      if (useAuthStore.getState().profile !== profile) return;
      set({ eventos, ingresos, gastos, suplidos, facturas, equipo, gastosEvento, pagosEvento, documentos, usuarios, socios, movimientosSocios, impuestos, clientes, emisores, proyectoEmisorMap, permisosFacturacion, _loaded: true, _error: null });
    } catch (err) {
      if (useAuthStore.getState().profile !== profile) return;
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Store] Error al cargar datos:', msg);
      set({ _loaded: true, _error: msg });
    }
  },

  // ── EVENTOS ───────────────────────────────────────────────────────────────
  addEvento: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.eventos.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ eventos: [...state.eventos, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateEvento: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().eventos.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      await db.eventos.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ eventos: state.eventos.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteEvento: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.eventos.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ eventos: state.eventos.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── INGRESOS ─────────────────────────────────────────────────────────────
  addIngreso: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.ingresos.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ ingresos: [...state.ingresos, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateIngreso: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().ingresos.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      await db.ingresos.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ ingresos: state.ingresos.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteIngreso: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.ingresos.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ ingresos: state.ingresos.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── GASTOS ────────────────────────────────────────────────────────────────
  addGasto: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.gastos.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ gastos: [...state.gastos, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateGasto: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().gastos.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      await db.gastos.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ gastos: state.gastos.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteGasto: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.gastos.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ gastos: state.gastos.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── SUPLIDOS ──────────────────────────────────────────────────────────────
  addSuplido: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.suplidos.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ suplidos: [...state.suplidos, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateSuplido: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().suplidos.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      await db.suplidos.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ suplidos: state.suplidos.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteSuplido: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.suplidos.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ suplidos: state.suplidos.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── FACTURAS ──────────────────────────────────────────────────────────────
  addFactura: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.facturas.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ facturas: [...state.facturas, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateFactura: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().facturas.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); let item={...current,...patch};
      if (current.numeroSecuencial != null) {
        if (Object.keys(patch).some(k => !['pagada','pagosRecibidos','fechaPago','enviada'].includes(k))) throw new Error('Una factura emitida se modifica mediante rectificación.');
        item = await db.facturas.updatePayment(id, patch);
      } else { await db.facturas.upsert(item); }
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ facturas: state.facturas.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteFactura: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.facturas.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ facturas: state.facturas.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── EQUIPO ────────────────────────────────────────────────────────────────
  // A diferencia del resto de entidades, aquí SÍ esperamos la confirmación
  // real de Supabase antes de tocar el estado local: este flujo llevaba
  // fallando en silencio (columnas que no existían en la tabla) y el
  // usuario veía el equipo "guardado" solo hasta la siguiente recarga.
  addEquipo: async (e) => {
    const sessionProfile=useAuthStore.getState().profile;
    try {
      await db.equipo.insert(e);
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'No se pudo guardar el equipo.' };
    }
    if(useAuthStore.getState().profile!==sessionProfile)return {success:false,message:'La sesión ha cambiado.'};
    set((s) => ({ equipo: [...s.equipo, e] }));
    return { success: true, message: 'Equipo guardado correctamente.' };
  },
  updateEquipo: async (id, p) => {
    const sessionProfile=useAuthStore.getState().profile;
    const current = get().equipo.find((x) => x.id === id);
    if (!current) return { success: false, message: 'El equipo ya no existe.' };
    const updated = { ...current, ...p };
    try {
      await db.equipo.upsert(updated);
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'No se pudieron guardar los cambios.' };
    }
    if(useAuthStore.getState().profile!==sessionProfile)return {success:false,message:'La sesión ha cambiado.'};
    set((s) => ({ equipo: s.equipo.map((x) => x.id === id ? updated : x) }));
    return { success: true, message: 'Cambios guardados correctamente.' };
  },
  deleteEquipo: async (id) => {
    const sessionProfile=useAuthStore.getState().profile;
    try {
      await db.equipo.delete(id);
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'No se pudo eliminar el equipo.' };
    }
    if(useAuthStore.getState().profile!==sessionProfile)return {success:false,message:'La sesión ha cambiado.'};
    set((s) => ({ equipo: s.equipo.filter((x) => x.id !== id) }));
    return { success: true, message: 'Equipo eliminado correctamente.' };
  },

  // ── GASTOS EVENTO ─────────────────────────────────────────────────────────
  addGastoEvento: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      item={...item,categoria:normalizeEventCategory(item.categoria)};
      await db.gastosEvento.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ gastosEvento: [...state.gastosEvento, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateGastoEvento: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().gastosEvento.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      item.categoria=normalizeEventCategory(item.categoria);
      await db.gastosEvento.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ gastosEvento: state.gastosEvento.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteGastoEvento: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.gastosEvento.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ gastosEvento: state.gastosEvento.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── PAGOS EVENTO ──────────────────────────────────────────────────────────
  addPagoEvento: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.pagosEvento.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ pagosEvento: [...state.pagosEvento, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updatePagoEvento: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().pagosEvento.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      await db.pagosEvento.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ pagosEvento: state.pagosEvento.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deletePagoEvento: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.pagosEvento.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ pagosEvento: state.pagosEvento.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── DOCUMENTOS ────────────────────────────────────────────────────────────
  addDocumento: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.documentos.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ documentos: [...state.documentos, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteDocumento: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.documentos.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ documentos: state.documentos.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── USUARIOS ──────────────────────────────────────────────────────────────
  addUsuario: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.usuarios.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ usuarios: [...state.usuarios, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateUsuario: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().usuarios.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      await db.usuarios.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ usuarios: state.usuarios.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteUsuario: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.usuarios.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ usuarios: state.usuarios.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── SOCIOS ────────────────────────────────────────────────────────────────
  addSocio: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.socios.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ socios: [...state.socios, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateSocio: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().socios.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      await db.socios.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ socios: state.socios.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteSocio: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.socios.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ socios: state.socios.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── MOVIMIENTOS SOCIOS ────────────────────────────────────────────────────
  addMovimientoSocio: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.movimientosSocios.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ movimientosSocios: [...state.movimientosSocios, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateMovimientoSocio: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().movimientosSocios.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      await db.movimientosSocios.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ movimientosSocios: state.movimientosSocios.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteMovimientoSocio: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.movimientosSocios.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ movimientosSocios: state.movimientosSocios.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── IMPUESTOS ─────────────────────────────────────────────────────────────
  addImpuesto: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.impuestos.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ impuestos: [...state.impuestos, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateImpuesto: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().impuestos.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      await db.impuestos.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ impuestos: state.impuestos.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteImpuesto: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.impuestos.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ impuestos: state.impuestos.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── CLIENTES (Fase H) ────────────────────────────────────────────────────
  addCliente: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.clientes.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ clientes: [...state.clientes, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateCliente: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().clientes.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      await db.clientes.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ clientes: state.clientes.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteCliente: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.clientes.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ clientes: state.clientes.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },

  // ── EMISORES FISCALES (Fase H) — lista, admin-only en la UI ──────────────
  addEmisor: async (item) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.emisores.insert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ emisores: [...state.emisores, item] }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  updateEmisor: async (id, patch) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      const current=get().emisores.find(x=>x.id===id); if(!current) throw new Error('El registro ya no está disponible.'); const item={...current,...patch};
      await db.emisores.upsert(item);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ emisores: state.emisores.map(x=>x.id===id ? item : x) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  deleteEmisor: async (id) => {
    try {
      const sessionProfile = useAuthStore.getState().profile;
      
      await db.emisores.delete(id);
      if (useAuthStore.getState().profile !== sessionProfile) return false;
      set(state => ({ ...({ emisores: state.emisores.filter(x=>x.id!==id) }), _saveError: null }));
      return true;
    } catch(error) { set({ _saveError: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' }); return false; }
  },
  setProyectoEmisor: async (lineaId, emisorId) => {
    try { await db.proyectoEmisor.set(lineaId, emisorId); set(st => ({proyectoEmisorMap:{...st.proyectoEmisorMap,[lineaId]:emisorId},_saveError:null})); return true; }
    catch(e) {set({_saveError:e instanceof Error?e.message:'No se pudo guardar la asignación.'});return false;}
  },
  setPermisosFacturacion: async (userId, p) => {
    try {await db.permisosFacturacion.set(userId,p);set(st=>({permisosFacturacion:{...st.permisosFacturacion,[userId]:p},_saveError:null}));return true;}
    catch(e){set({_saveError:e instanceof Error?e.message:'No se pudieron guardar los permisos.'});return false;}
  },

}));

// Clear all financial rows on account/session change. Late responses are ignored above.
useAuthStore.subscribe((next, previous) => {
  if (next.profile !== previous.profile) {
    useStore.setState({eventos:[],ingresos:[],gastos:[],suplidos:[],facturas:[],equipo:[],gastosEvento:[],pagosEvento:[],documentos:[],usuarios:[],socios:[],movimientosSocios:[],impuestos:[],clientes:[],emisores:[],proyectoEmisorMap:{},permisosFacturacion:{},_loaded:false,_error:null,_saveError:null});
  }
});
