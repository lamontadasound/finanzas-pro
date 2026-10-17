import {ExpenseStatus} from '../../components/ui/ExpenseStatus';
import {useExpenseCategories,categoryColor} from '../../lib/expenseCategoryConfig';
import { resolveLinea } from '../../config/resolveLinea';
import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Folder, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader, Metric, Btn, Widget, SplitBar, Dot } from '../../components/kit';
import { GastosSwitch } from '../../components/kit/GastosSwitch';
import { YearGrid, MonthGrid } from '../../components/ingresos/IngresosViews';
import { EmptyState } from '../../components/ui/EmptyState';
import { RowMenu2 } from '../../components/ui2/RowMenu';
import { EventCategoryField } from '../../components/forms/EventCategoryField';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useConfirmStore } from '../../store/useConfirmStore';
import { AdjuntarFacturaModal } from '../../components/facturacion/AdjuntarFacturaModal';
import { Paperclip } from 'lucide-react';
import type { Area, Gasto, GastoCategoria, GastoTipo, PagadoPor, PaymentMethod } from '../../types';
import type { LineaId } from '../../config/businessLines';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' } as Intl.NumberFormatOptions);
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];


const TIPOS_GASTO: GastoTipo[] = ['fijo', 'variable'];
const PAGADORES: PagadoPor[] = ['La Montada', 'Julia', 'Rodrigo', 'Julia y Rodrigo', 'Marco'];
const METODOS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'bizum', 'otro'];
const PCTS_IVA = [0, 10, 21];
const PERIODICIDADES = ['Ocasional', 'Mensual', 'Trimestral', 'Anual'] as const;
type Periodicidad = typeof PERIODICIDADES[number];

interface Props {
  area: Area;
  /** Fase D: separa DJ de Real Madrid dentro de `area='dj'` usando el campo
   *  libre `lineaNegocio` que ya existe en `Gasto` (sin migración): los
   *  gastos generales de Real Madrid se guardan con `lineaNegocio:'Real
   *  Madrid'`; el resto de `area='dj'` se consideran DJ. */
  filterLinea?: LineaId;
}

