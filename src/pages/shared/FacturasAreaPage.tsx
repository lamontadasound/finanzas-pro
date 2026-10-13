import {EditarNumeroFactura} from '../../components/facturacion/EditarNumeroFactura';
import {EliminarFacturaButton} from '../../components/facturacion/EliminarFacturaButton';
import {Link} from 'react-router-dom';
import { DriveInvoiceArchive } from '../../components/facturacion/DriveInvoiceArchive';
import { useState, useMemo } from 'react';
import { Edit2, Trash2, Search, Upload, AlertTriangle, Ban } from 'lucide-react';
import { motion } from 'framer-motion';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Switch';
import { StatCard } from '../../components/ui/StatCard';
import { MotionTabs } from '../../components/ui/MotionTabs';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { useConfirmStore } from '../../store/useConfirmStore';
import { YearQuarterMonthNav } from '../../components/ui/YearQuarterMonthNav';
import { matchesYQM, type YQMValue } from '../../components/ui/yqm';
import { BUSINESS_LINES, LINEA_IDS, type LineaId } from '../../config/businessLines';
import { lineaDeFactura } from '../../lib/contabilidad';
import { db } from '../../lib/db';
import { obtenerOCrearEmisionPendiente, limpiarEmisionPendiente } from '../../lib/emisionPendiente';
import { supabase } from '../../lib/supabase';
import { AdjuntoLocalViewer } from '../../components/facturacion/AdjuntoLocalViewer';
import { SincronizarDriveButton } from '../../components/facturacion/SincronizarDriveButton';
import { VerPdfFacturaButton } from '../../components/facturacion/VerPdfFacturaButton';
import type { Area, Factura } from '../../types';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' } as Intl.NumberFormatOptions);
const PCTS_IVA = [0, 10, 21];

const ESTADO_LABEL: Record<NonNullable<Factura['estado']>, string> = {
  borrador: 'Borrador', emitida: 'Emitida', parcialmente_cobrada: 'Parcialmente cobrada',
  cobrada: 'Cobrada', anulada: 'Anulada', pendiente_sincronizar: 'Pendiente de sincronizar',
  error_sincronizacion: 'Error de sincronización',
};

interface Props { area: Area | 'todos'; linea?: LineaId }

const EMPTY = (area: Area | 'todos'): Partial<Factura> => ({
  area: area === 'todos' ? 'montada' : area,
  tipo: 'emitida', numero: '', cliente: '', concepto: '',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  fecha: new Date().toISOString().slice(0, 10),
  pagada: false, ivaDeducible: true,
});

