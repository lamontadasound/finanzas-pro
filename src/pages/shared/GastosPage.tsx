import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Folder, ChevronLeft } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Area, Gasto, GastoCategoria, GastoTipo, PagadoPor, PaymentMethod } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const CATEGORIAS_GASTO: GastoCategoria[] = ['Impuestos', 'Gestoría', 'Marketing', 'RRSS', 'Software', 'Personal', 'Material', 'Equipo'];
const TIPOS_GASTO: GastoTipo[] = ['fijo', 'variable'];
const PAGADORES: PagadoPor[] = ['La Montada', 'Julia', 'Rodrigo', 'Julia y Rodrigo', 'Marco'];
const METODOS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'bizum', 'otro'];
const PCTS_IVA = [0, 10, 21];
const PERIODICIDADES = ['Ocasional', 'Mensual', 'Trimestral', 'Anual'] as const;
type Periodicidad = typeof PERIODICIDADES[number];

interface Props { area: Area }

const EMPTY = (area: Area): Partial<Gasto> => ({
  area, fecha: new Date().toISOString().slice(0, 10),
  concepto: '', categoria: 'Personal', tipo: 'variable', pagadoPor: 'La Montada',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  metodoPago: 'transferencia', estadoPago: 'pagado',
  facturaRecibida: false, deducible: true,
});

// ── Generación de repeticiones futuras, evitando duplicados ──────────────────
// El horizonte de generación cubre 1 año natural desde la fecha inicial.
const sumarPeriodo = (fecha: Date, periodicidad: Periodicidad, n: number): Date => {
  const d = new Date(fecha);
  if (periodicidad === 'Mensual') d.setMonth(d.getMonth() + n);
  if (periodicidad === 'Trimestral') d.setMonth(d.getMonth() + n * 3);
  if (periodicidad === 'Anual') d.setFullYear(d.getFullYear() + n);
  return d;
};

const numeroRepeticiones = (periodicidad: Periodicidad): number => {
  if (periodicidad === 'Mensual') return 11;    // 12 meses en total con el original
  if (periodicidad === 'Trimestral') return 3;  // 4 trimestres en total
  if (periodicidad === 'Anual') return 2;       // 3 años en total
  return 0;
};

