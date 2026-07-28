import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Upload, AlertTriangle } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import { YearQuarterMonthNav, matchesYQM, type YQMValue } from '../../components/ui/YearQuarterMonthNav';
import type { Area, Factura } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const PCTS_IVA = [0, 10, 21];

interface Props { area: Area | 'todos' }

const EMPTY = (area: Area | 'todos'): Partial<Factura> => ({
  area: area === 'todos' ? 'montada' : area,
  tipo: 'emitida', numero: '', cliente: '', concepto: '',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  fecha: new Date().toISOString().slice(0, 10),
  pagada: false, ivaDeducible: true,
});

export const FacturasAreaPage = ({ area }: Props) => {
  const allFacturas   = useStore((s) => s.facturas);
  const facturas      = useMemo(
    () => area === 'todos' ? allFacturas : allFacturas.filter((f) => f.area === area),
    [allFacturas, area],
  );
  const addFactura    = useStore((s) => s.addFactura);
  const updateFactura = useStore((s) => s.updateFactura);
  const deleteFactura = useStore((s) => s.deleteFactura);
  const canCreate = useAuthStore((s) => s.canCreate);
  const canEdit   = useAuthStore((s) => s.canEdit);
  const canDelete = useAuthStore((s) => s.canDelete);
  const showConfirm = useConfirmStore((s) => s.show);

  const [tab, setTab] = useState<'emitida' | 'recibida'>('emitida');
  const [filterArea, setFilterArea] = useState<Area | 'todos'>('todos');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Factura | null>(null);
  const [form, setForm]           = useState<Partial<Factura>>(EMPTY(area));
  const [duplicadoAviso, setDuplicadoAviso] = useState(false);
  const [nav, setNav] = useState<YQMValue>({ year: null, trimestre: null, month: null });
  const completo = nav.year != null && nav.trimestre != null && nav.month != null;

  const delTab = useMemo(() => {
    let list = facturas.filter((f) => f.tipo === tab);
    if (area === 'todos' && filterArea !== 'todos') list = list.filter((f) => f.area === filterArea);
    return list;
  }, [facturas, tab, area, filterArea]);

  const navItems = useMemo(() => delTab.map((f) => ({ fecha: f.fecha, total: f.total })), [delTab]);

  const filtered = useMemo(() => {
    let list = delTab.filter((f) => matchesYQM(f.fecha, nav));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.numero.toLowerCase().includes(q) || f.cliente.toLowerCase().includes(q) || f.concepto.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [delTab, nav, search]);

  const totalEmitidas   = facturas.filter((f) => f.tipo === 'emitida').reduce((a, f) => a + f.total, 0);
  const totalRecibidas  = facturas.filter((f) => f.tipo === 'recibida').reduce((a, f) => a + f.total, 0);
  const ivaRepercutido  = facturas.filter((f) => f.tipo === 'emitida').reduce((a, f) => a + f.importeIVA, 0);
  const ivaSoportado    = facturas.filter((f) => f.tipo === 'recibida' && f.ivaDeducible).reduce((a, f) => a + f.importeIVA, 0);
  const pendientes      = facturas.filter((f) => !f.pagada).length;
  const cobradasPagadas = facturas.filter((f) => f.pagada).length;

  const setField = (k: keyof Factura, v: unknown) => {
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

  const checkDuplicado = (numero: string, facturaArea: Area | undefined, tipo: string, excludeId?: string) =>
    facturas.some((f) => f.id !== excludeId && f.numero === numero && f.area === facturaArea && f.tipo === tipo);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY(area), tipo: tab }); setDuplicadoAviso(false); setShowModal(true); };
  const openEdit = (f: Factura) => { setEditing(f); setForm({ ...f }); setDuplicadoAviso(false); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const save = () => {
    if (!form.numero || !form.cliente || !form.area) return;
    const esDuplicado = checkDuplicado(form.numero, form.area, form.tipo ?? 'emitida', editing?.id);
    if (esDuplicado) { setDuplicadoAviso(true); return; }
    if (editing) {
      updateFactura(editing.id, form);
    } else {
      addFactura({ ...EMPTY(area), ...form, id: uid(), createdAt: new Date().toISOString() } as Factura);
    }
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
          <p className="text-sm text-gray-500">Emitidas: {fmt(totalEmitidas)} · Recibidas: {fmt(totalRecibidas)}</p>
        </div>
        {canCreate('facturas') && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors">
            <Plus size={16} /> Nueva factura
          </button>
        )}
      </div>

      {/* KPIs de IVA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">IVA repercutido</p>
          <p className="text-lg font-bold text-gray-900">{fmt(ivaRepercutido)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">IVA soportado</p>
          <p className="text-lg font-bold text-gray-900">{fmt(ivaSoportado)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Diferencia IVA</p>
          <p className={`text-lg font-bold ${ivaRepercutido - ivaSoportado >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(ivaRepercutido - ivaSoportado)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Pendientes / Pagadas</p>
          <p className="text-lg font-bold text-gray-900">{pendientes} / {cobradasPagadas}</p>
        </div>
      </div>

      {/* Tabs Ingresos/Gastos */}
      <div className="flex gap-2">
        <button onClick={() => { setTab('emitida'); setNav({ year: null, trimestre: null, month: null }); }} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'emitida' ? 'bg-amber-500 text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>Facturas de ingresos (emitidas)</button>
        <button onClick={() => { setTab('recibida'); setNav({ year: null, trimestre: null, month: null }); }} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'recibida' ? 'bg-amber-500 text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>Facturas de gastos (recibidas)</button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar número, cliente…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-amber-400" />
        </div>
        {area === 'todos' && (
          <select value={filterArea} onChange={(e) => setFilterArea(e.target.value as Area | 'todos')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="todos">Todas las áreas</option>
            <option value="montada">La Montada Sound</option>
            <option value="dj">DJs</option>
          </select>
        )}
      </div>

      <YearQuarterMonthNav items={navItems} value={nav} onChange={setNav} />

      {completo && (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nº</th>
                {area === 'todos' && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Área</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente/Proveedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pagada</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={area === 'todos' ? 7 : 6} className="text-center py-12 text-gray-400 text-sm">Sin facturas</td></tr>
              ) : filtered.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-700">{f.numero}</td>
                  {area === 'todos' && <td className="px-4 py-3 text-gray-500 text-xs">{f.area === 'montada' ? 'Montada' : 'DJ'}</td>}
                  <td className="px-4 py-3 text-gray-800">{f.cliente}</td>
                  <td className="px-4 py-3 text-gray-500">{f.fecha}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmt(f.total)}</td>
                  <td className="px-4 py-3 text-center">{f.pagada ? <span className="text-green-600 text-xs font-medium">✓</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {canEdit('facturas') && <button onClick={() => openEdit(f)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                      {canDelete('facturas') && <button onClick={() => showConfirm('¿Eliminar esta factura?', () => deleteFactura(f.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar factura' : 'Nueva factura'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-form">Área *</label>
              <select value={form.area ?? 'montada'} onChange={(e) => setField('area', e.target.value)} className="input-form" disabled={area !== 'todos'}>
                <option value="montada">La Montada Sound</option>
                <option value="dj">DJs</option>
              </select>
            </div>
            <div>
              <label className="label-form">Tipo</label>
              <select value={form.tipo} onChange={(e) => setField('tipo', e.target.value)} className="input-form">
                <option value="emitida">Emitida (ingreso)</option>
                <option value="recibida">Recibida (gasto)</option>
              </select>
            </div>
            <div>
              <label className="label-form">Nº Factura *</label>
              <input value={form.numero ?? ''} onChange={(e) => setField('numero', e.target.value)} className="input-form" placeholder="LMS-2026-001" />
            </div>
            <div>
              <label className="label-form">Serie</label>
              <input value={form.serie ?? ''} onChange={(e) => setField('serie', e.target.value)} className="input-form" placeholder="LMS-2026" />
            </div>
            <div>
              <label className="label-form">Fecha emisión</label>
              <input type="date" value={form.fecha ?? ''} onChange={(e) => setField('fecha', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fecha vencimiento</label>
              <input type="date" value={form.fechaVencimiento ?? ''} onChange={(e) => setField('fechaVencimiento', e.target.value)} className="input-form" />
            </div>
            <div className="col-span-2">
              <label className="label-form">Cliente / Proveedor *</label>
              <input value={form.cliente ?? ''} onChange={(e) => setField('cliente', e.target.value)} className="input-form" />
            </div>
            <div className="col-span-2">
              <label className="label-form">Concepto</label>
              <input value={form.concepto ?? ''} onChange={(e) => setField('concepto', e.target.value)} className="input-form" />
            </div>
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
              <div className="input-form bg-gray-50 font-semibold text-gray-700">{fmt(form.total ?? 0)}</div>
            </div>
            <div>
              <label className="label-form">Estado</label>
              <select value={form.pagada ? 'pagada' : 'pendiente'} onChange={(e) => setField('pagada', e.target.value === 'pagada')} className="input-form">
                <option value="pendiente">Pendiente</option>
                <option value="pagada">{form.tipo === 'emitida' ? 'Cobrada' : 'Pagada'}</option>
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.ivaDeducible} onChange={(e) => setField('ivaDeducible', e.target.checked)} className="rounded" />
                IVA deducible
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.enviada} onChange={(e) => setField('enviada', e.target.checked)} className="rounded" />
                Enviada al cliente
              </label>
            </div>
            <div className="col-span-2">
              <label className="label-form">Documento (PDF / imagen) <span className="text-gray-400 font-normal">(pendiente de activar Storage)</span></label>
              <div className="flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-gray-400 text-sm">
                <Upload size={16} /> Subida de archivos disponible tras aplicar la migración y activar el bucket de Storage
              </div>
            </div>
          </div>
          {duplicadoAviso && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={14} /> Ya existe una factura con este número, área y tipo. Cambia el número para continuar.
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editing ? 'Guardar' : 'Crear factura'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
