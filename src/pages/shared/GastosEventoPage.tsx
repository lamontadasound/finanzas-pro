import {useSearchParams} from 'react-router-dom';
import {ingresoRentabilidad,gastoEventoSinIVA,gastoEventoConIVA} from '../../lib/ingresoRentabilidad';
import {ExpenseStatus} from '../../components/ui/ExpenseStatus';
import {EventExpenseVatFields} from '../../components/forms/EventExpenseVatFields';
import { EventExpensePaymentFields } from '../../components/forms/EventExpensePaymentFields';
import {eventCategoryOptions} from '../../lib/eventCategories';
import { EventCategoryField } from '../../components/forms/EventCategoryField';
import { useState, useMemo, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, Folder, ChevronLeft } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Area, GastoEvento, GastoEventoCategoria, PagadoPor, Suplido } from '../../types';
import type { LineaId } from '../../config/businessLines';
import { resolveLinea } from '../../config/resolveLinea';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const PAGADORES: PagadoPor[] = ['La Montada', 'Julia', 'Rodrigo', 'Julia y Rodrigo', 'Marco'];

interface Props {
  area: Area;
  /** Fase D: cuando se indica, además de `area` filtra por línea de negocio
   *  resuelta vía `resolveLinea` (compatibilidad mientras no exista la
   *  columna `linea_negocio` en Supabase). Así DJ y Real Madrid, que hoy
   *  comparten `area='dj'`, quedan completamente separados sin páginas
   *  duplicadas ni tocar los datos reales. */
  filterLinea?: LineaId;
  /** Título/singular a mostrar cuando se usa `filterLinea` con area='dj'
   *  (por defecto asumiría "DJ"/"actuación"). */
  tituloOverride?: string;
  singularOverride?: string;
}

const EMPTY = (ingresoId: string, area: Area): Partial<GastoEvento> => ({
  ingresoId, area, fecha: new Date().toISOString().slice(0, 10),
  concepto: '', categoria: 'DJ', estadoPago: 'pendiente', importe: 0, pagadoPor: 'La Montada',
});

const EMPTY_SUPLIDO = (ingresoId: string, area: Area): Partial<Suplido> => ({
  ingresoId, area, fecha: new Date().toISOString().slice(0, 10),
  concepto: '', importe: 0, estado: 'pendiente', cantidadRecuperada: 0,
  metodoPago: 'transferencia', justificante: false,
});

const suplidoPendiente = (s: Suplido) => Math.max(0, s.importe - (s.cantidadRecuperada ?? 0));

