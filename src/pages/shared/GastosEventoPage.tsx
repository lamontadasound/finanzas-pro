import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Folder, ChevronLeft, Check } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Area, GastoEvento, GastoEventoCategoria, GastoTipo, PagadoPor, Suplido } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const CAT_GASTO_EVENTO: GastoEventoCategoria[] = ['Cámara', 'DJ', 'Montador', 'Técnico', 'Decoración', 'Gasolina', 'Transporte', 'Personal', 'Alquiler', 'Proveedor', 'Otro'];
const TIPOS_GASTO: GastoTipo[] = ['fijo', 'variable'];
const PAGADORES: PagadoPor[] = ['La Montada', 'Julia', 'Rodrigo', 'Julia y Rodrigo', 'Marco'];

interface Props { area: Area }

const EMPTY = (ingresoId: string, area: Area): Partial<GastoEvento> => ({
  ingresoId, area, fecha: new Date().toISOString().slice(0, 10),
  concepto: '', categoria: 'Otro', tipo: 'variable', importe: 0, pagadoPor: 'La Montada',
});

const EMPTY_SUPLIDO = (ingresoId: string, area: Area): Partial<Suplido> => ({
  ingresoId, area, fecha: new Date().toISOString().slice(0, 10),
  concepto: '', importe: 0, estado: 'pendiente', cantidadRecuperada: 0,
  metodoPago: 'transferencia', justificante: false,
});

const suplidoPendiente = (s: Suplido) => Math.max(0, s.importe - (s.cantidadRecuperada ?? 0));