const EMPTY = (area: Area, filterLinea?: LineaId): Partial<Gasto> => ({
  area, fecha: new Date().toISOString().slice(0, 10),
  concepto: '', categoria: 'Personal', tipo: 'variable', pagadoPor: 'La Montada',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  metodoPago: 'transferencia', estadoPago: 'pagado',
  facturaRecibida: false, deducible: true,
  lineaNegocio: filterLinea ?? (area === 'montada' ? 'montada_sound' : 'dj'),
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

export const GastosPage = ({ area, filterLinea }: Props) => {
  const allGastos  = useStore((s) => s.gastos);
  const {categories}=useExpenseCategories();
  const gastos     = useMemo(() => allGastos.filter((g) => {
    if (g.area !== area) return false;
    if (filterLinea) return resolveLinea(g) === filterLinea;
    return true;
  }), [allGastos, area, filterLinea]);
  const addGasto   = useStore((s) => s.addGasto);
  const updateGasto = useStore((s) => s.updateGasto);
  const deleteGasto = useStore((s) => s.deleteGasto);
  // Fase F: permiso real por línea (ver IngresosPage para el porqué).
  const permLinea = filterLinea ?? (area === 'montada' ? 'montada_sound' : 'dj');
  const canCreateLinea = useAuthStore((s) => s.canCreateLinea);
  const canEditLinea   = useAuthStore((s) => s.canEditLinea);
  const canDeleteLinea = useAuthStore((s) => s.canDeleteLinea);
  const canCreate  = () => canCreateLinea(permLinea);
  const canEdit    = () => canEditLinea(permLinea);
  const canDelete  = () => canDeleteLinea(permLinea);
  const showConfirm = useConfirmStore((s) => s.show);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Gasto | null>(null);
  const [facturaGasto, setFacturaGasto] = useState<Gasto | null>(null);
  const [form, setForm]           = useState<Partial<Gasto>>(EMPTY(area, filterLinea));
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('Ocasional');

  // ── Navegación por Año → Mes (carpetas) ──────────────────────────────────
  const [selectedYear, setSelectedYear]   = useState<number | null>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const anios = useMemo(() => {
    const map = new Map<number, { count: number; total: number }>();
    gastos.forEach((g) => {
      const y = new Date(g.fecha).getFullYear();
      const cur = map.get(y) ?? { count: 0, total: 0 };
      map.set(y, { count: cur.count + 1, total: cur.total + g.baseImponible });
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [gastos]);

  const totalAnio = useMemo(() => {
    if (selectedYear == null) return 0;
    return gastos.filter((g) => new Date(g.fecha).getFullYear() === selectedYear).reduce((a, g) => a + g.baseImponible, 0);
  }, [gastos, selectedYear]);

  const totalMes = useMemo(() => {
    if (selectedYear == null || selectedMonth == null) return 0;
    return gastos.filter((g) => {
      const d = new Date(g.fecha);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    }).reduce((a, g) => a + g.baseImponible, 0);
  }, [gastos, selectedYear, selectedMonth]);

  const enElMes = useMemo(() => {
    if (selectedYear == null || selectedMonth == null) return [];
    return gastos.filter((g) => {
      const d = new Date(g.fecha);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [gastos, selectedYear, selectedMonth]);

  const filtered = useMemo(() => [...enElMes].sort((a, b) => b.fecha.localeCompare(a.fecha)), [enElMes]);



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

  const openNew = () => { setEditing(null); setForm(EMPTY(area, filterLinea)); setPeriodicidad('Ocasional'); setShowModal(true); };
  const openEdit = (g: Gasto) => { setEditing(g); setForm({ ...g }); setPeriodicidad('Ocasional'); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const yaExiste = (candidato: Gasto) =>
    allGastos.some((g) => g.area === candidato.area && g.concepto === candidato.concepto && g.categoria === candidato.categoria && g.fecha === candidato.fecha);

  const save = async () => {
    if (!form.concepto) return;
    if (editing) {
      if (!await updateGasto(editing.id, form)) return;
      closeModal();
      return;
    }
    const recurrenciaId = uid();
    const base: Gasto = { ...EMPTY(area, filterLinea), ...form, id: uid(), createdAt: new Date().toISOString(), recurrenciaId, periodicidad: periodicidad === 'Ocasional' ? undefined : (periodicidad.toLowerCase() as Gasto['periodicidad']), esRecurrente: periodicidad !== 'Ocasional' } as Gasto;
    if (!await addGasto(base)) return;

    if (periodicidad !== 'Ocasional') {
      const n = numeroRepeticiones(periodicidad);
      const fechaBase = new Date(base.fecha);
      for (let i = 1; i <= n; i++) {
        const fecha = sumarPeriodo(fechaBase, periodicidad, i).toISOString().slice(0, 10);
        const candidato: Gasto = { ...base, id: uid(), fecha, createdAt: new Date().toISOString() };
        if (!yaExiste(candidato)) if (!await addGasto(candidato)) return;
      }
    }
    closeModal();
  };

  const resumenAnios = anios.map(([year, d]) => {
    const months = Array(12).fill(0) as number[];
    gastos.forEach((g) => { const dt = new Date(g.fecha); if (dt.getFullYear() === year) months[dt.getMonth()] += g.baseImponible; });
    return { year, count: d.count, total: d.total, months };
  });
  const delAnio = gastos.filter((g) => new Date(g.fecha).getFullYear() === selectedYear);
  const resumenMeses = Array.from({ length: 12 }, (_, m) => {
    const del = delAnio.filter((g) => new Date(g.fecha).getMonth() === m);
    return { count: del.length, total: del.reduce((a, g) => a + g.baseImponible, 0), pendiente: del.filter((g) => g.estadoPago === 'pendiente').reduce((a, g) => a + g.total, 0) };
  });
  // Categorías del año, para el reparto visual
  const porCategoria = Object.entries(delAnio.reduce<Record<string, number>>((acc, g) => { acc[g.categoria] = (acc[g.categoria] ?? 0) + g.baseImponible; return acc; }, {}))
    .sort((x, y) => y[1] - x[1]);

  return (
    <div>
      <PageHeader title={selectedMonth != null && selectedYear != null ? `${MESES_FULL[selectedMonth]} ${selectedYear}` : selectedYear != null ? `Gastos ${selectedYear}` : 'Gastos'}>
        <GastosSwitch eventosLabel={filterLinea === 'montada_installations' ? 'Por instalación' : area === 'montada' ? 'Por eventos' : filterLinea === 'real_madrid' ? 'Por partido' : 'Por actuación'} />
        {canCreate() && <Btn variant="primary" onClick={openNew}><Plus size={16} strokeWidth={2.4} />Nuevo gasto</Btn>}
      </PageHeader>

      {selectedYear != null && (
        <nav className="crumbs" aria-label="Ruta">
          <button onClick={() => { setSelectedYear(null); setSelectedMonth(null); }}>Años</button>
          <ChevronRight size={14} />
          {selectedMonth == null ? <b>{selectedYear}</b> : (
            <>
              <button onClick={() => setSelectedMonth(null)}>{selectedYear}</button>
              <ChevronRight size={14} />
              <b>{MESES_FULL[selectedMonth]}</b>
            </>
          )}
        </nav>
      )}

      {selectedYear == null && (
        anios.length === 0
          ? <EmptyState icon={<Folder size={22} />} title="Sin gastos registrados todavía" />
          : <YearGrid years={resumenAnios} onOpen={(y) => { setSelectedYear(y); setSelectedMonth(null); }} unit={['gasto', 'gastos']} />
      )}

      {selectedYear != null && selectedMonth == null && (
        <>
          <div className="bento mb-4">
            <Metric label="Sin IVA" value={totalAnio} />
            <Metric label="Con IVA" value={delAnio.reduce((a, g) => a + g.total, 0)} delay={0.03} />
            <Metric label="IVA soportado" value={delAnio.reduce((a, g) => a + (g.importeIVA ?? 0), 0)} delay={0.06} />
            <Metric label="Sin pagar" value={resumenMeses.reduce((a, m) => a + m.pendiente, 0)} delay={0.09} tone="warning" />
            {porCategoria.length > 0 && (
              <Widget className="span-full" title="Por categoría" delay={0.12}>
                <SplitBar parts={porCategoria.map(([c, v]) => ({ label: c, value: v, color: categoryColor(c, categories) }))} />
                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
                  {porCategoria.map(([c, v]) => (
                    <span key={c} className="flex items-center gap-1.5 text-[13px]"><Dot color={categoryColor(c, categories)} />{c}<b className="num">{fmt(v)}</b></span>
                  ))}
                </div>
              </Widget>
            )}
          </div>
          <MonthGrid year={selectedYear} months={resumenMeses} onOpen={setSelectedMonth} unit={['gasto', 'gastos']} pendingLabel="sin pagar" emptyLabel="Sin gastos" />
        </>
      )}

      {selectedYear != null && selectedMonth != null && (
        <>
          <div className="bento mb-4">
            <Metric label="Sin IVA" value={totalMes} />
            <Metric label="Con IVA" value={enElMes.reduce((a, g) => a + g.total, 0)} delay={0.03} />
            <Metric label="Gastos" value={enElMes.length} kind="count" delay={0.06} />
            <Metric label="Sin pagar" value={enElMes.filter((g) => g.estadoPago === 'pendiente').reduce((a, g) => a + g.total, 0)} delay={0.09} tone="warning" />
          </div>
          {filtered.length === 0 ? <EmptyState icon={<Folder size={22} />} title="Sin gastos este mes" /> : (
            <div className="widget overflow-hidden" style={{ padding: 0 }}>
              <div className="gx-grid gx-head" aria-hidden>
                <span /><span>Concepto</span><span>Categoría</span><span>Pagado por</span><span>Fecha</span>
                <span className="r">Sin IVA</span><span className="r">Con IVA</span><span>Pago</span><span />
              </div>
              {filtered.map((g, idx) => {
                const color = categoryColor(g.categoria, categories);
                return (
                  <motion.div key={g.id} className="gx-grid gx-row"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.45, delay: idx * 0.025 }}>
                    <span className="cat-glyph" style={{ background: `${color}1f`, color }}>{g.categoria?.slice(0, 1).toUpperCase() || '·'}</span>
                    <span className="gx-main"><b>{g.concepto}</b><small>{[g.categoria, g.proveedor, g.fecha].filter(Boolean).join(' · ')}</small></span>
                    <span className="gx-cat"><span className="cat-tag" style={{ color, background: `${color}14` }}>{g.categoria}</span></span>
                    <span className="gx-col">{g.pagadoPor ?? '—'}</span>
                    <span className="gx-col num">{g.fecha}</span>
                    <span className="r num">{fmt(g.baseImponible)}</span>
                    <span className="r num gx-strong">{fmt(g.total)}</span>
                    <span className="gx-pay"><ExpenseStatus status={g.estadoPago} /></span>
                    <span className="flex justify-end">
                      <RowMenu2 actions={[
                        ...(canCreate() ? [{ label: 'Adjuntar factura', icon: <Paperclip size={13} />, onClick: () => setFacturaGasto(g) }] : []),
                        ...(canEdit() ? [{ label: 'Editar', icon: <Edit2 size={13} />, onClick: () => openEdit(g) }] : []),
                        ...(canDelete() ? [{ label: 'Eliminar', icon: <Trash2 size={13} />, danger: true, onClick: () => showConfirm('¿Eliminar este gasto?', () => deleteGasto(g.id)) }] : []),
                      ]} />
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
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
              <EventCategoryField scope="general" value={form.categoria ?? ''} onChange={(v) => setField('categoria', v as GastoCategoria)} />
            </div>
{area !== 'montada' && (            <div>
              <label className="label-form">Tipo de gasto</label>
              <select value={form.tipo ?? 'variable'} onChange={(e) => setField('tipo', e.target.value as GastoTipo)} className="input-form">
                {TIPOS_GASTO.map((t) => <option key={t} value={t}>{t === 'fijo' ? 'Fijo' : 'Variable'}</option>)}
              </select>
            </div>)}
            <div>
              <label className="label-form">Pagado por</label>
              <select value={form.pagadoPor ?? 'La Montada'} onChange={(e) => setField('pagadoPor', e.target.value as PagadoPor)} className="input-form">
                {PAGADORES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
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
              <label className="label-form">Total sin IVA (€)</label>
              <input type="number" step="0.01" value={form.baseImponible ?? 0} onChange={(e) => setField('baseImponible', parseFloat(e.target.value) || 0)} className="input-form" />
            </div>
            <div>
              <label className="label-form">IVA (%)</label>
              <select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="input-form">
                {PCTS_IVA.map((p) => <option key={p} value={p}>{p}%</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Total con IVA</label>
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
            <div className="col-span-2">
              <label className="label-form">Nº de factura <span className="text-ink-4 font-normal">(si la hay)</span></label>
              <input value={form.numeroFactura ?? ''} onChange={(e) => setField('numeroFactura', e.target.value || undefined)} className="input-form" />
            </div>
          </div>
          {!editing && periodicidad !== 'Ocasional' && (
            <p className="text-xs text-gold-700 bg-gold-50 border border-gold-200 rounded-lg px-3 py-2">
              Al guardar se crearán automáticamente las siguientes repeticiones ({periodicidad.toLowerCase()}) durante 1 año, comprobando que no existan ya para evitar duplicados.
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button variant="primary" onClick={save} className="flex-1">{editing ? 'Guardar' : 'Añadir gasto'}</Button>
          </div>
        </div>
      </Modal>

      {facturaGasto && (
        <AdjuntarFacturaModal gasto={facturaGasto} onClose={() => setFacturaGasto(null)} />
      )}
    </div>
  );
};