export const GastosEventoPage = ({ area, filterLinea, tituloOverride, singularOverride }: Props) => {
  const allIngresos     = useStore((s) => s.ingresos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const addGastoEvento    = useStore((s) => s.addGastoEvento);
  const updateGastoEvento = useStore((s) => s.updateGastoEvento);
  const deleteGastoEvento = useStore((s) => s.deleteGastoEvento);
  const allSuplidos    = useStore((s) => s.suplidos);
  const addSuplido      = useStore((s) => s.addSuplido);
  const updateSuplido   = useStore((s) => s.updateSuplido);
  const deleteSuplido   = useStore((s) => s.deleteSuplido);
  // Fase F: permiso real por línea (ver IngresosPage para el porqué).
  const permLinea = filterLinea ?? (area === 'montada' ? 'montada_sound' : 'dj');
  const canCreateLinea = useAuthStore((s) => s.canCreateLinea);
  const canEditLinea   = useAuthStore((s) => s.canEditLinea);
  const canDeleteLinea = useAuthStore((s) => s.canDeleteLinea);
  const canCreate = () => canCreateLinea(permLinea);
  const canEdit   = () => canEditLinea(permLinea);
  const canDelete = () => canDeleteLinea(permLinea);
  const showConfirm = useConfirmStore((s) => s.show);

  const titulo = tituloOverride ?? (area === 'montada' ? 'Gastos de eventos' : 'Gastos de actuación');
  const lineaLabel = tituloOverride ? (filterLinea === 'real_madrid' ? 'Real Madrid' : 'DJs') : (area === 'montada' ? 'La Montada Sound' : 'DJs');
  const singular = singularOverride ?? (area === 'montada' ? 'evento' : 'actuación');

  const ingresos = useMemo(
    () => allIngresos.filter((i) => i.area === area && (!filterLinea || resolveLinea({ id: i.id, area: i.area, tipoEvento: i.tipoEvento, lineaNegocio: i.lineaNegocio }) === filterLinea)),
    [allIngresos, area, filterLinea],
  );
  const ingresoIds = useMemo(() => new Set(ingresos.map((i) => i.id)), [ingresos]);
  const gastos = useMemo(
    () => allGastosEvento.filter((g) => g.area === area && ingresoIds.has(g.ingresoId)),
    [allGastosEvento, area, ingresoIds],
  );

  const ingresoDe = useCallback((id: string) => ingresos.find((x) => x.id === id), [ingresos]);

  const [search, setSearch] = useState('');
  const [searchParams]=useSearchParams();
  const [selectedIngresoId, setSelectedIngresoId] = useState<string | null>(()=>searchParams.get('ingreso'));
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GastoEvento | null>(null);
  const [form, setForm] = useState<Partial<GastoEvento>>({});
  const [filterCategoria, setFilterCategoria] = useState<GastoEventoCategoria | ''>('');

  const gastosFiltrados = useMemo(
    () => gastos.filter((g) => (!filterCategoria || g.categoria === filterCategoria)),
    [gastos, filterCategoria],
  );

  // ── Navegación por Año → Mes ──────────────────────────────────────────────
  const [selectedYear, setSelectedYear]   = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // ── Carpetas: una por actuación/ingreso que tiene gastos, agrupadas por la
  //    fecha de la actuación (ingreso.fechaEvento) ──────────────────────────
  const todasLasCarpetas = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    gastosFiltrados.forEach((g) => {
      const cur = map.get(g.ingresoId) ?? { total: 0, count: 0 };
      map.set(g.ingresoId, { total: cur.total + (g.baseImponible ?? (g.importe - (g.importeIVA ?? 0))), count: cur.count + 1 });
    });
    return Array.from(map.entries())
      .map(([ingresoId, data]) => ({ ingresoId, ...data, ingreso: ingresoDe(ingresoId) }))
      .filter((c): c is typeof c & { ingreso: NonNullable<typeof c.ingreso> } => !!c.ingreso);
  }, [gastosFiltrados, ingresoDe]);

  const anios = useMemo(() => {
    const map = new Map<number, { count: number; total: number }>();
    todasLasCarpetas.forEach((c) => {
      const y = new Date(c.ingreso.fechaEvento).getFullYear();
      const cur = map.get(y) ?? { count: 0, total: 0 };
      map.set(y, { count: cur.count + 1, total: cur.total + c.total });
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [todasLasCarpetas]);

  const mesesDelAnio = useMemo(() => {
    if (selectedYear == null) return [];
    const map = new Map<number, { count: number; total: number }>();
    todasLasCarpetas.filter((c) => new Date(c.ingreso.fechaEvento).getFullYear() === selectedYear).forEach((c) => {
      const m = new Date(c.ingreso.fechaEvento).getMonth();
      const cur = map.get(m) ?? { count: 0, total: 0 };
      map.set(m, { count: cur.count + 1, total: cur.total + c.total });
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [todasLasCarpetas, selectedYear]);

  const totalAnio = useMemo(() => {
    if (selectedYear == null) return 0;
    return todasLasCarpetas.filter((c) => new Date(c.ingreso.fechaEvento).getFullYear() === selectedYear).reduce((a, c) => a + c.total, 0);
  }, [todasLasCarpetas, selectedYear]);

  const totalMes = useMemo(() => {
    if (selectedYear == null || selectedMonth == null) return 0;
    return todasLasCarpetas.filter((c) => {
      const d = new Date(c.ingreso.fechaEvento);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    }).reduce((a, c) => a + c.total, 0);
  }, [todasLasCarpetas, selectedYear, selectedMonth]);

  const carpetas = useMemo(() => {
    if (selectedYear == null || selectedMonth == null) return [];
    return todasLasCarpetas
      .filter((c) => {
        const d = new Date(c.ingreso.fechaEvento);
        return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      })
      .filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return c.ingreso.concepto.toLowerCase().includes(q) || c.ingreso.cliente.toLowerCase().includes(q);
      })
      .sort((a, b) => b.ingreso.fechaEvento.localeCompare(a.ingreso.fechaEvento));
  }, [todasLasCarpetas, selectedYear, selectedMonth, search]);



  const carpetaActual = selectedIngresoId ? ingresoDe(selectedIngresoId) : null;
  const gastosCarpeta = useMemo(
    () => selectedIngresoId ? gastos.filter((g) => g.ingresoId === selectedIngresoId).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [],
    [gastos, selectedIngresoId],
  );
  const rentabilidadCarpeta=carpetaActual?ingresoRentabilidad(carpetaActual,gastosCarpeta):null;
  const totalGastosCarpeta=rentabilidadCarpeta?.coste??0;
  const beneficioCarpeta=rentabilidadCarpeta?.beneficio??0;

  // ── Suplidos de la actuación (solo DJs) ──────────────────────────────────
  const suplidosCarpeta = useMemo(
    () => selectedIngresoId ? allSuplidos.filter((s) => s.area === area && s.ingresoId === selectedIngresoId).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [],
    [allSuplidos, area, selectedIngresoId],
  );
  const totalAdelantadoCarpeta = suplidosCarpeta.reduce((a, s) => a + s.importe, 0);
  const totalRecuperadoCarpeta = suplidosCarpeta.reduce((a, s) => a + (s.cantidadRecuperada ?? 0), 0);
  const totalPendienteCarpeta  = suplidosCarpeta.reduce((a, s) => a + suplidoPendiente(s), 0);

  // "¿Tiene suplidos?" — oculta la sección hasta que se active o ya existan suplidos.
  const [suplidosActivados, setSuplidosActivados] = useState<Record<string, boolean>>({});
  const mostrarSuplidos = suplidosCarpeta.length > 0 || !!(selectedIngresoId && suplidosActivados[selectedIngresoId]);

  const [showSuplidoModal, setShowSuplidoModal] = useState(false);
  const [editingSuplido, setEditingSuplido] = useState<Suplido | null>(null);
  const [suplidoForm, setSuplidoForm] = useState<Partial<Suplido>>({});

  const openNewSuplido = () => {
    if (!selectedIngresoId) return;
    setEditingSuplido(null);
    setSuplidoForm(EMPTY_SUPLIDO(selectedIngresoId, area));
    setShowSuplidoModal(true);
  };
  const openEditSuplido = (s: Suplido) => { setEditingSuplido(s); setSuplidoForm({ ...s }); setShowSuplidoModal(true); };
  const closeSuplidoModal = () => { setShowSuplidoModal(false); setEditingSuplido(null); };

  const saveSuplido = async () => {
    if (!suplidoForm.concepto || !suplidoForm.ingresoId || (suplidoForm.importe ?? 0) <= 0) return;
    if (editingSuplido) {
      if (!await updateSuplido(editingSuplido.id, suplidoForm)) return;
    } else {
      if (!await addSuplido({ ...EMPTY_SUPLIDO(suplidoForm.ingresoId, area), ...suplidoForm, id: uid(), createdAt: new Date().toISOString() } as Suplido)) return;
    }
    closeSuplidoModal();
  };

  const openNew = (ingresoIdFijo?: string) => {
    const ingresoId = ingresoIdFijo ?? ingresos[0]?.id ?? '';
    setEditing(null);
    setForm(EMPTY(ingresoId, area));
    setShowModal(true);
  };
  const openEdit = (g: GastoEvento) => { setEditing(g); setForm({ ...g }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const save = async () => {
    if (!form.concepto || !form.ingresoId || (form.importe ?? 0) <= 0) return;
    if (editing) {
      if (!await updateGastoEvento(editing.id, form)) return;
    } else {
      if (!await addGastoEvento({ ...form, id: uid(), createdAt: new Date().toISOString() } as GastoEvento)) return;
    }
    closeModal();
  };

  if (ingresos.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
          
        </div>
        <div className="bg-white border border-gray-200 rounded-card p-10 text-center">
          <p className="text-gray-500 text-sm">Todavía no hay ingresos creados en esta área.</p>
          <p className="text-gray-400 text-xs mt-1">Crea primero un ingreso para poder vincularle gastos, o usa el botón "Añadir gasto" desde el propio listado de ingresos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {gastos.some(g=>g.baseImponible==null&&g.importeIVA==null)&&<p role="status" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Hay gastos antiguos sin desglose de IVA. Abre «Editar» para indicar base e IVA; hasta entonces los resúmenes de costes son provisionales.</p>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
        </div>
        {canCreate() && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => openNew()}>Nuevo gasto</Button>
        )}
      </div>

      {selectedIngresoId == null && (
        <>
          {/* Breadcrumb Año → Mes */}
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => { setSelectedYear(null); setSelectedMonth(null); }} className={`font-medium ${selectedYear == null ? 'text-gray-900' : 'text-gold-600 hover:text-gold-500'}`}>Años</button>
            {selectedYear != null && (
              <>
                <span className="text-gray-300">/</span>
                <button onClick={() => setSelectedMonth(null)} className={`font-medium ${selectedMonth == null ? 'text-gray-900' : 'text-gold-600 hover:text-gold-500'}`}>{selectedYear}</button>
              </>
            )}
            {selectedYear != null && selectedMonth != null && (
              <>
                <span className="text-gray-300">/</span>
                <span className="font-medium text-gray-900">{MESES_FULL[selectedMonth]}</span>
              </>
            )}
          </div>

          {/* Nivel 1: años */}
          {selectedYear == null && (
            anios.length === 0 ? (
              <p className="text-center py-16 text-gray-400 text-sm">Todavía no hay gastos registrados. Añádelos desde aquí o desde el botón "Añadir gasto" en cada ingreso.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {anios.map(([y, data]) => (
                  <button key={y} onClick={() => setSelectedYear(y)} className="bg-white border border-gray-200 rounded-card p-5 text-left hover:border-gold-400 hover:shadow-raised transition-all duration-220 ease-smooth">
                    <div className="flex items-center gap-2 mb-2"><Folder size={16} className="text-gold-500" /><span className="text-lg font-bold text-gray-900">{y}</span></div>
                    <p className="text-xs text-gray-500">{data.count} {singular}s con gastos</p>
                    <p className="text-sm font-semibold text-gray-700 mt-1">Total sin IVA: {fmt(data.total)}</p>
                  </button>
                ))}
              </div>
            )
          )}

          {/* Nivel 2: meses dentro del año */}
          {selectedYear != null && selectedMonth == null && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setSelectedYear(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a años</button>
                <p className="text-sm text-gray-600">Total sin IVA {selectedYear}: <span className="font-semibold text-gray-900">{fmt(totalAnio)}</span></p>
              </div>
              {mesesDelAnio.length === 0 ? (
                <p className="text-center py-16 text-gray-400 text-sm">Sin gastos en {selectedYear}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mesesDelAnio.map(([m, data]) => (
                    <button key={m} onClick={() => setSelectedMonth(m)} className="bg-white border border-gray-200 rounded-card p-5 text-left hover:border-gold-400 hover:shadow-raised transition-all duration-220 ease-smooth">
                      <div className="flex items-center gap-2 mb-2"><Folder size={16} className="text-gold-500" /><span className="font-bold text-gray-900">{MESES_FULL[m]}</span></div>
                      <p className="text-xs text-gray-500">{data.count} {singular}s con gastos</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">Total sin IVA: {fmt(data.total)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nivel 3: carpetas por actuación/evento dentro del mes */}
          {selectedYear != null && selectedMonth != null && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setSelectedMonth(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a meses</button>
                <p className="text-sm text-gray-600">Total sin IVA {MESES_FULL[selectedMonth]} {selectedYear}: <span className="font-semibold text-gray-900">{fmt(totalMes)}</span></p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Buscar ${singular} o cliente…`} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-gold-400" />
                </div>

                <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value as GastoEventoCategoria | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
                  <option value="">Todas las categorías</option>
                  {eventCategoryOptions(gastos.map(g=>g.categoria)).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>


              {carpetas.length === 0 ? (
                <p className="text-center py-16 text-gray-400 text-sm">Sin resultados</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {carpetas.map((c) => (
                    <button key={c.ingresoId} onClick={() => setSelectedIngresoId(c.ingresoId)} className="bg-white border border-gray-200 rounded-card p-5 text-left hover:border-gold-400 hover:shadow-raised transition-all duration-220 ease-smooth">
                      <div className="flex items-center gap-2 mb-2">
                        <Folder size={16} className="text-gold-500 flex-shrink-0" />
                        <span className="font-bold text-gray-900 truncate">{c.ingreso.concepto}</span>
                      </div>
                      <p className="text-xs text-gray-500">{c.ingreso.cliente} · {c.ingreso.fechaEvento}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{lineaLabel}</p>
                      <p className="text-sm font-semibold text-gray-700 mt-2">{c.count} gastos · Total sin IVA: {fmt(c.total)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Nivel 2: gastos dentro de la carpeta */}
      {selectedIngresoId!=null&&!carpetaActual&&<div className="rounded-xl bg-gray-50 p-5"><p>Este ingreso no está disponible en esta línea o con tus permisos.</p><button className="underline mt-3" onClick={()=>setSelectedIngresoId(null)}>Volver a gastos</button></div>}
      {selectedIngresoId != null && carpetaActual && (
        <div className="space-y-4">
          <button onClick={() => setSelectedIngresoId(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a {singular}s</button>

          <div className="bg-white border border-gray-200 rounded-card shadow-card p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
              <div className="min-w-0 break-words">
                <h2 className="text-lg font-bold text-gray-900">{carpetaActual.concepto}</h2>
                <p className="text-sm text-gray-500">{carpetaActual.cliente} · {carpetaActual.fechaEvento} · {lineaLabel}</p>
              </div>
              {canCreate() && (
                <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => openNew(selectedIngresoId)}>Añadir gasto</Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div><p className="text-xs text-gray-500">Total sin IVA</p><p className="font-semibold text-gray-900">{fmt(carpetaActual.baseImponible)}</p></div><div><p className="text-xs text-gray-500">Total con IVA</p><p className="font-semibold text-blue-700">{fmt(carpetaActual.total)}</p></div>
              <div><p className="text-xs text-gray-500">Gastos sin IVA</p><p className="font-semibold text-red-600">{fmt(totalGastosCarpeta)}</p></div>
              <div><p className="text-xs text-gray-500">Beneficio del evento</p><p className={`font-semibold ${beneficioCarpeta >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(beneficioCarpeta)}</p></div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Concepto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoría</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pagado por</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total sin IVA</th><th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total con IVA</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pagado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gastosCarpeta.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">Sin gastos registrados</td></tr>
                  ) : gastosCarpeta.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{g.concepto}</td>
                      <td className="px-4 py-3 text-gray-600">{g.categoria}</td>
                      <td className="px-4 py-3 text-gray-600">{g.pagadoPor ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{g.fecha}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{g.baseImponible==null&&g.importeIVA==null?<span className="text-amber-700 text-xs">Sin desglose</span>:fmt(gastoEventoSinIVA(g))}</td><td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmt(gastoEventoConIVA(g))}</td>
                      <td className="px-4 py-3 text-center">
                        <ExpenseStatus status={g.estadoPago}/>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {canEdit() && <button onClick={() => openEdit(g)} className="p-1.5 text-gray-400 hover:text-gold-500 hover:bg-gold-50 rounded-lg"><Edit2 size={13} /></button>}
                          {canDelete() && <button onClick={() => showConfirm('¿Eliminar este gasto?', () => deleteGastoEvento(g.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {area === 'dj' && filterLinea !== 'real_madrid' && (
            <div className="bg-white border border-gray-200 rounded-card shadow-card p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Suplidos</h3>
                <div>
                  <label className="label-form">¿Tiene suplidos?</label>
                  <select
                    value={mostrarSuplidos ? 'si' : 'no'}
                    onChange={(e) => {
                      if (!selectedIngresoId) return;
                      const activar = e.target.value === 'si';
                      setSuplidosActivados((prev) => ({ ...prev, [selectedIngresoId]: activar }));
                    }}
                    disabled={suplidosCarpeta.length > 0}
                    className="input-form"
                  >
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>
              </div>
              {mostrarSuplidos && (
                <>
                  <div className="flex justify-end">
                    {canCreate() && (
                      <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={openNewSuplido}>Añadir suplido</Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><p className="text-xs text-gray-500">Total adelantado</p><p className="font-semibold text-gray-900">{fmt(totalAdelantadoCarpeta)}</p></div>
                    <div><p className="text-xs text-gray-500">Total recuperado</p><p className="font-semibold text-emerald-700">{fmt(totalRecuperadoCarpeta)}</p></div>
                    <div><p className="text-xs text-gray-500">Total pendiente de recuperar</p><p className={`font-semibold ${totalPendienteCarpeta > 0 ? 'text-gold-700' : 'text-gray-800'}`}>{fmt(totalPendienteCarpeta)}</p></div>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-100 bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Concepto</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Adelantado</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Recuperado</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                          <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {suplidosCarpeta.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">Sin suplidos registrados</td></tr>
                        ) : suplidosCarpeta.map((s) => (
                          <tr key={s.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-800">{s.concepto}{s.observaciones && <p className="text-xs text-gray-400 font-normal">{s.observaciones}</p>}</td>
                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{s.fecha}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-800">{fmt(s.importe)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-600">{fmt(s.cantidadRecuperada ?? 0)}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">{fmt(suplidoPendiente(s))}</td>
                            <td className="px-4 py-2.5 text-center">
                              <Badge tone={s.estado === 'cobrado' ? 'success' : 'danger'}>{s.estado === 'cobrado' ? 'Recuperado' : 'Pendiente de recuperar'}</Badge>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1 justify-end">
                                {canEdit() && <button onClick={() => openEditSuplido(s)} className="p-1.5 text-gray-400 hover:text-gold-500 hover:bg-gold-50 rounded-lg"><Edit2 size={13} /></button>}
                                {canDelete() && <button onClick={() => showConfirm('¿Eliminar este suplido?', () => deleteSuplido(s.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-gray-400">Los suplidos son dinero adelantado por la empresa que el cliente devuelve — no cuentan como ingreso ni como gasto, ni afectan al beneficio de la actuación. </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar gasto' : 'Nuevo gasto'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-form">Ingreso relacionado *</label>
              <select value={form.ingresoId ?? ''} onChange={(e) => setForm((f) => ({ ...f, ingresoId: e.target.value }))} className="input-form">
                {ingresos.map((i) => <option key={i.id} value={i.id}>{i.concepto} · {i.cliente} · {i.fechaEvento}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label-form">Concepto *</label>
              <input value={form.concepto ?? ''} onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fecha</label>
              <input type="date" value={form.fecha ?? ''} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} className="input-form" />
            </div>
            <EventExpensePaymentFields value={form} onChange={patch => setForm(f => f ? {...f,...patch} : f)} />
              <div>
              <label className="label-form">Categoría</label>
              <EventCategoryField value={form.categoria} onChange={categoria => setForm(f => ({...f,categoria}))} />
            </div>
            <EventExpenseVatFields value={form} onChange={patch=>setForm(f=>({...f,...patch}))}/>

            <div>
              <label className="label-form">Pagado por</label>
              <select value={form.pagadoPor ?? 'La Montada'} onChange={(e) => setForm((f) => ({ ...f, pagadoPor: e.target.value as PagadoPor }))} className="input-form">
                {PAGADORES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button variant="primary" onClick={save} className="flex-1">{editing ? 'Guardar' : 'Añadir gasto'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showSuplidoModal} onClose={closeSuplidoModal} title={editingSuplido ? 'Editar suplido' : 'Nuevo suplido'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-form">Concepto *</label>
              <input value={suplidoForm.concepto ?? ''} onChange={(e) => setSuplidoForm((f) => ({ ...f, concepto: e.target.value }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Cantidad adelantada (€) *</label>
              <input type="number" step="0.01" value={suplidoForm.importe ?? 0} onChange={(e) => setSuplidoForm((f) => ({ ...f, importe: parseFloat(e.target.value) || 0 }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fecha del adelanto</label>
              <input type="date" value={suplidoForm.fecha ?? ''} onChange={(e) => setSuplidoForm((f) => ({ ...f, fecha: e.target.value }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Estado</label>
              <select value={suplidoForm.estado ?? 'pendiente'} onChange={(e) => setSuplidoForm((f) => ({ ...f, estado: e.target.value as Suplido['estado'] }))} className="input-form">
                <option value="pendiente">Pendiente de recuperar</option>
                <option value="cobrado">Recuperado</option>
              </select>
            </div>
            <div>
              <label className="label-form">Cantidad recuperada (€)</label>
              <input type="number" step="0.01" value={suplidoForm.cantidadRecuperada ?? 0} onChange={(e) => setSuplidoForm((f) => ({ ...f, cantidadRecuperada: parseFloat(e.target.value) || 0 }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fecha de recuperación</label>
              <input type="date" value={suplidoForm.fechaCobro ?? ''} onChange={(e) => setSuplidoForm((f) => ({ ...f, fechaCobro: e.target.value }))} className="input-form" />
            </div>
            <div className="col-span-2">
              <label className="label-form">Suplido pendiente</label>
              <div className="input-form bg-gray-50 text-gray-700 font-semibold">{fmt(Math.max(0, (suplidoForm.importe ?? 0) - (suplidoForm.cantidadRecuperada ?? 0)))}</div>
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Este suplido no se sumará como ingreso ni como gasto de la actuación — solo se usa para controlar dinero pendiente de recuperar. </p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeSuplidoModal} className="flex-1">Cancelar</Button>
            <Button variant="primary" onClick={saveSuplido} className="flex-1">{editingSuplido ? 'Guardar' : 'Añadir suplido'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
