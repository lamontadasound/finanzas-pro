/**
 * Facturas.tsx — Facturas e IVA
 * ─────────────────────────────────────────────────────────────────────────────
 * 3 pestañas:
 *
 *  1. Facturas emitidas
 *     → Auto-generadas desde ingresos con facturaEmitida = true.
 *     → No se crean manualmente. Son los ingresos facturados.
 *
 *  2. Facturas de gastos
 *     → Añadidas manualmente (proveedor, base, IVA).
 *     → Determinan el IVA soportado deducible.
 *
 *  3. IVA y Sociedades
 *     → IVA repercutido, IVA deducible, IVA a pagar.
 *     → Beneficio fiscal estimado y IS (tipo configurable, guardado en localStorage).
 */
import { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Download, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { fmt, fmtDate, uid, getAvailableYears, calcIVA, METODO_PAGO_LABELS } from '../utils/helpers';
import { Modal } from '../components/ui/Modal';
import type { Factura } from '../types';

// ── Tipos ─────────────────────────────────────────────────────────────────────
type FacturaTab = 'emitidas' | 'gastos' | 'iva';

// ── Plantilla gasto ───────────────────────────────────────────────────────────
const emptyGastoFactura = (): Omit<Factura, 'id'> => ({
  area: 'montada',
  tipo: 'recibida',
  numero: '',
  cliente: '',
  concepto: '',
  baseImponible: 0,
  porcentajeIVA: 21,
  importeIVA: 0,
  total: 0,
  fecha: new Date().toISOString().slice(0, 10),
  pagada: false,
  ivaDeducible: true,
});

// ── Página ────────────────────────────────────────────────────────────────────
export const Facturas = () => {
  const { ingresos, facturas, addFactura, updateFactura, deleteFactura } = useStore();
  const [tab, setTab] = useState<FacturaTab>('emitidas');

  // IS rate persisted in localStorage
  const [isRate, setIsRate] = useState<number>(() => {
    const stored = localStorage.getItem('finanzas-is-rate');
    return stored ? Number(stored) : 25;
  });

  const allYears = useMemo(() => {
    const ingYears = ingresos.filter((i) => i.facturaEmitida).map((i) => new Date(i.fechaEvento).getFullYear());
    const facYears = facturas.map((f) => new Date(f.fecha).getFullYear());
    const set = new Set([...ingYears, ...facYears]);
    const years = Array.from(set).sort((a, b) => b - a);
    return years.length ? years : [new Date().getFullYear()];
  }, [ingresos, facturas]);

  const [year, setYear] = useState(allYears[0] ?? new Date().getFullYear());
  const [areaFilter, setAreaFilter] = useState<'todas' | 'montada' | 'dj'>('todas');

  // Facturas emitidas: ingresos con facturaEmitida = true (filtrados por año)
  const facturasEmitidas = useMemo(() =>
    ingresos.filter((i) => {
      if (!i.facturaEmitida) return false;
      const y = new Date(i.fechaEvento).getFullYear();
      if (y !== year) return false;
      if (areaFilter !== 'todas' && i.area !== areaFilter) return false;
      return true;
    }).sort((a, b) => b.fechaEvento.localeCompare(a.fechaEvento)),
    [ingresos, year, areaFilter],
  );

  // Facturas de gastos: facturas recibidas (manuales)
  const facturasGastos = useMemo(() =>
    facturas.filter((f) => {
      const y = new Date(f.fecha).getFullYear();
      if (y !== year) return false;
      if (areaFilter !== 'todas' && f.area !== areaFilter) return false;
      return true;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [facturas, year, areaFilter],
  );

  // Cálculos IVA
  const ivaRepercutido = facturasEmitidas.reduce((s, i) => s + i.importeIVA, 0);
  const ivaDeducible   = facturasGastos.filter((f) => f.ivaDeducible).reduce((s, f) => s + f.importeIVA, 0);
  const ivaAPagar      = ivaRepercutido - ivaDeducible;

  // Cálculos IS
  const baseIngFact   = facturasEmitidas.reduce((s, i) => s + i.baseImponible, 0);
  const baseGastoDed  = facturasGastos.filter((f) => f.ivaDeducible).reduce((s, f) => s + f.baseImponible, 0);
  const beneficioFiscal = baseIngFact - baseGastoDed;
  const isEstimado    = Math.max(0, beneficioFiscal * (isRate / 100));

  const updateIsRate = (val: number) => {
    setIsRate(val);
    localStorage.setItem('finanzas-is-rate', String(val));
  };

  const tabs: { id: FacturaTab; label: string }[] = [
    { id: 'emitidas', label: `Facturas emitidas (${facturasEmitidas.length})` },
    { id: 'gastos',   label: `Facturas de gastos (${facturasGastos.length})` },
    { id: 'iva',      label: 'IVA y Sociedades' },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Facturas e IVA</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Facturas emitidas desde ingresos · Facturas de gastos · Liquidación IVA e IS</p>
        </div>
        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none"
          >
            {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {(['todas', 'montada', 'dj'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAreaFilter(a)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${areaFilter === a ? 'bg-gold-500/15 text-gold-400 border border-gold-500/20' : 'bg-surface-700 text-zinc-400 border border-surface-400/30 hover:text-zinc-200'}`}
            >
              {a === 'todas' ? 'Todas' : a === 'montada' ? 'La Montada' : 'DJ Personal'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickKPI label="IVA repercutido" value={fmt(ivaRepercutido)} color="text-green-400" />
        <QuickKPI label="IVA deducible" value={fmt(ivaDeducible)} color="text-orange-400" />
        <QuickKPI
          label={ivaAPagar >= 0 ? 'IVA a pagar' : 'IVA a compensar'}
          value={fmt(Math.abs(ivaAPagar))}
          color={ivaAPagar >= 0 ? 'text-red-400' : 'text-green-400'}
        />
        <QuickKPI
          label={`IS estimado (${isRate}%)`}
          value={fmt(isEstimado)}
          color="text-purple-400"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 border border-surface-400/20 rounded-xl p-1 w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? 'bg-gold-500/15 text-gold-400' : 'text-zinc-500 hover:text-zinc-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'emitidas' && (
        <EmitidasTab
          facturasEmitidas={facturasEmitidas}
          year={year}
          areaFilter={areaFilter}
        />
      )}
      {tab === 'gastos' && (
        <GastosFacturasTab
          facturas={facturasGastos}
          allFacturas={facturas}
          year={year}
          onAdd={(f) => addFactura({ ...f, id: uid() })}
          onUpdate={updateFactura}
          onDelete={deleteFactura}
        />
      )}
      {tab === 'iva' && (
        <IvaTab
          facturasEmitidas={facturasEmitidas}
          facturasGastos={facturasGastos}
          ivaRepercutido={ivaRepercutido}
          ivaDeducible={ivaDeducible}
          ivaAPagar={ivaAPagar}
          baseIngFact={baseIngFact}
          baseGastoDed={baseGastoDed}
          beneficioFiscal={beneficioFiscal}
          isEstimado={isEstimado}
          isRate={isRate}
          onChangeIsRate={updateIsRate}
          year={year}
        />
      )}
    </div>
  );
};

// ── KPI rápido ────────────────────────────────────────────────────────────────
const QuickKPI = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-4">
    <p className="text-xs text-zinc-500 mb-1">{label}</p>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
  </div>
);

// ── Tab: Facturas emitidas (desde ingresos) ───────────────────────────────────
const EmitidasTab = ({
  facturasEmitidas,
  year,
  areaFilter,
}: {
  facturasEmitidas: ReturnType<typeof Array.prototype.filter>;
  year: number;
  areaFilter: string;
}) => {
  const totBase  = facturasEmitidas.reduce((s: number, i: any) => s + i.baseImponible, 0);
  const totIVA   = facturasEmitidas.reduce((s: number, i: any) => s + i.importeIVA, 0);
  const totTotal = facturasEmitidas.reduce((s: number, i: any) => s + i.total, 0);

  const exportXlsx = () => {
    const rows = facturasEmitidas.map((i: any) => ({
      Área: i.area === 'montada' ? 'La Montada Sound' : 'DJ Personal',
      'Nº Factura': i.numeroFactura ?? '',
      Cliente: i.cliente,
      Concepto: i.concepto,
      Fecha: i.fechaEvento,
      'Base imp.': i.baseImponible,
      'IVA %': i.porcentajeIVA,
      IVA: i.importeIVA,
      Total: i.total,
      Estado: i.estadoPago,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas emitidas');
    XLSX.writeFile(wb, `facturas-emitidas-${year}.xlsx`);
  };

  if (facturasEmitidas.length === 0) {
    return (
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-12 text-center space-y-2">
        <p className="text-zinc-400 font-medium">Sin facturas emitidas</p>
        <p className="text-sm text-zinc-600">
          Las facturas emitidas se generan automáticamente desde los ingresos marcados con <strong className="text-zinc-400">«Factura emitida: Sí»</strong>.
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          Ve a La Montada Sound o DJ Personal → Ingresos → haz clic en un evento → activa "Factura emitida".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Facturas generadas automáticamente desde ingresos con «Factura: Sí» del año {year}{areaFilter !== 'todas' ? ` · ${areaFilter === 'montada' ? 'La Montada' : 'DJ Personal'}` : ''}.
        </p>
        <button onClick={exportXlsx} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 border border-surface-400/30 text-zinc-300 text-sm rounded-lg hover:text-white">
          <Download size={13} /> Excel
        </button>
      </div>
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-400/20">
              <th className="text-left px-4 py-3 text-zinc-500">Nº Factura</th>
              <th className="text-left px-4 py-3 text-zinc-500">Cliente / Concepto</th>
              <th className="text-left px-4 py-3 text-zinc-500">Área</th>
              <th className="text-left px-4 py-3 text-zinc-500">Fecha</th>
              <th className="text-right px-4 py-3 text-zinc-500">Base imp.</th>
              <th className="text-right px-4 py-3 text-zinc-500">IVA</th>
              <th className="text-right px-4 py-3 text-zinc-500">Total</th>
              <th className="text-left px-4 py-3 text-zinc-500">Estado cobro</th>
            </tr>
          </thead>
          <tbody>
            {facturasEmitidas.map((i: any) => (
              <tr key={i.id} className="border-b border-surface-400/10 hover:bg-surface-700/50">
                <td className="px-4 py-3 font-mono text-zinc-300 text-xs">{i.numeroFactura || <span className="text-zinc-600">Sin nº</span>}</td>
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{i.cliente}</p>
                  <p className="text-xs text-zinc-500">{i.concepto}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${i.area === 'montada' ? 'bg-gold-500/10 text-gold-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {i.area === 'montada' ? 'La Montada' : 'DJ Personal'}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-sm">{fmtDate(i.fechaEvento)}</td>
                <td className="px-4 py-3 text-right text-green-400 font-medium">{fmt(i.baseImponible)}</td>
                <td className="px-4 py-3 text-right text-zinc-500 text-xs">{i.porcentajeIVA}%<br />{fmt(i.importeIVA)}</td>
                <td className="px-4 py-3 text-right text-white font-semibold">{fmt(i.total)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    i.estadoPago === 'pagado' ? 'bg-green-500/10 text-green-400' :
                    i.estadoPago === 'parcial' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-zinc-500/10 text-zinc-400'
                  }`}>
                    {i.estadoPago === 'pagado' ? 'Cobrado' : i.estadoPago === 'parcial' ? 'Parcial' : 'Pendiente'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-700/50 font-semibold border-t border-surface-400/20">
              <td colSpan={4} className="px-4 py-3 text-zinc-400">TOTAL ({facturasEmitidas.length} facturas)</td>
              <td className="px-4 py-3 text-right text-green-400">{fmt(totBase)}</td>
              <td className="px-4 py-3 text-right text-zinc-400">{fmt(totIVA)}</td>
              <td className="px-4 py-3 text-right text-white">{fmt(totTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ── Tab: Facturas de gastos (manual) ─────────────────────────────────────────
const GastosFacturasTab = ({
  facturas,
  allFacturas,
  year,
  onAdd,
  onUpdate,
  onDelete,
}: {
  facturas: Factura[];
  allFacturas: Factura[];
  year: number;
  onAdd: (f: Omit<Factura, 'id'>) => void;
  onUpdate: (id: string, f: Partial<Factura>) => void;
  onDelete: (id: string) => void;
}) => {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Omit<Factura, 'id'>>(emptyGastoFactura());
  const [editId, setEditId] = useState<string | null>(null);
  const showConfirm = useConfirmStore((s) => s.show);

  const totBase  = facturas.reduce((s, f) => s + f.baseImponible, 0);
  const totIVA   = facturas.filter((f) => f.ivaDeducible).reduce((s, f) => s + f.importeIVA, 0);
  const totTotal = facturas.reduce((s, f) => s + f.total, 0);

  const nextNum = (area: Factura['area']) => {
    const prefix = area === 'montada' ? 'GF' : 'GD';
    const existing = allFacturas
      .filter((f) => f.tipo === 'recibida' && f.area === area && f.numero.startsWith(prefix + year))
      .map((f) => parseInt(f.numero.split('-').pop() ?? '0', 10))
      .filter((n) => !isNaN(n));
    const next = existing.length ? Math.max(...existing) + 1 : 1;
    return `${prefix}${year}-${String(next).padStart(3, '0')}`;
  };

  const openNew = () => {
    const f = emptyGastoFactura();
    f.numero = nextNum(f.area as Factura['area']);
    setForm(f); setEditId(null); setModal(true);
  };
  const openEdit = (f: Factura) => { setForm({ ...f }); setEditId(f.id); setModal(true); };
  const setField = (k: keyof typeof form, v: unknown) => setForm((f) => {
    const next = { ...f, [k]: v } as typeof form;
    if (k === 'area') next.numero = nextNum(v as Factura['area']);
    if (k === 'baseImponible' || k === 'porcentajeIVA') {
      const r = calcIVA(Number(next.baseImponible), Number(next.porcentajeIVA));
      return { ...next, ...r };
    }
    return next;
  });
  const save = () => {
    if (editId) onUpdate(editId, form);
    else onAdd(form);
    setModal(false);
  };

  const exportXlsx = () => {
    const rows = facturas.map((f) => ({
      Área: f.area, 'Nº Factura': f.numero, Proveedor: f.cliente, Concepto: f.concepto,
      Fecha: f.fecha, 'Base imp.': f.baseImponible, 'IVA %': f.porcentajeIVA, IVA: f.importeIVA,
      Total: f.total, Pagada: f.pagada ? 'Sí' : 'No', 'IVA deducible': f.ivaDeducible ? 'Sí' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas gastos');
    XLSX.writeFile(wb, `facturas-gastos-${year}.xlsx`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-zinc-500">
          Añade aquí las facturas de gastos de proveedores. Determinan el IVA deducible y los gastos para el IS.
        </p>
        <div className="flex gap-2">
          {facturas.length > 0 && (
            <button onClick={exportXlsx} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 border border-surface-400/30 text-zinc-300 text-sm rounded-lg hover:text-white">
              <Download size={13} /> Excel
            </button>
          )}
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-1.5 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400">
            <Plus size={14} /> Nueva factura de gasto
          </button>
        </div>
      </div>

      {facturas.length === 0 ? (
        <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-12 text-center">
          <p className="text-zinc-400">Sin facturas de gastos para {year}</p>
          <p className="text-sm text-zinc-600 mt-1">Añade facturas de proveedores para calcular el IVA deducible</p>
        </div>
      ) : (
        <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-400/20">
                <th className="text-left px-4 py-3 text-zinc-500">Nº Factura</th>
                <th className="text-left px-4 py-3 text-zinc-500">Proveedor / Concepto</th>
                <th className="text-left px-4 py-3 text-zinc-500">Área</th>
                <th className="text-left px-4 py-3 text-zinc-500">Fecha</th>
                <th className="text-right px-4 py-3 text-zinc-500">Base imp.</th>
                <th className="text-right px-4 py-3 text-zinc-500">IVA</th>
                <th className="text-right px-4 py-3 text-zinc-500">Total</th>
                <th className="text-center px-4 py-3 text-zinc-500">Ded.</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id} className="border-b border-surface-400/10 hover:bg-surface-700/50">
                  <td className="px-4 py-3 font-mono text-zinc-300 text-xs">{f.numero || '—'}</td>
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{f.cliente}</p>
                    <p className="text-xs text-zinc-500">{f.concepto}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${f.area === 'montada' ? 'bg-gold-500/10 text-gold-400' : 'bg-purple-500/10 text-purple-400'}`}>
                      {f.area === 'montada' ? 'La Montada' : 'DJ Personal'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-sm">{fmtDate(f.fecha)}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{fmt(f.baseImponible)}</td>
                  <td className="px-4 py-3 text-right text-zinc-500 text-xs">{f.porcentajeIVA}%<br />{fmt(f.importeIVA)}</td>
                  <td className="px-4 py-3 text-right text-red-400 font-medium">{fmt(f.total)}</td>
                  <td className="px-4 py-3 text-center">
                    {f.ivaDeducible
                      ? <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-400">Sí</span>
                      : <span className="px-1.5 py-0.5 rounded text-xs bg-zinc-500/10 text-zinc-500">No</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(f)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><Edit2 size={13} /></button>
                      <button onClick={() => showConfirm('¿Eliminar esta factura de gasto?', () => onDelete(f.id))} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-700/50 font-semibold border-t border-surface-400/20">
                <td colSpan={4} className="px-4 py-3 text-zinc-400">TOTAL ({facturas.length})</td>
                <td className="px-4 py-3 text-right text-zinc-300">{fmt(totBase)}</td>
                <td className="px-4 py-3 text-right text-zinc-400">{fmt(totIVA)}<br /><span className="text-xs font-normal">deducible</span></td>
                <td className="px-4 py-3 text-right text-red-400">{fmt(totTotal)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Modal nueva/editar factura gasto */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar factura de gasto' : 'Nueva factura de gasto'} width="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Área</label>
            <select value={form.area} onChange={(e) => setField('area', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
              <option value="montada">La Montada Sound</option>
              <option value="dj">DJ Personal</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Nº Factura</label>
            <input value={form.numero} onChange={(e) => setField('numero', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none font-mono" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Proveedor *</label>
            <input value={form.cliente} onChange={(e) => setField('cliente', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="Nombre del proveedor" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Fecha</label>
            <input type="date" value={form.fecha} onChange={(e) => setField('fecha', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-400 mb-1 block">Concepto *</label>
            <input value={form.concepto} onChange={(e) => setField('concepto', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="Ej: Servicios gestoría, Alquiler local, Marketing..." />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Base imponible (€)</label>
            <input type="number" value={form.baseImponible || ''} onChange={(e) => setField('baseImponible', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">% IVA</label>
            <select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
              {[0, 4, 10, 21].map((p) => <option key={p} value={p}>{p}%</option>)}
            </select>
          </div>
          <div className="col-span-2 bg-surface-600/50 rounded-lg px-4 py-2.5 flex gap-6 text-sm">
            <span className="text-zinc-400">IVA: <span className="text-white">{fmt(form.importeIVA)}</span></span>
            <span className="text-zinc-400">Total: <span className="text-red-400 font-bold">{fmt(form.total)}</span></span>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Método de pago</label>
            <select value={form.pagada ? 'pagada' : 'pendiente'} onChange={(e) => setField('pagada', e.target.value === 'pagada')} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
              <option value="pendiente">Pendiente</option>
              <option value="pagada">Pagada</option>
            </select>
          </div>
          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.ivaDeducible} onChange={(e) => setField('ivaDeducible', e.target.checked)} className="accent-gold-500 w-4 h-4" />
              <span className="text-sm text-white font-medium">IVA deducible: <span className={form.ivaDeducible ? 'text-green-400' : 'text-zinc-500'}>{form.ivaDeducible ? 'Sí' : 'No'}</span></span>
            </label>
          </div>
          {form.notas !== undefined && (
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Observaciones</label>
              <textarea value={form.notas ?? ''} onChange={(e) => setField('notas', e.target.value)} rows={2} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none" />
            </div>
          )}
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
            <button onClick={save} className="px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400">{editId ? 'Guardar cambios' : 'Añadir factura'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ── Tab: IVA y Sociedades ─────────────────────────────────────────────────────
const IvaTab = ({
  facturasEmitidas,
  facturasGastos,
  ivaRepercutido,
  ivaDeducible,
  ivaAPagar,
  baseIngFact,
  baseGastoDed,
  beneficioFiscal,
  isEstimado,
  isRate,
  onChangeIsRate,
  year,
}: {
  facturasEmitidas: any[];
  facturasGastos: Factura[];
  ivaRepercutido: number;
  ivaDeducible: number;
  ivaAPagar: number;
  baseIngFact: number;
  baseGastoDed: number;
  beneficioFiscal: number;
  isEstimado: number;
  isRate: number;
  onChangeIsRate: (v: number) => void;
  year: number;
}) => {
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(isRate));

  const saveRate = () => {
    const v = parseFloat(rateInput);
    if (!isNaN(v) && v >= 0 && v <= 100) onChangeIsRate(v);
    setEditingRate(false);
  };

  return (
    <div className="space-y-5">
      {/* IVA */}
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-400/20">
          <h3 className="text-sm font-semibold text-white">Liquidación de IVA — {year}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">IVA repercutido de facturas emitidas − IVA soportado deducible de facturas de gastos</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-surface-400/20">
          <IVABlock label="IVA repercutido" value={ivaRepercutido} sub={`${facturasEmitidas.length} facturas emitidas`} color="text-green-400" sign="+" />
          <IVABlock label="IVA soportado deducible" value={ivaDeducible} sub={`${facturasGastos.filter((f) => f.ivaDeducible).length} facturas deducibles`} color="text-orange-400" sign="−" />
          <IVABlock
            label={ivaAPagar >= 0 ? 'IVA a ingresar en Hacienda' : 'IVA a compensar'}
            value={Math.abs(ivaAPagar)}
            sub={ivaAPagar >= 0 ? 'Resultado positivo → pagar' : 'Resultado negativo → compensar'}
            color={ivaAPagar >= 0 ? 'text-red-400' : 'text-green-400'}
          />
        </div>
        <div className="px-5 py-3 bg-surface-700/30 text-xs text-zinc-500">
          <strong className="text-zinc-400">Cálculo:</strong> {fmt(ivaRepercutido)} (repercutido) − {fmt(ivaDeducible)} (deducible) = <span className={ivaAPagar >= 0 ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>{fmt(ivaAPagar)}</span>
        </div>
      </div>

      {/* IS */}
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-400/20 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Impuesto de Sociedades (IS) estimado — {year}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Estimación basada en ingresos facturados y gastos deducibles</p>
          </div>
          {/* Configurar tipo */}
          <div className="flex items-center gap-2">
            {editingRate ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveRate(); if (e.key === 'Escape') setEditingRate(false); }}
                  className="w-20 bg-surface-600 border border-gold-500/50 rounded px-2 py-1 text-white text-sm outline-none text-center"
                  autoFocus
                />
                <span className="text-zinc-400 text-sm">%</span>
                <button onClick={saveRate} className="px-2 py-1 bg-gold-500 text-black text-xs rounded hover:bg-gold-400 font-semibold">OK</button>
                <button onClick={() => setEditingRate(false)} className="text-zinc-500 hover:text-zinc-300 text-xs">✕</button>
              </div>
            ) : (
              <button
                onClick={() => { setRateInput(String(isRate)); setEditingRate(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 border border-surface-400/30 text-zinc-300 text-xs rounded-lg hover:text-white"
              >
                <Settings size={12} /> Tipo: {isRate}%
              </button>
            )}
          </div>
        </div>

        {/* Cálculo paso a paso */}
        <div className="p-5 space-y-3">
          <div className="space-y-2">
            <ISLine label="Ingresos con factura emitida (base imponible)" value={baseIngFact} color="text-green-400" />
            <ISLine label="Gastos deducibles (facturas de gastos)" value={baseGastoDed} color="text-red-400" negative />
            <div className="border-t border-surface-400/20 pt-2">
              <ISLine
                label="Beneficio fiscal estimado"
                value={beneficioFiscal}
                color={beneficioFiscal >= 0 ? 'text-gold-400' : 'text-zinc-500'}
                bold
              />
            </div>
            <ISLine
              label={`Tipo impositivo aplicado (${isRate}%)`}
              value={beneficioFiscal > 0 ? beneficioFiscal * (isRate / 100) : 0}
              color="text-purple-400"
              negative
            />
            <div className="border-t border-surface-400/20 pt-2">
              <ISLine
                label="Impuesto de Sociedades estimado"
                value={isEstimado}
                color={isEstimado > 0 ? 'text-red-400' : 'text-green-400'}
                bold
              />
            </div>
          </div>

          {beneficioFiscal <= 0 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
              Beneficio fiscal negativo o cero → IS = 0 €
            </div>
          )}

          <div className="bg-surface-700/30 rounded-xl px-4 py-3 text-xs text-zinc-500 space-y-1">
            <p className="font-semibold text-zinc-400">⚠️ Aviso importante</p>
            <p>Esta es una estimación orientativa. La liquidación real del IS puede diferir según deducciones fiscales específicas, ajustes extracontables, reservas y otros factores. Consulta con tu asesor fiscal para la declaración definitiva.</p>
          </div>
        </div>
      </div>

      {/* Resumen consolidado */}
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Resumen fiscal {year}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ResFiscalKPI label="Ingresos facturados" value={fmt(baseIngFact)} color="text-green-400" />
          <ResFiscalKPI label="Gastos deducibles" value={fmt(baseGastoDed)} color="text-red-400" />
          <ResFiscalKPI label="Beneficio fiscal" value={fmt(beneficioFiscal)} color={beneficioFiscal >= 0 ? 'text-gold-400' : 'text-zinc-500'} />
          <ResFiscalKPI label={`IS estimado (${isRate}%)`} value={fmt(isEstimado)} color="text-purple-400" />
          <ResFiscalKPI label="IVA repercutido" value={fmt(ivaRepercutido)} color="text-green-400" />
          <ResFiscalKPI label="IVA deducible" value={fmt(ivaDeducible)} color="text-orange-400" />
          <ResFiscalKPI label={ivaAPagar >= 0 ? 'IVA a pagar' : 'IVA a compensar'} value={fmt(Math.abs(ivaAPagar))} color={ivaAPagar >= 0 ? 'text-red-400' : 'text-green-400'} />
          <ResFiscalKPI label="Total obligaciones" value={fmt(isEstimado + Math.max(0, ivaAPagar))} color="text-red-400" />
        </div>
      </div>
    </div>
  );
};

// ── Sub-componentes IVA tab ───────────────────────────────────────────────────
const IVABlock = ({ label, value, sub, color, sign }: { label: string; value: number; sub: string; color: string; sign?: string }) => (
  <div className="p-5 text-center">
    <p className="text-xs text-zinc-500 mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{sign && <span className="text-zinc-500 mr-1">{sign}</span>}{fmt(value)}</p>
    <p className="text-xs text-zinc-600 mt-1">{sub}</p>
  </div>
);

const ISLine = ({ label, value, color, negative = false, bold = false }: { label: string; value: number; color: string; negative?: boolean; bold?: boolean }) => (
  <div className={`flex items-center justify-between ${bold ? 'font-semibold' : ''}`}>
    <span className={`text-sm ${bold ? 'text-white' : 'text-zinc-400'}`}>{label}</span>
    <span className={`text-sm font-mono ${color}`}>{negative ? '−' : ''}{fmt(value)}</span>
  </div>
);

const ResFiscalKPI = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="bg-surface-700/50 rounded-xl p-3">
    <p className="text-xs text-zinc-500 mb-1">{label}</p>
    <p className={`text-base font-bold ${color}`}>{value}</p>
  </div>
);