export const FacturasAreaPage = ({ area, linea }: Props) => {
  const puedeEmitir = useAuthStore(s=>s.canEmitirFacturas());
  const allFacturasStore = useStore((s) => s.facturas);
  const lineasVisibles = useAuthStore((s) => s.lineasVisibles());
  // Filtro de permisos (Fase F) — una factura de una línea sin permiso no
  // aparece aquí aunque el módulo Contabilidad esté activado.
  const allFacturas = useMemo(
    () => allFacturasStore.filter((f) => lineasVisibles.includes(lineaDeFactura(f)) && (!linea || lineaDeFactura(f) === linea)),
    [allFacturasStore, lineasVisibles, linea],
  );
  const facturas      = useMemo(
    () => area === 'todos' ? allFacturas : allFacturas.filter((f) => f.area === area),
    [allFacturas, area],
  );
  const addFactura    = useStore((s) => s.addFactura);
  const updateFactura = useStore((s) => s.updateFactura);
  const deleteFactura = useStore((s) => s.deleteFactura);
  const canEditModulo   = useAuthStore((s) => s.canEditModulo);
  const canDeleteModulo = useAuthStore((s) => s.canDeleteModulo);
  const canEditLinea   = useAuthStore((s) => s.canEditLinea);
  const canDeleteLinea = useAuthStore((s) => s.canDeleteLinea);
  const canRectificarFacturas = useAuthStore((s) => s.canRectificarFacturas);
  // Editar/eliminar una factura exige el módulo Y la línea de esa factura
  // en concreto — nunca uno solo de los dos.
  const canEditFactura = (f: Factura) => (!linea ? canEditModulo('contabilidad') : true) && canEditLinea(lineaDeFactura(f));
  const canDeleteFactura = (f: Factura) => (!linea ? canDeleteModulo('contabilidad') : true) && canDeleteLinea(lineaDeFactura(f));
  const showConfirm = useConfirmStore((s) => s.show);

  const [origen, setOrigen] = useState<'drive'|'app'>('app');
  const [tab, setTab] = useState<'emitida' | 'recibida'>('emitida');
  const [filterLinea, setFilterLinea] = useState<LineaId | 'todas'>('todas');
  const [filterEstado, setFilterEstado] = useState<Factura['estado'] | 'todos'>('todos');
  const [filterSync, setFilterSync] = useState<Factura['syncEstado'] | 'todos'|'pendientes'>('todos');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Factura | null>(null);
  const [form, setForm]           = useState<Partial<Factura>>(EMPTY(area));
  const [duplicadoAviso, setDuplicadoAviso] = useState(false);
  const [rectificando, setRectificando] = useState<Factura | null>(null);
  const [nav, setNav] = useState<YQMValue>({ year: null, trimestre: null, month: null });


  const delTab = useMemo(() => {
    let list = facturas.filter((f) => f.tipo === tab && !f.ocultaEn);
    if (filterLinea !== 'todas') list = list.filter((f) => lineaDeFactura(f) === filterLinea);
    return list;
  }, [facturas, tab, filterLinea]);

  const navItems = useMemo(() => delTab.map((f) => ({ fecha: f.fecha, total: f.baseImponible })), [delTab]);

  type SortKey = 'fecha' | 'numero' | 'cliente' | 'total';
  const [sortKey, setSortKey] = useState<SortKey>('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');


  const filtered = useMemo(() => {
    let list = delTab.filter((f) => matchesYQM(f.fecha, nav));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.numero.toLowerCase().includes(q) || f.cliente.toLowerCase().includes(q) || f.concepto.toLowerCase().includes(q));
    }
    if (filterEstado !== 'todos') list = list.filter((f) => (f.estado ?? 'emitida') === filterEstado);
    if (filterSync !== 'todos') list = list.filter((f) => filterSync==='pendientes'?!!f.numeroSecuencial&&!f.driveFileId&&f.estado!=='anulada':(f.syncEstado ?? 'sin_sincronizar') === filterSync);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'total') return (a.total - b.total) * dir;
      return a[sortKey].localeCompare(b[sortKey]) * dir;
    });
  }, [delTab, nav, search, sortKey, sortDir, filterEstado, filterSync]);

  const totalEmitidas   = facturas.filter((f) => f.tipo === 'emitida' && f.estado !== 'anulada' && f.estado !== 'borrador').reduce((a, f) => a + f.total, 0);
  const totalRecibidas  = facturas.filter((f) => f.tipo === 'recibida').reduce((a, f) => a + f.total, 0);
  const ivaRepercutido  = facturas.filter((f) => f.tipo === 'emitida' && f.estado !== 'anulada' && f.estado !== 'borrador').reduce((a, f) => a + f.importeIVA, 0);
  const ivaSoportado    = facturas.filter((f) => f.tipo === 'recibida' && f.ivaDeducible).reduce((a, f) => a + f.importeIVA, 0);
  const pendientes      = facturas.filter((f) => !f.pagada && f.estado !== 'anulada' && f.estado !== 'borrador').length;
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

  const openEdit = (f: Factura) => { setEditing(f); setForm({ ...f }); setDuplicadoAviso(false); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const save = async () => {
    if (!form.numero || !form.cliente || !form.area) return;
    const esDuplicado = checkDuplicado(form.numero, form.area, form.tipo ?? 'emitida', editing?.id);
    if (esDuplicado) { setDuplicadoAviso(true); return; }
    if (editing) {
      if (!await updateFactura(editing.id, form)) return;
    } else {
      if (!await addFactura({ ...EMPTY(area), ...form, id: uid(), createdAt: new Date().toISOString() } as Factura)) return;
    }
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
          <p className="text-sm text-gray-500">Registradas en la app · Emitidas: {fmt(totalEmitidas)} · Recibidas: {fmt(totalRecibidas)}</p>
        </div>

      </div>

      {tab==='emitida'&&puedeEmitir&&linea&&<div><Link className="inline-flex rounded-xl bg-gold-500 text-white px-4 py-2" to={linea?`${BUSINESS_LINES[linea].routeBase}/generar-facturas`:'/contabilidad/facturas'}>Generar factura</Link></div>}
      {/* KPIs de facturas registradas */}
      {tab === 'emitida' && origen === 'app' && <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="IVA repercutido" value={ivaRepercutido} format={fmt} />
        <StatCard label="IVA soportado" value={ivaSoportado} format={fmt} />
        <StatCard label="Diferencia IVA" value={ivaRepercutido - ivaSoportado} format={fmt} tone={ivaRepercutido - ivaSoportado >= 0 ? 'default' : 'danger'} />
        <StatCard label="Pendientes / Pagadas" value={pendientes} format={() => `${pendientes} / ${cobradasPagadas}`} />
      </div>

      </>}
      {tab==='emitida'&&origen==='app'&&<div className="rounded-2xl bg-blue-50 p-4 flex flex-wrap justify-between gap-3"><strong>Creadas en la app</strong><span>{delTab.filter(f=>f.numeroSecuencial&&!f.driveFileId&&f.estado!=='anulada').length} pendientes de subir a Drive</span><button className="text-blue-700 font-medium" onClick={()=>{setFilterSync('pendientes');setNav({year:null,trimestre:null,month:null});}}>Ver pendientes</button></div>}
      {/* Tabs Ingresos/Gastos */}
      <MotionTabs
        layoutId="facturas-tab"
        value={tab}
        onChange={(v) => { setTab(v); setNav({ year: null, trimestre: null, month: null }); }}
        items={[
          { value: 'emitida', label: 'Ingresos' },
          { value: 'recibida', label: 'Gastos' },
        ]}
      />

      {tab === 'emitida' && area === 'todos' && !linea && <MotionTabs layoutId="facturas-origen" value={origen} onChange={setOrigen} items={[{value:'drive',label:'Archivo Drive'},{value:'app',label:'Creadas en la app'}]}/>}
      {tab === 'recibida' || origen === 'drive' ? <DriveInvoiceArchive key={tab} tipo={tab}/> : <>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar número, cliente…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-gold-400" />
        </div>
        <select value={filterLinea} onChange={(e) => setFilterLinea(e.target.value as LineaId | 'todas')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="todas">Todas las líneas</option>
          {LINEA_IDS.filter(id => lineasVisibles.includes(id) && (!linea || id===linea)).map((id) => <option key={id} value={id}>{BUSINESS_LINES[id].label}</option>)}
        </select>
        <select value={filterEstado ?? 'todos'} onChange={(e) => setFilterEstado(e.target.value as Factura['estado'] | 'todos')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="todos">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="emitida">Emitida</option>
          <option value="parcialmente_cobrada">Parcialmente cobrada</option>
          <option value="cobrada">Cobrada</option>
          <option value="anulada">Anulada</option>
          <option value="pendiente_sincronizar">Pendiente de sincronizar</option>
          <option value="error_sincronizacion">Error de sincronización</option>
        </select>
        <select value={filterSync ?? 'todos'} onChange={(e) => setFilterSync(e.target.value as Factura['syncEstado'] | 'todos'|'pendientes')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="todos">Drive: todos</option><option value="pendientes">Pendientes de subir</option>
          <option value="sin_sincronizar">Sin sincronizar</option>
          <option value="pendiente">Pendiente de Drive</option>
          <option value="sincronizada">Sincronizada</option>
          <option value="error">Error de sincronización</option>
        </select>
      </div>

      <YearQuarterMonthNav items={navItems} value={nav} onChange={setNav} />

      {(
      <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={<Search size={22} />} title="Sin facturas" description="Prueba a cambiar la búsqueda, la línea o el periodo." />
        ) : (
        <div className="divide-y divide-gray-100">
          <div className="p-4 flex flex-wrap gap-2 items-center justify-end text-sm">
            <label htmlFor="invoice-sort" className="text-gray-500">Ordenar por</label>
            <select id="invoice-sort" value={sortKey} onChange={e=>setSortKey(e.target.value as SortKey)} className="input-form w-auto">
              <option value="fecha">Fecha</option><option value="numero">Número</option><option value="cliente">Cliente</option><option value="total">Importe</option>
            </select>
            <Button onClick={()=>setSortDir(d=>d==='desc'?'asc':'desc')}>{sortDir==='desc'?'Descendente':'Ascendente'}</Button>
          </div>
          {filtered.map((f, idx) => <motion.article key={f.id} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.15,delay:Math.min(idx,12)*.015}} className="p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-gray-500">{f.numero ? `Factura ${f.numero}` : 'Borrador'} · {f.fecha}</p>
                <h2 className="font-semibold text-gray-900 break-words">{f.cliente}</h2>
                <p className="text-sm text-gray-500 break-words">{f.concepto}</p>
              </div>
              <div className="text-right shrink-0 space-y-2">
                <p className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums">{fmt(f.total)}</p>
                <Badge tone={f.estado==='anulada'||f.estado==='borrador'?'neutral':f.pagada?'success':f.estado==='parcialmente_cobrada'?'warning':'danger'}>{ESTADO_LABEL[f.estado ?? (f.pagada?'cobrada':'emitida')]}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>{BUSINESS_LINES[lineaDeFactura(f)].label}</span>
              {f.emisorSnapshot && <span>{f.emisorSnapshot.razonSocial}</span>}
              <span>Base {fmt(f.baseImponible)} · IVA {fmt(f.importeIVA)}</span>
              {f.porcentajeFacturado!=null && <span>{f.porcentajeFacturado}% facturado</span>}
              {f.estado!=='anulada' && f.estado!=='borrador' && <span>Pendiente {fmt(Math.max(0,f.total-(f.pagada?f.total:f.pagosRecibidos??0)))}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {f.tipo==='emitida' && f.numeroSecuencial!=null && <><EditarNumeroFactura factura={f}/><VerPdfFacturaButton key={f.numero} factura={f}/></>}
              {f.documentoId && <AdjuntoLocalViewer documentoId={f.documentoId} nombre={`factura-${f.numero||f.id}`}/>}
              {(f.documentoId || f.numeroSecuencial!=null) && <SincronizarDriveButton factura={f}/>}
              {canEditFactura(f) && f.numeroSecuencial==null && (f.tipo==='emitida'?<Link className="px-3 py-2 text-sm border rounded-xl" to={`${BUSINESS_LINES[lineaDeFactura(f)].routeBase}/generar-facturas?borrador=${encodeURIComponent(f.id)}`}>Editar borrador</Link>:<Button icon={<Edit2 size={14}/>} onClick={()=>openEdit(f)}>Editar</Button>)}
              {canEditFactura(f) && canRectificarFacturas() && f.tipo==='emitida' && f.estado!=='anulada' && f.numeroSecuencial!=null && <Button icon={<Ban size={14}/>} onClick={()=>setRectificando(f)}>Rectificar</Button>}
              {canDeleteFactura(f) && f.tipo==='emitida' && f.numeroSecuencial!=null && <EliminarFacturaButton factura={f}/>}
              {canDeleteFactura(f) && f.numeroSecuencial==null && <Button variant="danger" icon={<Trash2 size={14}/>} onClick={()=>showConfirm('¿Eliminar este registro? Esta acción no elimina archivos de Drive.',()=>deleteFactura(f.id))}>Eliminar</Button>}
            </div>
          </motion.article>)}
        </div>
        )}
      </div>
      )}

      </>}
      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar factura' : 'Nueva factura'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-form">Área *</label>
              <select value={form.area ?? 'montada'} onChange={(e) => setField('area', e.target.value)} className="input-form">
                <option value="montada">La Montada Sound</option>
                <option value="dj">DJs</option>
              </select>
            </div>
            <div>
              <label className="label-form">Línea de negocio</label>
              <select value={form.lineaNegocio ?? ''} onChange={(e) => setField('lineaNegocio', e.target.value)} className="input-form">
                {lineasVisibles.filter(id=>!linea||id===linea).map(id=><option key={id} value={id}>{BUSINESS_LINES[id].label}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">El registro se guarda en esta línea de negocio.</p>
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
            <div className="col-span-2 flex items-center gap-8">
              <Switch checked={!!form.ivaDeducible} onChange={(v) => setField('ivaDeducible', v)} label="IVA deducible" />
              <Switch checked={!!form.enviada} onChange={(v) => setField('enviada', v)} label="Enviada al cliente" />
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
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button variant="primary" onClick={save} className="flex-1">{editing ? 'Guardar' : 'Crear factura'}</Button>
          </div>
        </div>
      </Modal>

      {rectificando && (
        <RectificarFacturaModal factura={rectificando} onClose={() => setRectificando(null)} />
      )}
    </div>
  );
};

// ── Rectificación de una factura emitida ─────────────────────────────────
// Reemplaza el antiguo "Anular" de un solo clic: una factura fiscal ya
// emitida no se borra ni se reescribe — se anula formalmente Y se emite una
// factura rectificativa enlazada, con su propio número nuevo, en una sola
// operación atómica en el servidor (RPC `crear_factura_rectificativa`,
// preparado, no desplegado todavía). El motivo es obligatorio y queda en el
// historial de ambas facturas.
function RectificarFacturaModal({ factura, onClose }: { factura: Factura; onClose: () => void }) {
  const ingreso = useStore((s) => s.ingresos.find((i) => i.id === factura.ingresoId));
  // CORRECCIÓN: el permiso fino "rectificar" (global) tampoco basta solo —
  // se cruza con el permiso de EDITAR la línea de negocio de esta factura,
  // igual que ya exige el botón que abre este modal (`canEditFactura`).
  // El servidor repite el mismo cruce (`has_facturacion_perm` +
  // `has_line_perm` dentro de `crear_factura_rectificativa`).
  const tienePermisoRectificarGlobal = useAuthStore((s) => s.canRectificarFacturas());
  const canEditLineaFactura = useAuthStore((s) => s.canEditLinea);
  const canRectificarFacturas = tienePermisoRectificarGlobal && canEditLineaFactura(lineaDeFactura(factura));
  // CORRECCIÓN: el emisor de una rectificativa debe ser el MISMO que el de
  // la factura ORIGINAL, congelado en `emisorSnapshot` en el momento en que
  // se emitió — nunca se re-resuelve por la asignación ACTUAL de la línea,
  // que puede haber cambiado desde entonces (p.ej. si el proyecto se
  // reasignó a otro emisor después de emitir la original, la rectificativa
  // seguiría yendo, incorrectamente, al emisor nuevo en vez de continuar la
  // numeración/identidad fiscal de la factura que corrige).
  const [nuevaId] = useState(() => obtenerOCrearEmisionPendiente('rectificar:'+factura.id, uid));
  const [motivo, setMotivo] = useState('');
  const [importe, setImporte] = useState(0); // importe de la rectificación (0 = anula el importe completo)
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const nuevaBase = round2(importe / (1 + factura.porcentajeIVA / 100));
  const nuevoIva = round2(importe - nuevaBase);
  // BUG CORREGIDO: la rectificativa debe llevar su propio `porcentajeFacturado`
  // — antes no se enviaba y quedaba en NULL/0, con lo que una rectificación
  // PARCIAL perdía por completo el rastro del importe corregido (dejaba de
  // contar como facturado, en vez de contar el importe corregido). Se
  // calcula igual que en una emisión normal: importe corregido / total del
  // ingreso. Si no se encuentra el ingreso (no debería pasar), se usa 0 para
  // no inventar un porcentaje y forzar que se revise manualmente.
  const nuevoPorcentaje = ingreso && ingreso.total > 0 ? round2((importe / ingreso.total) * 100) : 0;

  const confirmar = async () => {
    setError(null);
    if (!canRectificarFacturas) { setError('No tienes permiso para rectificar facturas.'); return; }
    if (!motivo.trim()) { setError('El motivo de la rectificación es obligatorio.'); return; }
    setGuardando(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('crear_factura_rectificativa', {
        p_original_id: factura.id, p_motivo: motivo, p_nueva_factura_id: nuevaId,
        p_base_imponible: nuevaBase, p_porcentaje_iva: factura.porcentajeIVA,
        p_importe_iva: nuevoIva, p_total: importe, p_porcentaje_facturado: nuevoPorcentaje,
      });
      if (rpcError) {
        setError(`No se pudo rectificar: ${rpcError.message}. Reintenta para comprobar el resultado del mismo intento.`);
        return;
      }
      const numero = Array.isArray(data) ? data[0]?.numero_emitido : data?.numero_emitido;
      const [original, rectificativa] = await Promise.all([db.facturas.getById(factura.id), db.facturas.getById(nuevaId)]);
      useStore.setState(state => ({ facturas: [...state.facturas.filter(f => f.id!==original.id && f.id!==rectificativa.id), original, rectificativa] }));
      limpiarEmisionPendiente('rectificar:'+factura.id);
      setOk(`Factura ${factura.numero} rectificada${ingreso?` (${nuevoPorcentaje}% del ingreso)`:''}. Nueva factura rectificativa emitida con el número ${numero}.`);
    } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo confirmar la rectificación.'); } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Rectificar factura ${factura.numero}`} size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Esta factura quedará anulada de forma trazable y se emitirá una <strong>factura rectificativa</strong> enlazada,
          con su propio número nuevo — nunca se sobrescribe ni se reutiliza el número original.
        </p>
        <div>
          <label className="label-form">Motivo de la rectificación *</label>
          <textarea className="input-form" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: error en el importe, cambio de cliente, servicio no prestado…" />
        </div>
        <div>
          <label className="label-form">Nuevo importe total (€) — 0 si se anula por completo</label>
          <input type="number" step="0.01" className="input-form" value={importe} onChange={(e) => setImporte(parseFloat(e.target.value) || 0)} />
          {ingreso && (
            <p className="text-xs text-gray-400 mt-1">
              Equivale al <strong>{nuevoPorcentaje}%</strong> del ingreso ({fmt(ingreso.total)}) — este es el porcentaje que
              quedará facturado tras la rectificación, ni más ni menos.
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        {ok && <p className="text-sm text-accent-600 bg-accent-50 rounded-lg px-3 py-2">{ok}</p>}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cerrar</Button>
          <Button variant="primary" onClick={confirmar} disabled={guardando || !!ok || !canRectificarFacturas || !ingreso || importe < 0 || importe > factura.total} className="flex-1">
            {guardando ? 'Rectificando…' : !canRectificarFacturas ? 'Sin permiso para rectificar' : 'Confirmar rectificación'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

