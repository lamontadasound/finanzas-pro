import { useState, useMemo, useRef } from 'react';
import {
  Plus, Edit2, Trash2, Search, Upload, Folder, ChevronLeft,
  FileText, Download, RefreshCw, BarChart3, List, CheckCircle2,
} from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import { subirDocumento, obtenerUrlFirmada, eliminarArchivoStorage, StorageUploadError } from '../../lib/storage';
import type { InversionArea, Equipo, PaymentMethod, Ingreso, Gasto, GastoEvento } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const pctFmt = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`;

const CATEGORIAS_EQUIPO = ['Sonido', 'Iluminación', 'Pantallas', 'Decoración', 'Mesas de Mezclas', 'Mesas Sonido', 'Dispositivos', 'Cabinas', 'Micrófonos', 'Flightcase'];
const METODOS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'bizum', 'otro'];
const PCTS_IVA = [0, 10, 21];

const AREA_LABEL: Record<InversionArea, string> = {
  montada: 'La Montada Sound',
  dj: 'DJs',
  real_madrid: 'DJ Personal (Real Madrid)',
};

interface Props { area: InversionArea | 'todos' }

const EMPTY = (area: InversionArea | 'todos'): Partial<Equipo> => ({
  area: area === 'todos' ? 'montada' : area, nombre: '', categoria: 'Sonido',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  fechaCompra: new Date().toISOString().slice(0, 10),
  facturaRecibida: false, financiado: false, cantidad: 1,
});

// Fin de garantía calculado siempre a partir de fecha de compra + meses de garantía,
// para que la cuenta atrás avance sola conforme pasa el tiempo desde la compra.
const calcularFinGarantia = (fechaCompra?: string, garantiaMeses?: number): string | undefined => {
  if (!fechaCompra || !garantiaMeses) return undefined;
  const fin = new Date(fechaCompra);
  fin.setMonth(fin.getMonth() + garantiaMeses);
  return fin.toISOString().slice(0, 10);
};

const garantiaEstado = (e: Equipo): { label: string; color: string; detalle: string } => {
  const fechaFin = calcularFinGarantia(e.fechaCompra, e.garantia) ?? e.fechaFinGarantia;
  if (!fechaFin) return { label: 'Sin garantía', color: 'bg-gray-100 text-gray-500', detalle: '' };
  const fin = new Date(fechaFin);
  const hoy = new Date();
  const diasRestantes = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diasRestantes < 0) return { label: 'Vencida', color: 'bg-red-100 text-red-600', detalle: `hace ${Math.abs(diasRestantes)} días` };
  if (diasRestantes < 60) return { label: 'Próxima a vencer', color: 'bg-amber-100 text-amber-700', detalle: `quedan ${diasRestantes} días` };
  return { label: 'Activa', color: 'bg-green-100 text-green-700', detalle: `quedan ${diasRestantes} días` };
};

const cantidadDe = (e: Equipo) => e.cantidad ?? 1;
const costeTotalConIva = (e: Equipo) => e.total * cantidadDe(e);
const baseTotalSinIva  = (e: Equipo) => e.baseImponible * cantidadDe(e);
const ivaTotal         = (e: Equipo) => e.importeIVA * cantidadDe(e);

// ── Amortización contable: depreciación del valor del equipo según su vida útil.
// No tiene relación con ingresos ni beneficio comercial — es puramente contable.
const amortizacionAnual = (e: Equipo) => (e.vidaUtil && e.vidaUtil > 0) ? baseTotalSinIva(e) / e.vidaUtil : 0;
const porcentajeAnual = (e: Equipo) => (e.vidaUtil && e.vidaUtil > 0) ? 100 / e.vidaUtil : 0;
const aniosTranscurridos = (e: Equipo) => Math.max(0, (Date.now() - new Date(e.fechaCompra).getTime()) / (1000 * 60 * 60 * 24 * 365));
const valorAmortizadoContable = (e: Equipo) => {
  const anual = amortizacionAnual(e);
  if (!anual) return 0;
  return Math.min(baseTotalSinIva(e), anual * aniosTranscurridos(e));
};
const valorContablePendiente = (e: Equipo) => Math.max(0, baseTotalSinIva(e) - valorAmortizadoContable(e));

export const InversionesPage = ({ area }: Props) => {
  const allEquipo    = useStore((s) => s.equipo);
  const equipo       = useMemo(() => area === 'todos' ? allEquipo : allEquipo.filter((e) => e.area === area), [allEquipo, area]);
  const addEquipo    = useStore((s) => s.addEquipo);
  const updateEquipo = useStore((s) => s.updateEquipo);
  const deleteEquipo = useStore((s) => s.deleteEquipo);
  const ingresos      = useStore((s) => s.ingresos);
  const gastos        = useStore((s) => s.gastos);
  const gastosEvento   = useStore((s) => s.gastosEvento);
  const documentos     = useStore((s) => s.documentos);
  const addDocumento    = useStore((s) => s.addDocumento);
  const deleteDocumento = useStore((s) => s.deleteDocumento);
  const canCreate = useAuthStore((s) => s.canCreate);
  const canEdit   = useAuthStore((s) => s.canEdit);
  const canDelete = useAuthStore((s) => s.canDelete);
  const currentUser = useAuthStore((s) => s.user);
  const showConfirm = useConfirmStore((s) => s.show);

  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState<InversionArea | 'todos'>('todos');
  const [filterGarantia, setFilterGarantia] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Equipo | null>(null);
  const [form, setForm]           = useState<Partial<Equipo>>(EMPTY(area));
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const [vista, setVista] = useState<'equipo' | 'rentabilidad'>('equipo');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = equipo.filter((e) => e.nombre.toLowerCase().includes(q) || e.categoria.toLowerCase().includes(q) || (e.marca ?? '').toLowerCase().includes(q));
    if (area === 'todos' && filterArea !== 'todos') list = list.filter((e) => e.area === filterArea);
    if (filterGarantia) list = list.filter((e) => garantiaEstado(e).label === filterGarantia);
    return list.sort((a, b) => b.fechaCompra.localeCompare(a.fechaCompra));
  }, [equipo, search, area, filterArea, filterGarantia]);

  const carpetasCategoria = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    filtered.forEach((e) => {
      const cur = map.get(e.categoria) ?? { count: 0, total: 0 };
      map.set(e.categoria, { count: cur.count + cantidadDe(e), total: cur.total + costeTotalConIva(e) });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [filtered]);

  const enCategoria = useMemo(
    () => selectedCategoria ? filtered.filter((e) => e.categoria === selectedCategoria) : filtered,
    [filtered, selectedCategoria],
  );

  const totalInvertido = enCategoria.reduce((a, e) => a + costeTotalConIva(e), 0);
  const totalAmortizado = enCategoria.reduce((a, e) => a + valorAmortizadoContable(e), 0);

  const setField = (k: keyof Equipo, v: unknown) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'baseImponible' || k === 'porcentajeIVA') {
        const base = Number(next.baseImponible ?? 0);
        const pct  = Number(next.porcentajeIVA ?? 21);
        const iva  = Math.round(base * pct) / 100;
        next.importeIVA = iva;
        next.total      = base + iva;
      }
      if (k === 'fechaCompra' || k === 'garantia') {
        next.fechaFinGarantia = calcularFinGarantia(next.fechaCompra, next.garantia);
      }
      return next;
    });
  };

  const openNew = () => { setEditing(null); setForm(EMPTY(area)); setSubidaOk(false); setShowModal(true); };
  const openEdit = (e: Equipo) => { setEditing(e); setForm({ ...e }); setSubidaOk(false); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const save = () => {
    if (!form.nombre) return;
    if (editing) {
      updateEquipo(editing.id, form);
    } else {
      addEquipo({ ...EMPTY(area), ...form, id: uid(), createdAt: new Date().toISOString() } as Equipo);
    }
    closeModal();
  };

  // ── Factura de compra (documento único por inversión) ───────────────────────
  const facturaDelEquipo = useMemo(
    () => editing ? documentos.find((d) => d.entityType === 'equipo' && d.entityId === editing.id && d.tipo === 'factura') : undefined,
    [documentos, editing],
  );
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState('');
  const [subidaOk, setSubidaOk] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const subirFactura = async (file: File) => {
    if (!editing) return;
    setSubiendo(true);
    setErrorSubida('');
    setSubidaOk(false);
    try {
      const doc = await subirDocumento({
        file, entityType: 'equipo', entityId: editing.id, area: editing.area === 'real_madrid' ? 'montada' : editing.area,
        tipo: 'factura', subidoPor: currentUser?.id ?? '', subidoPorNombre: currentUser?.nombre ?? '',
      });
      if (facturaDelEquipo) {
        await eliminarArchivoStorage(facturaDelEquipo.storageKey).catch(() => {});
        deleteDocumento(facturaDelEquipo.id);
      }
      addDocumento(doc);
      setSubidaOk(true);
    } catch (err) {
      const msg = err instanceof StorageUploadError ? err.message : 'Error inesperado al subir el archivo.';
      setErrorSubida(msg);
    } finally {
      setSubiendo(false);
    }
  };

  const verFactura = async () => {
    if (!facturaDelEquipo) return;
    try {
      const url = await obtenerUrlFirmada(facturaDelEquipo.storageKey);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setErrorSubida('No se pudo abrir el documento.');
    }
  };

  const eliminarFactura = async () => {
    if (!facturaDelEquipo) return;
    await eliminarArchivoStorage(facturaDelEquipo.storageKey).catch(() => {});
    deleteDocumento(facturaDelEquipo.id);
    setSubidaOk(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inversiones y equipos</h1>
          <p className="text-sm text-gray-500">{enCategoria.length} items · Invertido: {fmt(totalInvertido)} · Amortizado: {fmt(totalAmortizado)}</p>
        </div>
        {canCreate('inversiones') && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors">
            <Plus size={16} /> Añadir equipo
          </button>
        )}
      </div>

      {area === 'todos' && (
        <div className="flex gap-2 border-b border-gray-200">
          <button onClick={() => setVista('equipo')} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'equipo' ? 'border-amber-500 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            <List size={14} /> Equipo
          </button>
          <button onClick={() => setVista('rentabilidad')} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'rentabilidad' ? 'border-amber-500 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            <BarChart3 size={14} /> Rentabilidad global de las inversiones
          </button>
        </div>
      )}

      {vista === 'rentabilidad' && area === 'todos' ? (
        <RentabilidadGlobal equipo={allEquipo} ingresos={ingresos} gastos={gastos} gastosEvento={gastosEvento} />
      ) : (
      <>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar equipo, categoría o marca…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-amber-400" />
        </div>
        {area === 'todos' && (
          <select value={filterArea} onChange={(e) => setFilterArea(e.target.value as InversionArea | 'todos')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="todos">Todas las áreas</option>
            <option value="montada">La Montada Sound</option>
            <option value="real_madrid">DJ Personal (Real Madrid)</option>
          </select>
        )}
        <select value={filterGarantia} onChange={(e) => setFilterGarantia(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Toda garantía</option>
          <option value="Activa">Activa</option>
          <option value="Próxima a vencer">Próxima a vencer</option>
          <option value="Vencida">Vencida</option>
          <option value="Sin garantía">Sin garantía</option>
        </select>
      </div>

      {/* Breadcrumb navegación por categoría */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => setSelectedCategoria(null)} className={`font-medium ${selectedCategoria == null ? 'text-gray-900' : 'text-amber-600 hover:text-amber-500'}`}>Categorías</button>
        {selectedCategoria != null && (
          <>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-900">{selectedCategoria}</span>
          </>
        )}
      </div>

      {/* Nivel 1: carpetas por categoría */}
      {selectedCategoria == null ? (
        carpetasCategoria.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">Sin equipos registrados</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {carpetasCategoria.map(([cat, data]) => (
              <button key={cat} onClick={() => setSelectedCategoria(cat)} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <Folder size={16} className="text-amber-500" />
                  <span className="font-bold text-gray-900">{cat}</span>
                </div>
                <p className="text-xs text-gray-500">{data.count} unidades</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
              </button>
            ))}
          </div>
        )
      ) : (
      <>
      <button onClick={() => setSelectedCategoria(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a categorías</button>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                {area === 'todos' && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Área</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha compra</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total con IVA</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amortizado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor pendiente</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Garantía</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enCategoria.length === 0 ? (
                <tr><td colSpan={area === 'todos' ? 9 : 8} className="text-center py-12 text-gray-400 text-sm">Sin equipos registrados</td></tr>
              ) : enCategoria.map((e) => {
                const gar = garantiaEstado(e);
                return (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{e.nombre}</p>
                    {(e.marca || e.numeroSerie) && <p className="text-xs text-gray-400">{[e.marca, e.numeroSerie && `S/N: ${e.numeroSerie}`].filter(Boolean).join(' · ')}</p>}
                  </td>
                  {area === 'todos' && <td className="px-4 py-3 text-gray-500 text-xs">{AREA_LABEL[e.area]}</td>}
                  <td className="px-4 py-3 text-gray-500">{e.fechaCompra}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{cantidadDe(e)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmt(costeTotalConIva(e))}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(valorAmortizadoContable(e))}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(valorContablePendiente(e))}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gar.color}`}>{gar.label}</span>
                    {gar.detalle && <p className="text-[10px] text-gray-400 mt-0.5">{gar.detalle}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {canEdit('inversiones') && <button onClick={() => openEdit(e)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                      {canDelete('inversiones') && <button onClick={() => showConfirm('¿Eliminar este equipo?', () => deleteEquipo(e.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
      </>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar equipo' : 'Nuevo equipo'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-form">Área de la inversión *</label>
              <select value={form.area ?? 'montada'} onChange={(e) => setField('area', e.target.value)} className="input-form" disabled={area !== 'todos'}>
                <option value="montada">La Montada Sound</option>
                <option value="real_madrid">DJ Personal (Real Madrid)</option>
              </select>
            </div>
            <div className="col-span-1">
              <label className="label-form">Nombre *</label>
              <input value={form.nombre ?? ''} onChange={(e) => setField('nombre', e.target.value)} className="input-form" />
            </div>
            <div className="col-span-2">
              <label className="label-form">Descripción</label>
              <input value={form.descripcion ?? ''} onChange={(e) => setField('descripcion', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Categoría</label>
              <select value={form.categoria} onChange={(e) => setField('categoria', e.target.value)} className="input-form">
                {CATEGORIAS_EQUIPO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Cantidad</label>
              <input type="number" min={1} value={form.cantidad ?? 1} onChange={(e) => setField('cantidad', parseInt(e.target.value) || 1)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Marca</label>
              <input value={form.marca ?? ''} onChange={(e) => setField('marca', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Modelo</label>
              <input value={form.modelo ?? ''} onChange={(e) => setField('modelo', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Nº Serie</label>
              <input value={form.numeroSerie ?? ''} onChange={(e) => setField('numeroSerie', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Proveedor</label>
              <input value={form.proveedor ?? ''} onChange={(e) => setField('proveedor', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fecha compra</label>
              <input type="date" value={form.fechaCompra ?? ''} onChange={(e) => setField('fechaCompra', e.target.value)} className="input-form" />
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
              <label className="label-form">Total con IVA</label>
              <div className="input-form bg-gray-50 font-semibold text-gray-700">{fmt(form.total ?? 0)}</div>
            </div>
            <div>
              <label className="label-form">Método de pago</label>
              <select value={form.formaPago} onChange={(e) => setField('formaPago', e.target.value)} className="input-form">
                <option value="">—</option>
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Quién lo ha comprado</label>
              <input value={form.comprador ?? ''} onChange={(e) => setField('comprador', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Propietario</label>
              <input value={form.propietario ?? ''} onChange={(e) => setField('propietario', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Garantía (meses)</label>
              <input type="number" value={form.garantia ?? ''} onChange={(e) => setField('garantia', parseInt(e.target.value) || undefined)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fin garantía</label>
              <div className="input-form bg-gray-50 text-gray-700 font-semibold">
                {calcularFinGarantia(form.fechaCompra, form.garantia) ?? '—'}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Se calcula solo: fecha de compra + meses de garantía.</p>
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.facturaRecibida} onChange={(e) => setField('facturaRecibida', e.target.checked)} className="rounded" />
                Factura recibida
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.financiado} onChange={(e) => setField('financiado', e.target.checked)} className="rounded" />
                Financiado
              </label>
            </div>

            <div className="col-span-2 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Factura de compra</p>
              {!editing ? (
                <p className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">Guarda primero el equipo para poder subir la factura.</p>
              ) : (
                <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-2.5">
                  <FileText size={16} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {facturaDelEquipo ? (
                      <p className="text-sm text-gray-700 truncate">{facturaDelEquipo.nombre} <span className="text-xs text-gray-400">· subida el {new Date(facturaDelEquipo.fechaSubida).toLocaleDateString('es-ES')}</span></p>
                    ) : (
                      <p className="text-sm text-gray-400">Sin factura subida</p>
                    )}
                    {errorSubida && <p className="text-xs text-red-600 mt-0.5">{errorSubida}</p>}
                    {subidaOk && !errorSubida && <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1"><CheckCircle2 size={12} /> Factura subida correctamente</p>}
                  </div>
                  <input
                    ref={fileInput}
                    type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) subirFactura(file);
                      e.target.value = '';
                    }}
                  />
                  {facturaDelEquipo ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button" onClick={verFactura} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg" title="Ver/descargar"><Download size={14} /></button>
                      <button type="button" disabled={subiendo} onClick={() => fileInput.current?.click()} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg disabled:opacity-40" title="Sustituir"><RefreshCw size={14} className={subiendo ? 'animate-spin' : ''} /></button>
                      <button type="button" onClick={eliminarFactura} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  ) : (
                    <button type="button" disabled={subiendo} onClick={() => fileInput.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex-shrink-0">
                      <Upload size={12} /> {subiendo ? 'Subiendo…' : 'Subir'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className="label-form">Observaciones</label>
              <textarea value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} rows={2} className="input-form" />
            </div>
          </div>

          {/* ── Amortización contable ── */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Amortización contable</p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="label-form">Vida útil (años)</label>
                <input type="number" value={form.vidaUtil ?? ''} onChange={(e) => setField('vidaUtil', parseInt(e.target.value) || undefined)} className="input-form" />
              </div>
              <div>
                <label className="label-form">Base amortizable</label>
                <div className="input-form bg-gray-50 text-gray-700 font-semibold">{fmt(baseTotalSinIva(form as Equipo))}</div>
              </div>
            </div>
            {form.vidaUtil ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-xs text-gray-500">% anual</p><p className="font-semibold text-gray-800">{pctFmt(porcentajeAnual(form as Equipo))}</p></div>
                <div><p className="text-xs text-gray-500">Amortización anual</p><p className="font-semibold text-gray-800">{fmt(amortizacionAnual(form as Equipo))}</p></div>
                <div><p className="text-xs text-gray-500">Amortizado acumulado</p><p className="font-semibold text-gray-800">{editing ? fmt(valorAmortizadoContable(editing)) : '—'}</p></div>
                <div><p className="text-xs text-gray-500">Valor contable pendiente</p><p className="font-semibold text-gray-800">{editing ? fmt(valorContablePendiente(editing)) : '—'}</p></div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">Indica la vida útil (años) para calcular la amortización contable.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editing ? 'Guardar' : 'Añadir'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ── Rentabilidad de las inversiones, separada por área ────────────────────────
// "montada" usa únicamente ingresos/gastos de La Montada Sound; "real_madrid"
// usa únicamente ingresos con línea de negocio "Real Madrid" y sus gastos
// asociados. Nunca se mezclan entre sí — la vista conjunta solo suma ambos
// totales, mostrando también el desglose individual.
interface RentabilidadGlobalProps {
  equipo: Equipo[];
  ingresos: Ingreso[];
  gastos: Gasto[];
  gastosEvento: GastoEvento[];
}

const MESES_MAX_RAZONABLE = 600; // 50 años — por encima de esto, no se estima fecha
const DIVISOR_MINIMO = 1; // evita divisiones por valores prácticamente nulos

type AreaInversionVista = 'montada' | 'real_madrid';

const calcularStatsArea = (
  areaVista: AreaInversionVista,
  equipo: Equipo[], ingresos: Ingreso[], gastos: Gasto[], gastosEvento: GastoEvento[],
  filtroCategoria: string, enPeriodo: (fecha: string) => boolean,
) => {
  const equipoArea = equipo.filter((e) => e.area === areaVista && (!filtroCategoria || e.categoria === filtroCategoria) && enPeriodo(e.fechaCompra));

  const ingresosArea = areaVista === 'montada'
    ? ingresos.filter((i) => i.area === 'montada' && enPeriodo(i.fechaEvento))
    : ingresos.filter((i) => i.lineaNegocio === 'Real Madrid' && enPeriodo(i.fechaEvento));

  const ingresoIdsArea = new Set(ingresosArea.map((i) => i.id));
  const gastosDirectosArea = areaVista === 'montada'
    ? gastosEvento.filter((g) => g.area === 'montada' && enPeriodo(g.fecha))
    : gastosEvento.filter((g) => ingresoIdsArea.has(g.ingresoId) && enPeriodo(g.fecha));

  const gastosGeneralesArea = areaVista === 'montada'
    ? gastos.filter((g) => g.area === 'montada' && enPeriodo(g.fecha))
    : gastos.filter((g) => g.lineaNegocio === 'Real Madrid' && enPeriodo(g.fecha));

  const totalInvertidoSinIVA = equipoArea.reduce((a, e) => a + baseTotalSinIva(e), 0);
  const ivaSoportado = equipoArea.reduce((a, e) => a + ivaTotal(e), 0);
  const totalPagadoConIVA = totalInvertidoSinIVA + ivaSoportado;
  const totalAmortizado = equipoArea.reduce((a, e) => a + valorAmortizadoContable(e), 0);
  const valorPendienteContable = Math.max(0, totalInvertidoSinIVA - totalAmortizado);

  const ingresosSinIVA = ingresosArea.reduce((a, i) => a + i.baseImponible, 0);
  const gastosActuacion = gastosDirectosArea.reduce((a, g) => a + g.importe, 0);
  const gastosGenerales = gastosGeneralesArea.reduce((a, g) => a + g.total, 0);
  const beneficioOperativo = ingresosSinIVA - gastosActuacion - gastosGenerales;

  const pctRecuperado = totalInvertidoSinIVA > DIVISOR_MINIMO ? (beneficioOperativo / totalInvertidoSinIVA) * 100 : 0;
  const pendienteRecuperar = Math.max(0, totalInvertidoSinIVA - beneficioOperativo);
  const inversionRecuperada = Math.min(totalInvertidoSinIVA, Math.max(0, beneficioOperativo));
  const roiGlobal = totalInvertidoSinIVA > DIVISOR_MINIMO ? ((beneficioOperativo - totalInvertidoSinIVA) / totalInvertidoSinIVA) * 100 : 0;

  let fechaEstimadaRecuperacion = 'Sin datos suficientes para estimar la recuperación';
  if (totalInvertidoSinIVA > DIVISOR_MINIMO) {
    if (pendienteRecuperar <= 0) {
      fechaEstimadaRecuperacion = 'Ya recuperada';
    } else {
      const fechasCompra = equipoArea.map((e) => new Date(e.fechaCompra).getTime());
      if (fechasCompra.length) {
        const inicio = Math.min(...fechasCompra);
        const mesesTranscurridos = Math.max(1, (Date.now() - inicio) / (1000 * 60 * 60 * 24 * 30.44));
        const ratioMensual = beneficioOperativo / mesesTranscurridos;
        if (ratioMensual > 0 && isFinite(ratioMensual)) {
          const mesesRestantes = pendienteRecuperar / ratioMensual;
          if (isFinite(mesesRestantes) && mesesRestantes <= MESES_MAX_RAZONABLE) {
            const fecha = new Date();
            fecha.setDate(1);
            fecha.setMonth(fecha.getMonth() + Math.ceil(mesesRestantes));
            fechaEstimadaRecuperacion = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
          }
        }
      }
    }
  }

  return {
    numInversiones: equipoArea.length, totalInvertidoSinIVA, ivaSoportado, totalPagadoConIVA,
    totalAmortizado, valorPendienteContable, ingresosSinIVA, gastosActuacion, gastosGenerales,
    beneficioOperativo, pctRecuperado, pendienteRecuperar, inversionRecuperada, roiGlobal,
    fechaEstimadaRecuperacion,
  };
};

const RentabilidadGlobal = ({ equipo, ingresos, gastos, gastosEvento }: RentabilidadGlobalProps) => {
  const [filtroVista, setFiltroVista] = useState<'conjunta' | AreaInversionVista>('conjunta');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroAnio, setFiltroAnio] = useState<'todos' | number>('todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const categoriasDisponibles = useMemo(
    () => Array.from(new Set(equipo.filter((e) => e.area === 'montada' || e.area === 'real_madrid').map((e) => e.categoria))).sort((a, b) => a.localeCompare(b, 'es')),
    [equipo],
  );

  const aniosDisponibles = useMemo(() => {
    const set = new Set<number>();
    equipo.forEach((e) => { if (e.area === 'montada' || e.area === 'real_madrid') set.add(new Date(e.fechaCompra).getFullYear()); });
    ingresos.forEach((i) => set.add(new Date(i.fechaEvento).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [equipo, ingresos]);

  const enPeriodo = (fecha: string) => {
    if (desde && fecha < desde) return false;
    if (hasta && fecha > hasta) return false;
    if (!desde && !hasta && filtroAnio !== 'todos') return new Date(fecha).getFullYear() === filtroAnio;
    return true;
  };

  const statsMontada    = useMemo(() => calcularStatsArea('montada', equipo, ingresos, gastos, gastosEvento, filtroCategoria, enPeriodo), [equipo, ingresos, gastos, gastosEvento, filtroCategoria, filtroAnio, desde, hasta]);
  const statsRealMadrid = useMemo(() => calcularStatsArea('real_madrid', equipo, ingresos, gastos, gastosEvento, filtroCategoria, enPeriodo), [equipo, ingresos, gastos, gastosEvento, filtroCategoria, filtroAnio, desde, hasta]);

  const statsConjunta = useMemo(() => {
    const totalInvertidoSinIVA = statsMontada.totalInvertidoSinIVA + statsRealMadrid.totalInvertidoSinIVA;
    const beneficioOperativo = statsMontada.beneficioOperativo + statsRealMadrid.beneficioOperativo;
    const pctRecuperado = totalInvertidoSinIVA > DIVISOR_MINIMO ? (beneficioOperativo / totalInvertidoSinIVA) * 100 : 0;
    const roiGlobal = totalInvertidoSinIVA > DIVISOR_MINIMO ? ((beneficioOperativo - totalInvertidoSinIVA) / totalInvertidoSinIVA) * 100 : 0;
    return {
      numInversiones: statsMontada.numInversiones + statsRealMadrid.numInversiones,
      totalInvertidoSinIVA,
      ivaSoportado: statsMontada.ivaSoportado + statsRealMadrid.ivaSoportado,
      totalPagadoConIVA: statsMontada.totalPagadoConIVA + statsRealMadrid.totalPagadoConIVA,
      totalAmortizado: statsMontada.totalAmortizado + statsRealMadrid.totalAmortizado,
      valorPendienteContable: statsMontada.valorPendienteContable + statsRealMadrid.valorPendienteContable,
      beneficioOperativo,
      pendienteRecuperar: statsMontada.pendienteRecuperar + statsRealMadrid.pendienteRecuperar,
      inversionRecuperada: statsMontada.inversionRecuperada + statsRealMadrid.inversionRecuperada,
      pctRecuperado, roiGlobal,
      fechaEstimadaRecuperacion: 'Ver desglose por área',
    };
  }, [statsMontada, statsRealMadrid]);

  const stats = filtroVista === 'conjunta' ? statsConjunta : filtroVista === 'montada' ? statsMontada : statsRealMadrid;
  const AREA_VISTA_LABEL: Record<'conjunta' | AreaInversionVista, string> = {
    conjunta: 'Vista conjunta', montada: 'La Montada Sound', real_madrid: 'DJ Personal (Real Madrid)',
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">La rentabilidad se calcula por separado para cada área: nunca se mezclan los ingresos de La Montada Sound con los de DJ Personal (Real Madrid). La vista conjunta suma ambos totales, pero puedes ver el desglose individual más abajo.</p>

      <div className="flex flex-wrap gap-3">
        <select value={filtroVista} onChange={(e) => setFiltroVista(e.target.value as typeof filtroVista)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="conjunta">Vista conjunta</option>
          <option value="montada">La Montada Sound</option>
          <option value="real_madrid">DJ Personal (Real Madrid)</option>
        </select>
        <select value={filtroAnio} onChange={(e) => { setFiltroAnio(e.target.value === 'todos' ? 'todos' : Number(e.target.value)); setDesde(''); setHasta(''); }} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white" disabled={!!desde || !!hasta}>
          <option value="todos">Todos los años</option>
          {aniosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Todas las categorías</option>
          {categoriasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-gray-400">Periodo:</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-2 py-2 bg-white" />
          <span className="text-gray-300">–</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-2 py-2 bg-white" />
        </div>
      </div>

      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{AREA_VISTA_LABEL[filtroVista]}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4"><p className="text-xs text-gray-500">Total invertido sin IVA</p><p className="text-lg font-bold text-gray-900">{fmt(stats.totalInvertidoSinIVA)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4"><p className="text-xs text-gray-500">Total invertido con IVA</p><p className="text-lg font-bold text-gray-900">{fmt(stats.totalPagadoConIVA)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4"><p className="text-xs text-gray-500">Nº de inversiones</p><p className="text-lg font-bold text-gray-900">{stats.numInversiones}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4"><p className="text-xs text-gray-500">Amortización contable acumulada</p><p className="text-lg font-bold text-gray-900">{fmt(stats.totalAmortizado)}</p></div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4"><p className="text-xs text-gray-500">Valor contable pendiente</p><p className="text-lg font-bold text-gray-900">{fmt(stats.valorPendienteContable)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4"><p className="text-xs text-gray-500">Beneficio operativo (ingresos relacionados)</p><p className={`text-lg font-bold ${stats.beneficioOperativo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(stats.beneficioOperativo)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4"><p className="text-xs text-gray-500">Inversión recuperada</p><p className="text-lg font-bold text-gray-900">{fmt(stats.inversionRecuperada)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4"><p className="text-xs text-gray-500">Pendiente de recuperar</p><p className="text-lg font-bold text-gray-900">{fmt(stats.pendienteRecuperar)}</p></div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4"><p className="text-xs text-gray-500">% recuperado</p><p className={`text-lg font-bold ${stats.pctRecuperado >= 0 ? 'text-green-700' : 'text-red-600'}`}>{pctFmt(stats.pctRecuperado)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4"><p className="text-xs text-gray-500">ROI estimado</p><p className={`text-lg font-bold ${stats.roiGlobal >= 0 ? 'text-green-700' : 'text-red-600'}`}>{pctFmt(stats.roiGlobal)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 col-span-2"><p className="text-xs text-gray-500">Fecha estimada de recuperación</p><p className="text-sm font-semibold text-gray-800">{stats.fechaEstimadaRecuperacion}</p></div>
      </div>

      {filtroVista === 'conjunta' && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-800">Desglose individual por área</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Área</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Invertido s/IVA</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Amortizado</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Beneficio operativo</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Pendiente recuperar</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">% recuperado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-2.5 font-medium text-gray-800">La Montada Sound</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(statsMontada.totalInvertidoSinIVA)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(statsMontada.totalAmortizado)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${statsMontada.beneficioOperativo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(statsMontada.beneficioOperativo)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(statsMontada.pendienteRecuperar)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{pctFmt(statsMontada.pctRecuperado)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-gray-800">DJ Personal (Real Madrid)</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(statsRealMadrid.totalInvertidoSinIVA)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(statsRealMadrid.totalAmortizado)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${statsRealMadrid.beneficioOperativo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(statsRealMadrid.beneficioOperativo)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(statsRealMadrid.pendienteRecuperar)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{pctFmt(statsRealMadrid.pctRecuperado)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Beneficio operativo = ingresos sin IVA − gastos de actuación − gastos generales asignados a esa área. El IVA no se usa como ingreso ni como beneficio.
        La amortización contable y el beneficio comercial se muestran por separado y no se mezclan entre sí.
      </p>
    </div>
  );
};