export const GastosPage = ({ area }: Props) => {
  const allGastos  = useStore((s) => s.gastos);
  const gastos     = useMemo(() => allGastos.filter((g) => g.area === area), [allGastos, area]);
  const addGasto   = useStore((s) => s.addGasto);
  const updateGasto = useStore((s) => s.updateGasto);
  const deleteGasto = useStore((s) => s.deleteGasto);
  const canCreate  = useAuthStore((s) => s.canCreate);
  const canEdit    = useAuthStore((s) => s.canEdit);
  const canDelete  = useAuthStore((s) => s.canDelete);
  const showConfirm = useConfirmStore((s) => s.show);

  const [search, setSearch]       = useState('');
  const [filterCat, setFilterCat] = useState<GastoCategoria | ''>('');
  const [filterTipo, setFilterTipo] = useState<GastoTipo | ''>('');
  const [filterPeriodicidad, setFilterPeriodicidad] = useState<string>('');
  const [filterPagadoPor, setFilterPagadoPor] = useState<PagadoPor | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Gasto | null>(null);
  const [form, setForm]           = useState<Partial<Gasto>>(EMPTY(area));
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('Ocasional');

  // ── Navegación por Año → Mes (carpetas) ──────────────────────────────────
  const [selectedYear, setSelectedYear]   = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const anios = useMemo(() => {
    const map = new Map<number, { count: number; total: number }>();
    gastos.forEach((g) => {
      const y = new Date(g.fecha).getFullYear();
      const cur = map.get(y) ?? { count: 0, total: 0 };
      map.set(y, { count: cur.count + 1, total: cur.total + g.total });
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [gastos]);

  const mesesDelAnio = useMemo(() => {
    if (selectedYear == null) return [];
    const map = new Map<number, { count: number; total: number }>();
    gastos.filter((g) => new Date(g.fecha).getFullYear() === selectedYear).forEach((g) => {
      const m = new Date(g.fecha).getMonth();
      const cur = map.get(m) ?? { count: 0, total: 0 };
      map.set(m, { count: cur.count + 1, total: cur.total + g.total });
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [gastos, selectedYear]);

  const totalAnio = useMemo(() => {
    if (selectedYear == null) return 0;
    return gastos.filter((g) => new Date(g.fecha).getFullYear() === selectedYear).reduce((a, g) => a + g.total, 0);
  }, [gastos, selectedYear]);

  const totalMes = useMemo(() => {
    if (selectedYear == null || selectedMonth == null) return 0;
    return gastos.filter((g) => {
      const d = new Date(g.fecha);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    }).reduce((a, g) => a + g.total, 0);
  }, [gastos, selectedYear, selectedMonth]);

  const enElMes = useMemo(() => {
    if (selectedYear == null || selectedMonth == null) return [];
    return gastos.filter((g) => {
      const d = new Date(g.fecha);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [gastos, selectedYear, selectedMonth]);

  const filtered = useMemo(() => {
    let list = [...enElMes];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.concepto.toLowerCase().includes(q) || (g.proveedor ?? '').toLowerCase().includes(q));
    }
    if (filterCat) list = list.filter((g) => g.categoria === filterCat);
    if (filterTipo) list = list.filter((g) => g.tipo === filterTipo);
    if (filterPeriodicidad) list = list.filter((g) => (g.periodicidad ?? 'ocasional') === filterPeriodicidad);
    if (filterPagadoPor) list = list.filter((g) => g.pagadoPor === filterPagadoPor);
    return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [enElMes, search, filterCat, filterTipo, filterPeriodicidad, filterPagadoPor]);

  const totalFiltrado = filtered.reduce((a, g) => a + g.total, 0);

  const setField = (k: keyof Gasto, v: unknown) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'baseImponible' || k === 'porcentajeIVA') {
        const base = Number(next.baseImponible ?? 0);
        const pct  = Number(next.porcentajeIVA ?? 21);
        const iva  = Math.round(base * pct) / 100;
        next.importeIVA = iva;
        next.total      = base + iva;
      }
      return next;
    });
  };

  const openNew = () => { setEditing(null); setForm(EMPTY(area)); setPeriodicidad('Ocasional'); setShowModal(true); };
  const openEdit = (g: Gasto) => { setEditing(g); setForm({ ...g }); setPeriodicidad('Ocasional'); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const yaExiste = (candidato: Gasto) =>
    allGastos.some((g) => g.area === candidato.area && g.concepto === candidato.concepto && g.categoria === candidato.categoria && g.fecha === candidato.fecha);

  const save = () => {
    if (!form.concepto) return;
    if (editing) {
      updateGasto(editing.id, form);
      closeModal();
      return;
    }
    const recurrenciaId = uid();
    const base: Gasto = { ...EMPTY(area), ...form, id: uid(), createdAt: new Date().toISOString(), recurrenciaId, periodicidad: periodicidad === 'Ocasional' ? undefined : (periodicidad.toLowerCase() as Gasto['periodicidad']), esRecurrente: periodicidad !== 'Ocasional' } as Gasto;
    addGasto(base);

    if (periodicidad !== 'Ocasional') {
      const n = numeroRepeticiones(periodicidad);
      const fechaBase = new Date(base.fecha);
      for (let i = 1; i <= n; i++) {
        const fecha = sumarPeriodo(fechaBase, periodicidad, i).toISOString().slice(0, 10);
        const candidato: Gasto = { ...base, id: uid(), fecha, createdAt: new Date().toISOString() };
        if (!yaExiste(candidato)) addGasto(candidato);
      }
    }
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos generales</h1>
          <p className="text-sm text-gray-500">{filtered.length} registros · Total: {fmt(totalFiltrado)}</p>
        </div>
        {canCreate(area) && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors">
            <Plus size={16} /> Nuevo gasto
          </button>
        )}
      </div>

      {/* Breadcrumb navegación Año → Mes */}
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
          <p className="text-center py-16 text-gray-400 text-sm">Sin gastos registrados todavía</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {anios.map(([y, data]) => (
              <button key={y} onClick={() => setSelectedYear(y)} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <Folder size={16} className="text-amber-500" />
                  <span className="text-lg font-bold text-gray-900">{y}</span>
                </div>
                <p className="text-xs text-gray-500">{data.count} gastos</p>
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
                  <div className="flex items-center gap-2 mb-2">
                    <Folder size={16} className="text-amber-500" />
                    <span className="font-bold text-gray-900">{MESES_FULL[m]}</span>
                  </div>
                  <p className="text-xs text-gray-500">{data.count} gastos</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nivel 3: tabla del mes seleccionado */}
      {selectedYear != null && selectedMonth != null && (
      <>
      <div className="flex items-center justify-between">
        <button onClick={() => setSelectedMonth(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a meses</button>
        <p className="text-sm text-gray-600">Total {MESES_FULL[selectedMonth]} {selectedYear}: <span className="font-semibold text-gray-900">{fmt(totalMes)}</span></p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar concepto o proveedor…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-amber-400" />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as GastoCategoria | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Todas las categorías</option>
          {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value as GastoTipo | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Todos los tipos</option>
          {TIPOS_GASTO.map((t) => <option key={t} value={t}>{t === 'fijo' ? 'Fijo' : 'Variable'}</option>)}
        </select>
        <select value={filterPeriodicidad} onChange={(e) => setFilterPeriodicidad(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Toda periodicidad</option>
          <option value="ocasional">Ocasional</option>
          <option value="mensual">Mensual</option>
          <option value="trimestral">Trimestral</option>
          <option value="anual">Anual</option>
        </select>
        <select value={filterPagadoPor} onChange={(e) => setFilterPagadoPor(e.target.value as PagadoPor | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Todos los pagadores</option>
          {PAGADORES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <p className="text-[11px] text-gray-400 -mt-2">Los filtros de Tipo, Categoría y Periodicidad se aplican sobre los datos cargados en esta sesión; algunos campos (tipo/periodicidad) están pendientes de migración para persistir de forma permanente.</p>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Concepto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pagado por</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">Sin gastos registrados</td></tr>
              ) : filtered.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{g.fecha}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{g.concepto}</p>
                    {g.proveedor && <p className="text-xs text-gray-400">{g.proveedor}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{g.categoria}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.tipo === 'fijo' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{g.tipo}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{g.pagadoPor ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmt(g.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.estadoPago === 'pagado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{g.estadoPago}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {canEdit(area) && <button onClick={() => openEdit(g)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                      {canDelete(area) && <button onClick={() => showConfirm('¿Eliminar este gasto?', () => deleteGasto(g.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar gasto' : 'Nuevo gasto'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-form">Concepto *</label>
              <input value={form.concepto ?? ''} onChange={(e) => setField('concepto', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fecha</label>
              <input type="date" value={form.fecha ?? ''} onChange={(e) => setField('fecha', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Proveedor</label>
              <input value={form.proveedor ?? ''} onChange={(e) => setField('proveedor', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Categoría</label>
              <select value={form.categoria ?? ''} onChange={(e) => setField('categoria', e.target.value as GastoCategoria)} className="input-form">
                {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Tipo de gasto</label>
              <select value={form.tipo ?? 'variable'} onChange={(e) => setField('tipo', e.target.value as GastoTipo)} className="input-form">
                {TIPOS_GASTO.map((t) => <option key={t} value={t}>{t === 'fijo' ? 'Fijo' : 'Variable'}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Pagado por</label>
              <select value={form.pagadoPor ?? 'La Montada'} onChange={(e) => setField('pagadoPor', e.target.value as PagadoPor)} className="input-form">
                {PAGADORES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Pendiente de migración para persistir.</p>
            </div>
            {area === 'dj' && (
              <div>
                <label className="label-form">Línea de negocio</label>
                <select value={form.lineaNegocio ?? 'DJs'} onChange={(e) => setField('lineaNegocio', e.target.value as Gasto['lineaNegocio'])} className="input-form">
                  <option value="DJs">DJs</option>
                  <option value="Real Madrid">Real Madrid</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Se usa para separar la rentabilidad de las inversiones de Real Madrid.</p>
              </div>
            )}
            <div>
              <label className="label-form">Base imponible (€)</label>
              <input type="number" step="0.01" value={form.baseImponible ?? 0} onChange={(e) => setField('baseImponible', parseFloat(e.target.value) || 0)} className="input-form" />
            </div>
            <div>
              <label className="label-form">IVA (%)</label>
              <select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="input-form">
                {PCTS_IVA.map((p) => <option key={p} value={p}>{p}%</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Total</label>
              <div className="input-form bg-gray-50 text-gray-700 font-semibold">{fmt(form.total ?? 0)}</div>
            </div>
            <div>
              <label className="label-form">Estado pago</label>
              <select value={form.estadoPago} onChange={(e) => setField('estadoPago', e.target.value)} className="input-form">
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
            <div>
              <label className="label-form">Método pago</label>
              <select value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className="input-form">
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Periodicidad</label>
              <select value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value as Periodicidad)} className="input-form" disabled={!!editing}>
                {PERIODICIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {editing && <p className="text-[11px] text-gray-400 mt-1">La periodicidad solo se define al crear el gasto.</p>}
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.facturaRecibida} onChange={(e) => setField('facturaRecibida', e.target.checked)} className="rounded" />
                Factura recibida
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.deducible} onChange={(e) => setField('deducible', e.target.checked)} className="rounded" />
                Gasto deducible
              </label>
            </div>
            <div className="col-span-2">
              <label className="label-form">Observaciones</label>
              <textarea value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} rows={2} className="input-form" />
            </div>
          </div>
          {!editing && periodicidad !== 'Ocasional' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Al guardar se crearán automáticamente las siguientes repeticiones ({periodicidad.toLowerCase()}) durante 1 año, comprobando que no existan ya para evitar duplicados.
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editing ? 'Guardar' : 'Añadir gasto'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