export const GastosEventoPage = ({ area }: Props) => {
  const allIngresos     = useStore((s) => s.ingresos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const addGastoEvento    = useStore((s) => s.addGastoEvento);
  const updateGastoEvento = useStore((s) => s.updateGastoEvento);
  const deleteGastoEvento = useStore((s) => s.deleteGastoEvento);
  const allSuplidos    = useStore((s) => s.suplidos);
  const addSuplido      = useStore((s) => s.addSuplido);
  const updateSuplido   = useStore((s) => s.updateSuplido);
  const deleteSuplido   = useStore((s) => s.deleteSuplido);
  const canCreate = useAuthStore((s) => s.canCreate);
  const canEdit   = useAuthStore((s) => s.canEdit);
  const canDelete = useAuthStore((s) => s.canDelete);
  const showConfirm = useConfirmStore((s) => s.show);

  const titulo = area === 'montada' ? 'Gastos de eventos' : 'Gastos de actuación';
  const singular = area === 'montada' ? 'evento' : 'actuación';

  const ingresos = useMemo(() => allIngresos.filter((i) => i.area === area), [allIngresos, area]);
  const ingresoIds = useMemo(() => new Set(ingresos.map((i) => i.id)), [ingresos]);
  const gastos = useMemo(
    () => allGastosEvento.filter((g) => g.area === area && ingresoIds.has(g.ingresoId)),
    [allGastosEvento, area, ingresoIds],
  );

  const ingresoDe = (id: string) => ingresos.find((x) => x.id === id);

  const [search, setSearch] = useState('');
  const [selectedIngresoId, setSelectedIngresoId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GastoEvento | null>(null);
  const [form, setForm] = useState<Partial<GastoEvento>>({});
  const [filterTipo, setFilterTipo] = useState<GastoTipo | ''>('');
  const [filterCategoria, setFilterCategoria] = useState<GastoEventoCategoria | ''>('');

  const gastosFiltrados = useMemo(
    () => gastos.filter((g) => (!filterTipo || g.tipo === filterTipo) && (!filterCategoria || g.categoria === filterCategoria)),
    [gastos, filterTipo, filterCategoria],
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
      map.set(g.ingresoId, { total: cur.total + g.importe, count: cur.count + 1 });
    });
    return Array.from(map.entries())
      .map(([ingresoId, data]) => ({ ingresoId, ...data, ingreso: ingresoDe(ingresoId) }))
      .filter((c): c is typeof c & { ingreso: NonNullable<typeof c.ingreso> } => !!c.ingreso);
  }, [gastosFiltrados, ingresos]);

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

  const totalGeneral = gastos.reduce((a, g) => a + g.importe, 0);

  const carpetaActual = selectedIngresoId ? ingresoDe(selectedIngresoId) : null;
  const gastosCarpeta = useMemo(
    () => selectedIngresoId ? gastos.filter((g) => g.ingresoId === selectedIngresoId).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [],
    [gastos, selectedIngresoId],
  );
  const totalGastosCarpeta = gastosCarpeta.reduce((a, g) => a + g.importe, 0);
  const beneficioCarpeta = carpetaActual ? carpetaActual.baseImponible - totalGastosCarpeta : 0;

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

  const saveSuplido = () => {
    if (!suplidoForm.concepto || !suplidoForm.ingresoId || (suplidoForm.importe ?? 0) <= 0) return;
    if (editingSuplido) {
      updateSuplido(editingSuplido.id, suplidoForm);
    } else {
      addSuplido({ ...EMPTY_SUPLIDO(suplidoForm.ingresoId, area), ...suplidoForm, id: uid(), createdAt: new Date().toISOString() } as Suplido);
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

  const save = () => {
    if (!form.concepto || !form.ingresoId || (form.importe ?? 0) <= 0) return;
    if (editing) {
      updateGastoEvento(editing.id, form);
    } else {
      addGastoEvento({ ...form, id: uid(), createdAt: new Date().toISOString() } as GastoEvento);
    }
    closeModal();
  };

  if (ingresos.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
          <p className="text-sm text-gray-500">Costes directos vinculados a un ingreso</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <p className="text-gray-500 text-sm">Todavía no hay ingresos creados en esta área.</p>
          <p className="text-gray-400 text-xs mt-1">Crea primero un ingreso para poder vincularle gastos, o usa el botón "Añadir gasto" desde el propio listado de ingresos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
          <p className="text-sm text-gray-500">{todasLasCarpetas.length} {singular}s con gastos · Total: {fmt(totalGeneral)}</p>
        </div>
        {canCreate(area) && (
          <button onClick={() => openNew()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors">
            <Plus size={16} /> Nuevo gasto
          </button>
        )}
      </div>

      {selectedIngresoId == null && (
        <>
          {/* Breadcrumb Año → Mes */}
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => { setSelectedYear(null); setSelectedMonth(null); }} className={`font-medium ${selectedYear == null ? 'text-gray-900' : 'text-amber-600 hover:text-amber-500'}`}>Años</button>
            {selectedYear != null && (
              <>
                <span className="text-gray-300">/</span>
                <button onClick={() => setSelectedMonth(null)} className={`font-medium ${selectedMonth == null ? 'text-gray-900' : 'text-amber-600 hover:text-amber-500'}`}>{selectedYear}</button>
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
                  <button key={y} onClick={() => setSelectedYear(y)} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-2 mb-2"><Folder size={16} className="text-amber-500" /><span className="text-lg font-bold text-gray-900">{y}</span></div>
                    <p className="text-xs text-gray-500">{data.count} {singular}s con gastos</p>
                    <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
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
                <p className="text-sm text-gray-600">Total {selectedYear}: <span className="font-semibold text-gray-900">{fmt(totalAnio)}</span></p>
              </div>
              {mesesDelAnio.length === 0 ? (
                <p className="text-center py-16 text-gray-400 text-sm">Sin gastos en {selectedYear}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mesesDelAnio.map(([m, data]) => (
                    <button key={m} onClick={() => setSelectedMonth(m)} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-2 mb-2"><Folder size={16} className="text-amber-500" /><span className="font-bold text-gray-900">{MESES_FULL[m]}</span></div>
                      <p className="text-xs text-gray-500">{data.count} {singular}s con gastos</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
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
                <p className="text-sm text-gray-600">Total {MESES_FULL[selectedMonth]} {selectedYear}: <span className="font-semibold text-gray-900">{fmt(totalMes)}</span></p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Buscar ${singular} o cliente…`} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-amber-400" />
                </div>
                <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value as GastoTipo | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
                  <option value="">Todos los tipos</option>
                  <option value="fijo">Fijo</option>
                  <option value="variable">Variable</option>
                </select>
                <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value as GastoEventoCategoria | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
                  <option value="">Todas las categorías</option>
                  {CAT_GASTO_EVENTO.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {(filterTipo || filterCategoria) && (
                <p className="text-[11px] text-gray-400">Filtro aplicado sobre Tipo/Categoría — nota: no se puede filtrar de forma fiable en datos ya guardados hasta aplicar la migración pendiente (el tipo se guarda solo en esta sesión).</p>
              )}

              {carpetas.length === 0 ? (
                <p className="text-center py-16 text-gray-400 text-sm">Sin resultados</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {carpetas.map((c) => (
                    <button key={c.ingresoId} onClick={() => setSelectedIngresoId(c.ingresoId)} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Folder size={16} className="text-amber-500 flex-shrink-0" />
                        <span className="font-bold text-gray-900 truncate">{c.ingreso.concepto}</span>
                      </div>
                      <p className="text-xs text-gray-500">{c.ingreso.cliente} · {c.ingreso.fechaEvento}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{area === 'montada' ? 'La Montada Sound' : 'DJs'}</p>
                      <p className="text-sm font-semibold text-gray-700 mt-2">{c.count} gastos · {fmt(c.total)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Nivel 2: gastos dentro de la carpeta */}
      {selectedIngresoId != null && carpetaActual && (
        <div className="space-y-4">
          <button onClick={() => setSelectedIngresoId(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a {singular}s</button>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{carpetaActual.concepto}</h2>
                <p className="text-sm text-gray-500">{carpetaActual.cliente} · {carpetaActual.fechaEvento} · {area === 'montada' ? 'La Montada Sound' : 'DJs'}</p>
              </div>
              {canCreate(area) && (
                <button onClick={() => openNew(selectedIngresoId)} className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-black text-xs font-semibold rounded-lg hover:bg-amber-400 transition-colors">
                  <Plus size={14} /> Añadir gasto
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div><p className="text-xs text-gray-500">Total ingresado</p><p className="font-semibold text-gray-900">{fmt(carpetaActual.total)}</p></div>
              <div><p className="text-xs text-gray-500">Total gastos</p><p className="font-semibold text-red-600">{fmt(totalGastosCarpeta)}</p></div>
              <div><p className="text-xs text-gray-500">Beneficio real</p><p className={`font-semibold ${beneficioCarpeta >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(beneficioCarpeta)}</p></div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Concepto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoría</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pagado por</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Importe</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Justificante</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Observaciones</th>
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
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmt(g.importe)}</td>
                      <td className="px-4 py-3 text-center">
                        {g.facturaRecibida ? <Check size={14} className="text-green-600 mx-auto" /> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{g.observaciones || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {canEdit(area) && <button onClick={() => openEdit(g)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                          {canDelete(area) && <button onClick={() => showConfirm('¿Eliminar este gasto?', () => deleteGastoEvento(g.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {area === 'dj' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
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
                    {canCreate(area) && (
                      <button onClick={openNewSuplido} className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-black text-xs font-semibold rounded-lg hover:bg-amber-400 transition-colors">
                        <Plus size={14} /> Añadir suplido
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><p className="text-xs text-gray-500">Total adelantado</p><p className="font-semibold text-gray-900">{fmt(totalAdelantadoCarpeta)}</p></div>
                    <div><p className="text-xs text-gray-500">Total recuperado</p><p className="font-semibold text-green-700">{fmt(totalRecuperadoCarpeta)}</p></div>
                    <div><p className="text-xs text-gray-500">Total pendiente de recuperar</p><p className={`font-semibold ${totalPendienteCarpeta > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{fmt(totalPendienteCarpeta)}</p></div>
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
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.estado === 'cobrado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{s.estado === 'cobrado' ? 'Recuperado' : 'Pendiente de recuperar'}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1 justify-end">
                                {canEdit(area) && <button onClick={() => openEditSuplido(s)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                                {canDelete(area) && <button onClick={() => showConfirm('¿Eliminar este suplido?', () => deleteSuplido(s.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-gray-400">Los suplidos son dinero adelantado por la empresa que el cliente devuelve — no cuentan como ingreso ni como gasto, ni afectan al beneficio de la actuación. Pendiente de migración para persistir de forma permanente.</p>
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
            <div>
              <label className="label-form">Categoría</label>
              <select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as GastoEventoCategoria }))} className="input-form">
                {CAT_GASTO_EVENTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Importe (€) *</label>
              <input type="number" step="0.01" value={form.importe ?? 0} onChange={(e) => setForm((f) => ({ ...f, importe: parseFloat(e.target.value) || 0 }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Tipo de gasto</label>
              <select value={form.tipo ?? 'variable'} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as GastoTipo }))} className="input-form">
                {TIPOS_GASTO.map((t) => <option key={t} value={t}>{t === 'fijo' ? 'Fijo' : 'Variable'}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Pendiente de migración para persistir.</p>
            </div>
            <div>
              <label className="label-form">Pagado por</label>
              <select value={form.pagadoPor ?? 'La Montada'} onChange={(e) => setForm((f) => ({ ...f, pagadoPor: e.target.value as PagadoPor }))} className="input-form">
                {PAGADORES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Pendiente de migración para persistir.</p>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.facturaRecibida} onChange={(e) => setForm((f) => ({ ...f, facturaRecibida: e.target.checked }))} className="rounded" />
                Factura / justificante recibido
              </label>
            </div>
            <div className="col-span-2">
              <label className="label-form">Observaciones</label>
              <textarea value={form.observaciones ?? ''} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))} rows={2} className="input-form" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editing ? 'Guardar' : 'Añadir gasto'}</button>
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
            <div className="col-span-2">
              <label className="label-form">Observaciones</label>
              <textarea value={suplidoForm.observaciones ?? ''} onChange={(e) => setSuplidoForm((f) => ({ ...f, observaciones: e.target.value }))} rows={2} className="input-form" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Este suplido no se sumará como ingreso ni como gasto de la actuación — solo se usa para controlar dinero pendiente de recuperar. Pendiente de migración para persistir de forma permanente.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={closeSuplidoModal} className="flex-1 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={saveSuplido} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editingSuplido ? 'Guardar' : 'Añadir suplido'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
