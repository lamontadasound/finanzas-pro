import {BUSINESS_LINES} from '../../config/businessLines';
import {lineaDeIngreso} from '../../lib/contabilidad';
import {useNavigate} from 'react-router-dom';
import {EventExpenseVatFields} from '../../components/forms/EventExpenseVatFields';
import {IngresoRentabilidad} from '../../components/lineas/IngresoRentabilidad';
import {ingresoRentabilidad} from '../../lib/ingresoRentabilidad';
import { EventExpensePaymentFields } from '../../components/forms/EventExpensePaymentFields';
import { EventCategoryField } from '../../components/forms/EventCategoryField';
import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Folder, ChevronRight } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { pendienteDe } from '../../lib/contabilidad';
import { PageHeader, Metric, Btn, FormGroup, Field, Chips, ToggleCard } from '../../components/kit';
import { YearGrid, MonthGrid, IngresoRows } from '../../components/ingresos/IngresosViews';
import { MESES_FULL, ESTADO_LABEL } from '../../components/ingresos/estado';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { Switch } from '../../components/ui/Switch';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Area, Ingreso, PaymentMethod, PaymentStatus, GastoEvento, GastoEventoCategoria, PagadoPor, Suplido } from '../../types';
import type { LineaId } from '../../config/businessLines';
import { resolveLinea } from '../../config/resolveLinea';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' } as Intl.NumberFormatOptions);

const PCTS_IVA = [0, 10, 21];

// ── Formulario de ingresos: listas cerradas específicas de este formulario ──
const TIPOS_EVENTO_FORM = ['Boda', 'Fiesta', 'Alquiler', 'Evento corporativo', 'Real Madrid', 'DJ Session'];
const LINEAS_NEGOCIO = ['La Montada Sound', 'DJs', 'Real Madrid'] as const;
const ESTADOS_FORM: PaymentStatus[] = ['pendiente', 'parcial', 'pagado'];
const METODOS_FORM: PaymentMethod[] = ['transferencia', 'tarjeta', 'efectivo'];
const METODO_LABEL: Record<string, string> = { transferencia: 'Transferencia', tarjeta: 'Tarjeta', efectivo: 'Efectivo', bizum: 'Bizum' };
const LINEA_LABEL: Record<string, string> = { montada_sound: 'La Montada Sound', dj: 'DJ', real_madrid: 'Real Madrid', montada_installations: 'Instalaciones' };
const PAGADORES: PagadoPor[] = ['La Montada', 'Julia', 'Rodrigo', 'Julia y Rodrigo', 'Marco'];



const suplidoPendiente = (s: Suplido) => Math.max(0, s.importe - (s.cantidadRecuperada ?? 0));

interface Props {
  area: Area;
  /** Fase D: separa DJ de Real Madrid dentro de `area='dj'` (comparten
   *  tabla hoy). Usa `resolveLinea` — compatibilidad temporal mientras la
   *  migración de `linea_negocio` no esté ejecutada. */
  filterLinea?: LineaId;
  tituloOverride?: string;
}

const TIPOS_EVENTO_REAL_MADRID = ['real_madrid', 'Evento', 'Servicio', 'Otro'] as const;
const TIPO_EVENTO_RM_LABEL: Record<string, string> = { real_madrid: 'Partido', Evento: 'Evento', Servicio: 'Servicio', Otro: 'Otro' };

const EMPTY = (area: Area, filterLinea?: LineaId): Partial<Ingreso> => ({
  area,
  concepto: '', cliente: '', empresa: false,
  tipoEvento: filterLinea === 'real_madrid' ? 'real_madrid' : TIPOS_EVENTO_FORM[0],
  fechaEvento: new Date().toISOString().slice(0, 10),
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  metodoPago: 'transferencia', estadoPago: 'pendiente', pagosRecibidos: 0,
  facturaEmitida: false, notas: '', sinFactura: false,
  lineaNegocio: filterLinea ?? (area === 'montada' ? 'montada_sound' : 'dj'),
  tieneReserva: false, reserva: 0,
});

// Estado automático según importe cobrado: pendiente / parcial / pagado
const calcularEstado = (total: number, cobrado: number): PaymentStatus => {
  if (cobrado <= 0) return 'pendiente';
  if (cobrado < total) return 'parcial';
  return 'pagado';
};

export const IngresosPage = ({ area, filterLinea, tituloOverride }: Props) => {
  const allIngresos  = useStore((s) => s.ingresos);
  const isRealMadrid = filterLinea === 'real_madrid';
  const ingresos     = useMemo(
    () => allIngresos.filter((i) => i.area === area && (!filterLinea || resolveLinea({ id: i.id, area: i.area, tipoEvento: i.tipoEvento, lineaNegocio: i.lineaNegocio }) === filterLinea)),
    [allIngresos, area, filterLinea],
  );
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const addGastoEvento = useStore((s) => s.addGastoEvento);
  const allSuplidos = useStore((s) => s.suplidos);
  const addSuplido    = useStore((s) => s.addSuplido);
  const updateSuplido = useStore((s) => s.updateSuplido);
  const deleteSuplido  = useStore((s) => s.deleteSuplido);
  const addIngreso   = useStore((s) => s.addIngreso);
  const updateIngreso = useStore((s) => s.updateIngreso);
  const deleteIngreso = useStore((s) => s.deleteIngreso);
  // Fase F: permiso real por línea, no por AreaKey legado — imprescindible
  // para Real Madrid, que comparte area='dj' con DJ pero es una línea
  // distinta con su propio permiso.
  const permLinea = filterLinea ?? (area === 'montada' ? 'montada_sound' : 'dj');
  const canCreateLinea = useAuthStore((s) => s.canCreateLinea);
  const canEditLinea    = useAuthStore((s) => s.canEditLinea);
  const canDeleteLinea  = useAuthStore((s) => s.canDeleteLinea);
  const canCreate    = () => canCreateLinea(permLinea);
  const canEdit      = () => canEditLinea(permLinea);
  const canDelete    = () => canDeleteLinea(permLinea);

  const [detailId,setDetailId]=useState<string|null>(null);
  const detailIngreso=ingresos.find(i=>i.id===detailId);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Ingreso | null>(null);
  const [form, setForm]           = useState<Partial<Ingreso>>(EMPTY(area, filterLinea));
  const [gastoTarget, setGastoTarget] = useState<Ingreso | null>(null);
  const [mostrarSuplidosForm, setMostrarSuplidosForm] = useState(false);
  const [showSuplidoFormModal, setShowSuplidoFormModal] = useState(false);
  const [editingSuplidoForm, setEditingSuplidoForm] = useState<Suplido | null>(null);
  const [suplidoFormData, setSuplidoFormData] = useState<Partial<Suplido>>({});
  const [gastoForm, setGastoForm] = useState<{ concepto: string; categoria: GastoEventoCategoria; estadoPago?: GastoEvento['estadoPago']; metodoPago?: GastoEvento['metodoPago']; pagadoPor: PagadoPor; importe: number; fecha: string; numeroFactura?: string; baseImponible?: number; porcentajeIVA?: number; importeIVA?: number; totalConIva?: number }>({ concepto: '', categoria: 'DJ', estadoPago: 'pendiente', pagadoPor: 'La Montada', importe: 0, fecha: new Date().toISOString().slice(0, 10) });
  const showConfirm = useConfirmStore((s) => s.show);

  // ── Suplidos por cobrar (solo DJs) ────────────────────────────────────────
  const suplidosArea = useMemo(() => allSuplidos.filter((s) => s.area === area), [allSuplidos, area]);
  const totalSuplidosPendientes = useMemo(
    () => suplidosArea.filter((s) => s.estado !== 'cobrado').reduce((a, s) => a + suplidoPendiente(s), 0),
    [suplidosArea],
  );
  const [showSuplidosListado, setShowSuplidosListado] = useState(false);
  const [filtroSupAnio, setFiltroSupAnio] = useState<number | ''>('');
  const [filtroSupMes, setFiltroSupMes] = useState<number | ''>('');
  const [filtroSupCliente, setFiltroSupCliente] = useState('');
  const [filtroSupActuacion, setFiltroSupActuacion] = useState('');
  const [filtroSupEstado, setFiltroSupEstado] = useState<'' | 'pendiente' | 'cobrado'>('');

  const suplidosListado = useMemo(() => {
    return suplidosArea
      .map((s) => ({ suplido: s, ingreso: ingresos.find((i) => i.id === s.ingresoId) }))
      .filter(({ suplido: s, ingreso: i }) => {
        const d = new Date(s.fecha);
        if (filtroSupAnio !== '' && d.getFullYear() !== filtroSupAnio) return false;
        if (filtroSupMes !== '' && d.getMonth() !== filtroSupMes) return false;
        if (filtroSupCliente && i?.cliente !== filtroSupCliente) return false;
        if (filtroSupActuacion && i?.id !== filtroSupActuacion) return false;
        if (filtroSupEstado && (s.estado ?? 'pendiente') !== filtroSupEstado) return false;
        return true;
      })
      .sort((a, b) => b.suplido.fecha.localeCompare(a.suplido.fecha));
  }, [suplidosArea, ingresos, filtroSupAnio, filtroSupMes, filtroSupCliente, filtroSupActuacion, filtroSupEstado]);

  const clientesConSuplidos = useMemo(
    () => Array.from(new Set(suplidosArea.map((s) => ingresos.find((i) => i.id === s.ingresoId)?.cliente).filter((c): c is string => !!c))).sort(),
    [suplidosArea, ingresos],
  );

  // ── Navegación por Año → Mes (carpetas) ──────────────────────────────────
  const [selectedYear, setSelectedYear]   = useState<number | null>(() => {
    const now = new Date().getFullYear();
    return allIngresos.some((i) => i.area === area && new Date(i.fechaEvento).getFullYear() === now) ? now : null;
  });
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const anios = useMemo(() => {
    const map = new Map<number, { count: number; total: number }>();
    ingresos.forEach((i) => {
      const y = new Date(i.fechaEvento).getFullYear();
      const cur = map.get(y) ?? { count: 0, total: 0 };
      map.set(y, { count: cur.count + 1, total: cur.total + i.baseImponible });
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [ingresos]);

  const totalAnio = useMemo(() => {
    if (selectedYear == null) return 0;
    return ingresos.filter((i) => new Date(i.fechaEvento).getFullYear() === selectedYear).reduce((a, i) => a + i.baseImponible, 0);
  }, [ingresos, selectedYear]);

  const totalMes = useMemo(() => {
    if (selectedYear == null || selectedMonth == null) return 0;
    return ingresos.filter((i) => {
      const d = new Date(i.fechaEvento);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    }).reduce((a, i) => a + i.baseImponible, 0);
  }, [ingresos, selectedYear, selectedMonth]);


  const enElMes = useMemo(() => {
    if (selectedYear == null || selectedMonth == null) return [];
    return ingresos.filter((i) => {
      const d = new Date(i.fechaEvento);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [ingresos, selectedYear, selectedMonth]);

  const filtered = useMemo(
    () => [...enElMes].sort((a, b) => a.fechaEvento.localeCompare(b.fechaEvento)),
    [enElMes],
  );

  const beneficioMes = useMemo(
    () => enElMes.reduce((a, i) => a + ingresoRentabilidad(i, allGastosEvento).beneficio, 0),
    [enElMes, allGastosEvento],
  );

  const resumenAnios = useMemo(() => anios.map(([year, d]) => {
    const months = Array(12).fill(0) as number[];
    ingresos.forEach((i) => {
      const dt = new Date(i.fechaEvento);
      if (dt.getFullYear() === year) months[dt.getMonth()] += i.baseImponible;
    });
    return { year, count: d.count, total: d.total, months };
  }), [anios, ingresos]);

  const delAnio = useMemo(
    () => (selectedYear == null ? [] : ingresos.filter((i) => new Date(i.fechaEvento).getFullYear() === selectedYear)),
    [ingresos, selectedYear],
  );
  const totalAnioConIva = delAnio.reduce((a, i) => a + i.total, 0);
  const pendienteAnio = delAnio.reduce((a, i) => a + pendienteDe(i), 0);
  const countAnio = delAnio.length;
  const resumenMeses = useMemo(() => {
    const out = Array.from({ length: 12 }, () => ({ count: 0, total: 0, pendiente: 0 }));
    delAnio.forEach((i) => {
      const m = new Date(i.fechaEvento).getMonth();
      out[m].count += 1; out[m].total += i.baseImponible; out[m].pendiente += pendienteDe(i);
    });
    return out;
  }, [delAnio]);


  const openNew = () => {
    setEditing(null);
    setForm(EMPTY(area, filterLinea));
    setMostrarSuplidosForm(false);
    setShowModal(true);
  };
  const openEdit = (i: Ingreso) => {
    setEditing(i);
    setForm({ ...i });
    setMostrarSuplidosForm(allSuplidos.some((s) => s.ingresoId === i.id));
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  // ── Suplidos del ingreso actual (solo DJs) ────────────────────────────────
  const suplidosDelIngreso = useMemo(
    () => editing ? allSuplidos.filter((s) => s.ingresoId === editing.id) : [],
    [allSuplidos, editing],
  );
  const totalesSuplidosIngreso = useMemo(() => ({
    adelantado: suplidosDelIngreso.reduce((a, s) => a + s.importe, 0),
    recuperado: suplidosDelIngreso.reduce((a, s) => a + (s.cantidadRecuperada ?? 0), 0),
    pendiente: suplidosDelIngreso.reduce((a, s) => a + suplidoPendiente(s), 0),
  }), [suplidosDelIngreso]);

  const toggleSuplidos = (activar: boolean) => {
    if (!activar && suplidosDelIngreso.length > 0) {
      showConfirm(
        `Hay ${suplidosDelIngreso.length} suplido(s) registrados en esta actuación. Si seleccionas "No" se eliminarán. ¿Continuar?`,
        () => { suplidosDelIngreso.forEach((s) => deleteSuplido(s.id)); setMostrarSuplidosForm(false); },
      );
      return;
    }
    setMostrarSuplidosForm(activar);
  };

  const openNewSuplidoForm = () => {
    if (!editing) return;
    setEditingSuplidoForm(null);
    setSuplidoFormData({ ingresoId: editing.id, area, cliente: editing.cliente, concepto: '', importe: 0, fecha: new Date().toISOString().slice(0, 10), estado: 'pendiente', cantidadRecuperada: 0, metodoPago: 'transferencia', justificante: false });
    setShowSuplidoFormModal(true);
  };
  const openEditSuplidoForm = (s: Suplido) => { setEditingSuplidoForm(s); setSuplidoFormData({ ...s }); setShowSuplidoFormModal(true); };
  const closeSuplidoFormModal = () => { setShowSuplidoFormModal(false); setEditingSuplidoForm(null); };
  const saveSuplidoForm = async () => {
    if (!editing || !suplidoFormData.concepto || (suplidoFormData.importe ?? 0) <= 0) return;
    if (editingSuplidoForm) {
      if (!await updateSuplido(editingSuplidoForm.id, suplidoFormData)) return;
    } else {
      if (!await addSuplido({
        id: uid(), area, ingresoId: editing.id, cliente: editing.cliente,
        concepto: suplidoFormData.concepto ?? '', importe: suplidoFormData.importe ?? 0,
        fecha: suplidoFormData.fecha ?? new Date().toISOString().slice(0, 10),
        estado: suplidoFormData.estado ?? 'pendiente', cantidadRecuperada: suplidoFormData.cantidadRecuperada ?? 0,
        fechaCobro: suplidoFormData.fechaCobro, observaciones: suplidoFormData.observaciones,
        metodoPago: 'transferencia', justificante: false, createdAt: new Date().toISOString(),
      } as Suplido)) return;
    }
    closeSuplidoFormModal();
  };

  const setField = (k: keyof Ingreso, v: unknown) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'baseImponible' || k === 'porcentajeIVA') {
        const base = Number(next.baseImponible ?? 0);
        const pct  = Number(next.porcentajeIVA ?? 21);
        const iva  = Math.round(base * pct) / 100;
        next.importeIVA = iva;
        next.total      = base + iva;
      }
      if (k === 'baseImponible' || k === 'porcentajeIVA' || k === 'pagosRecibidos' || k === 'reserva' || k === 'tieneReserva') {
        const cobradoTotal = Number(next.pagosRecibidos ?? 0) + (next.tieneReserva ? Number(next.reserva ?? 0) : 0);
        next.estadoPago = calcularEstado(Number(next.total ?? 0), cobradoTotal);
      }
      return next;
    });
  };

  const save = async () => {
    if (!form.concepto || !form.cliente) return;
    if (editing) {
      if (!await updateIngreso(editing.id, form)) return;
    } else {
      if (!await addIngreso({ ...EMPTY(area, filterLinea), ...form, id: uid(), createdAt: new Date().toISOString() } as Ingreso)) return;
    }
    closeModal();
  };

  // ── Gasto asociado directamente a un ingreso (Añadir gasto) ──
  const openGasto = (i: Ingreso) => {
    setGastoTarget(i);
    setGastoForm({ concepto: '', categoria: 'DJ', estadoPago: 'pendiente', pagadoPor: 'La Montada', importe: 0, fecha: new Date().toISOString().slice(0, 10) });
  };
  const closeGasto = () => setGastoTarget(null);
  const saveGasto = async () => {
    if (!gastoTarget || !gastoForm.concepto || gastoForm.importe <= 0) return;
    if (!await addGastoEvento({
      id: uid(),
      ingresoId: gastoTarget.id,
      area,
      fecha: gastoForm.fecha,
      concepto: gastoForm.concepto,
      categoria: gastoForm.categoria,
      estadoPago: gastoForm.estadoPago,
      metodoPago: gastoForm.metodoPago,
      pagadoPor: gastoForm.pagadoPor,
      importe: gastoForm.importe,
      numeroFactura: gastoForm.numeroFactura,
      baseImponible: gastoForm.baseImponible,
      porcentajeIVA: gastoForm.porcentajeIVA,
      importeIVA: gastoForm.importeIVA,
      totalConIva: gastoForm.totalConIva,
      createdAt: new Date().toISOString(),
    } as GastoEvento)) return;
    closeGasto();
  };



  const navigate=useNavigate();
  const canInvoice=useAuthStore(s=>s.canEmitirFacturas());
  const invoiceFromIncome=(i:Ingreso)=>navigate(BUSINESS_LINES[lineaDeIngreso(i)].routeBase+'/generar-facturas?ingreso='+encodeURIComponent(i.id));
  const actionsFor = (i: Ingreso) => [
    ...(canInvoice&&useAuthStore.getState().canCreateLinea(lineaDeIngreso(i))&&useAuthStore.getState().canViewSeccion(lineaDeIngreso(i),'facturas')?[{label:'Generar factura',onClick:()=>invoiceFromIncome(i)}]:[]),
    ...(canEdit() ? [{ label: 'Editar', icon: <Edit2 size={13} />, onClick: () => openEdit(i) }] : []),
    ...(canDelete() ? [{ label: 'Eliminar', icon: <Trash2 size={13} />, danger: true, onClick: () => showConfirm('¿Eliminar este ingreso? No se puede deshacer.', () => deleteIngreso(i.id)) }] : []),
  ];

  return (
    <div>
      <PageHeader title={selectedMonth != null && selectedYear != null ? `${MESES_FULL[selectedMonth]} ${selectedYear}` : selectedYear != null ? String(selectedYear) : (tituloOverride ?? 'Ingresos')}>
        {area === 'dj' && !isRealMadrid && (
          <button onClick={() => setShowSuplidosListado(true)} className="btn btn-secondary">
            Suplidos por cobrar <span className={`num ${totalSuplidosPendientes > 0 ? 'text-[#c26a00]' : ''}`}>{fmt(totalSuplidosPendientes)}</span>
          </button>
        )}
        {canCreate() && (
          <Btn variant="primary" onClick={openNew}><Plus size={16} strokeWidth={2.4} />Nuevo ingreso</Btn>
        )}
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
        resumenAnios.length === 0
          ? <EmptyState icon={<Folder size={22} />} title="Sin ingresos registrados todavía" />
          : <YearGrid years={resumenAnios} onOpen={(y) => { setSelectedYear(y); setSelectedMonth(null); }} />
      )}

      {selectedYear != null && selectedMonth == null && (
        <>
          <div className="bento mb-4">
            <Metric label="Sin IVA" value={totalAnio} />
            <Metric label="Con IVA" value={totalAnioConIva} delay={0.03} />
            <Metric label="Por cobrar" value={pendienteAnio} delay={0.06} tone={pendienteAnio > 0 ? 'warning' : 'neutral'} />
            <Metric label="Eventos" value={countAnio} kind="count" delay={0.09} />
          </div>
          <MonthGrid year={selectedYear} months={resumenMeses} onOpen={setSelectedMonth} />
        </>
      )}

      {selectedYear != null && selectedMonth != null && (
        <>
          <div className="bento mb-4">
            <Metric label="Sin IVA" value={totalMes} />
            <Metric label="Con IVA" value={enElMes.reduce((a, i) => a + i.total, 0)} delay={0.03} />
            <Metric label="Beneficio" value={beneficioMes} delay={0.06} tone={beneficioMes >= 0 ? 'positive' : 'negative'} />
            <Metric label="Por cobrar" value={enElMes.reduce((a, i) => a + pendienteDe(i), 0)} delay={0.09} />
          </div>
          {filtered.length === 0
            ? <EmptyState icon={<Folder size={22} />} title="Sin ingresos este mes" />
            : <IngresoRows
                items={filtered}
                gastosEvento={allGastosEvento}
                onOpen={(i) => setDetailId(i.id)}
                onAddGasto={canCreate() ? openGasto : undefined}
                actionsFor={actionsFor}
              />}
        </>
      )}

      {detailIngreso&&<IngresoRentabilidad onGenerateInvoice={canInvoice&&useAuthStore.getState().canCreateLinea(lineaDeIngreso(detailIngreso))&&useAuthStore.getState().canViewSeccion(lineaDeIngreso(detailIngreso),'facturas')?()=>invoiceFromIncome(detailIngreso):undefined} ingreso={detailIngreso} gastos={allGastosEvento} onClose={()=>setDetailId(null)} onAddExpense={canCreate()?()=>{setDetailId(null);openGasto(detailIngreso);}:undefined}/>}
      {/* Modal edición */}
      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar evento' : 'Nuevo ingreso'} size="lg">
        <FormGroup title="Evento">
          <Field label="Concepto" wide>
            <input value={form.concepto ?? ''} onChange={(e) => setField('concepto', e.target.value)} className="input-form" placeholder="Boda Laura y Pablo" />
          </Field>
          <Field label="Cliente">
            <input value={form.cliente ?? ''} onChange={(e) => setField('cliente', e.target.value)} className="input-form" />
          </Field>
          <Field label="Fecha del evento">
            <input type="date" value={form.fechaEvento ?? ''} onChange={(e) => setField('fechaEvento', e.target.value)} className="input-form" />
          </Field>
          <div className="field field-wide">
            <span className="field-label">Tipo de evento</span>
            {isRealMadrid ? (
              <Chips label="Tipo de evento" value={String(form.tipoEvento ?? 'real_madrid')} onChange={(v) => setField('tipoEvento', v)}
                options={TIPOS_EVENTO_REAL_MADRID.map((t) => ({ value: t, label: TIPO_EVENTO_RM_LABEL[t] }))} />
            ) : (
              <Chips label="Tipo de evento" value={String(form.tipoEvento ?? TIPOS_EVENTO_FORM[0])} onChange={(v) => setField('tipoEvento', v)}
                options={[...TIPOS_EVENTO_FORM, ...(form.tipoEvento && !TIPOS_EVENTO_FORM.includes(form.tipoEvento) ? [form.tipoEvento] : [])].map((t) => ({ value: t, label: t }))} />
            )}
          </div>
          <Field label="Línea de negocio">
            {filterLinea || area === 'montada' ? (
              <div className="readout">{LINEA_LABEL[String(form.lineaNegocio ?? '')] ?? form.lineaNegocio ?? 'La Montada Sound'}</div>
            ) : (
              <select value={form.lineaNegocio ?? 'DJs'} onChange={(e) => setField('lineaNegocio', e.target.value as Ingreso['lineaNegocio'])} className="input-form">
                {LINEAS_NEGOCIO.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
          </Field>
          {area === 'dj' && !isRealMadrid && (
            <Field label="DJ relacionado">
              <input value={form.djRelacionado ?? ''} onChange={(e) => setField('djRelacionado', e.target.value)} className="input-form" />
            </Field>
          )}
        </FormGroup>

        <FormGroup title="Importe">
          <Field label="Base imponible">
            <input type="number" inputMode="decimal" step="0.01" value={form.baseImponible ?? 0} onChange={(e) => setField('baseImponible', parseFloat(e.target.value) || 0)} className="input-form num" />
          </Field>
          <div className="field">
            <span className="field-label">IVA</span>
            <Chips label="IVA" value={Number(form.porcentajeIVA ?? 21)} onChange={(v) => setField('porcentajeIVA', v)}
              options={PCTS_IVA.map((p) => ({ value: p, label: `${p}%` }))} />
          </div>
          <Field label="Total con IVA" wide>
            <div className="readout readout-lg">{fmt(form.total ?? 0)}</div>
          </Field>
        </FormGroup>

        <FormGroup title="Cobro">
          <Field label="Estado del pago">
            <select value={form.estadoPago} onChange={(e) => setField('estadoPago', e.target.value)} className="input-form">
              {(ESTADOS_FORM.includes(form.estadoPago as PaymentStatus) ? ESTADOS_FORM : [form.estadoPago as PaymentStatus, ...ESTADOS_FORM]).map((st) => <option key={st} value={st}>{ESTADO_LABEL[st] ?? st}</option>)}
            </select>
          </Field>
          <Field label="Pendiente de cobro">
            <div className="readout">{fmt(form.estadoPago === 'pagado' ? 0 : Math.max(0, (form.total ?? 0) - (form.pagosRecibidos ?? 0) - (form.tieneReserva ? (form.reserva ?? 0) : 0)))}</div>
          </Field>
          <ToggleCard
            label="Reserva"
            checked={!!form.tieneReserva}
            onChange={(tiene) => {
              setField('tieneReserva', tiene);
              if (!tiene) {
                setField('reserva', 0);
                setField('fechaCobroReserva', undefined);
                setField('metodoPagoReserva', undefined);
              }
            }}
          >
            <Field label="Cantidad pagada">
              <input type="number" inputMode="decimal" step="0.01" value={form.reserva ?? 0} onChange={(e) => setField('reserva', parseFloat(e.target.value) || 0)} className="input-form num" />
            </Field>
<Field label="IVA de la reserva"><select className="input-form" value={form.reservaIncluyeIva==null?'':String(form.reservaIncluyeIva)} onChange={e=>setField('reservaIncluyeIva',e.target.value===''?undefined:e.target.value==='true')}><option value="">Sin indicar</option><option value="true">Con IVA</option><option value="false">Sin IVA</option></select></Field>
            <Field label="Fecha del cobro">
              <input type="date" value={form.fechaCobroReserva ?? ''} onChange={(e) => setField('fechaCobroReserva', e.target.value)} className="input-form" />
            </Field>
            <Field label="Método">
              <select value={form.metodoPagoReserva ?? ''} onChange={(e) => setField('metodoPagoReserva', e.target.value || undefined)} className="input-form">
                <option value="">—</option>
                {METODOS_FORM.map((m) => <option key={m} value={m}>{METODO_LABEL[m] ?? m}</option>)}
              </select>
            </Field>
            <Field label="Importe pendiente">
              <div className="readout">{fmt(form.estadoPago === 'pagado' ? 0 : Math.max(0, (form.total ?? 0) - (form.pagosRecibidos ?? 0) - (form.reserva ?? 0)))}</div>
            </Field>
          </ToggleCard>
<Field label="IVA del pago restante"><select className="input-form" value={form.restanteIncluyeIva==null?'':String(form.restanteIncluyeIva)} onChange={e=>setField('restanteIncluyeIva',e.target.value===''?undefined:e.target.value==='true')}><option value="">Sin indicar</option><option value="true">Con IVA</option><option value="false">Sin IVA</option></select></Field>
          <p className="field-hint field-wide">Indica cómo se acordó cada cobro. La cantidad pagada es el importe recibido; esta etiqueta no cambia el IVA de la factura.</p>
          <Field label="Fecha del pago">
            <input type="date" value={form.fechaPago ?? ''} onChange={(e) => setField('fechaPago', e.target.value)} className="input-form" />
          </Field>
          <Field label="Método del pago restante">
            <select value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className="input-form">
              {(METODOS_FORM.includes(form.metodoPago as PaymentMethod) ? METODOS_FORM : [form.metodoPago as PaymentMethod, ...METODOS_FORM]).map((m) => <option key={m} value={m}>{METODO_LABEL[m] ?? m}</option>)}
            </select>
          </Field>
          {(form.pagosRecibidos ?? 0) > 0 && (
            <p className="field-hint field-wide">Incluye {fmt(form.pagosRecibidos ?? 0)} registrados en Pagos.</p>
          )}
            {area === 'dj' && !isRealMadrid && (
              <div className="field-wide space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Suplidos</p>
                <div>
                  <Switch label="¿Hay suplidos?" checked={mostrarSuplidosForm} onChange={toggleSuplidos} />
                </div>
                {mostrarSuplidosForm && (
                  !editing ? (
                    <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl px-4 py-3">Guarda primero el ingreso para poder añadir suplidos.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div><p className="text-xs text-gray-500">Total adelantado</p><p className="font-semibold text-gray-900">{fmt(totalesSuplidosIngreso.adelantado)}</p></div>
                        <div><p className="text-xs text-gray-500">Total recuperado</p><p className="font-semibold text-accent-700">{fmt(totalesSuplidosIngreso.recuperado)}</p></div>
                        <div><p className="text-xs text-gray-500">Pendiente de cobrar</p><p className={`font-semibold ${totalesSuplidosIngreso.pendiente > 0 ? 'text-gold-700' : 'text-gray-800'}`}>{fmt(totalesSuplidosIngreso.pendiente)}</p></div>
                      </div>
                      <div className="flex justify-end">
                        <Button type="button" size="sm" variant="primary" icon={<Plus size={12} />} onClick={openNewSuplidoForm}>Añadir suplido</Button>
                      </div>
                      {suplidosDelIngreso.length > 0 && (
                        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
                          {suplidosDelIngreso.map((s) => (
                            <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 truncate">{s.concepto} <span className="text-gray-400 font-normal">· {s.fecha}</span></p>
                                <p className="text-xs text-gray-400">{fmt(s.importe)} adelantado · {fmt(s.cantidadRecuperada ?? 0)} recuperado · <span className={s.estado === 'cobrado' ? 'text-emerald-700' : 'text-red-700'}>{s.estado === 'cobrado' ? 'Cobrado' : 'Pendiente'}</span></p>
                              </div>
                              <button type="button" onClick={() => openEditSuplidoForm(s)} className="p-1 text-gray-400 hover:text-gold-500"><Edit2 size={13} /></button>
                              <button type="button" onClick={() => showConfirm('¿Eliminar este suplido?', () => deleteSuplido(s.id))} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )
                )}
                <p className="text-[11px] text-gray-400">Los suplidos son dinero adelantado que el cliente devuelve — no afectan a ingresos, IVA, gastos, beneficio ni reserva. Solo aparecen en "Suplidos por cobrar".</p>
              </div>
            )}

        </FormGroup>

        <FormGroup title="Factura">
          <div className="field field-wide">
            <Chips
              label="Factura"
              value={form.facturaEmitida ? 'emitida' : form.sinFactura ? 'no' : 'pendiente'}
              onChange={(v) => {
                setField('facturaEmitida', v === 'emitida');
                setField('sinFactura', v === 'no');
              }}
              options={[
                { value: 'pendiente', label: 'Sin emitir' },
                { value: 'emitida', label: 'Factura emitida' },
                { value: 'no', label: 'No factura' },
              ]}
            />
          </div>
          {form.facturaEmitida && (
            <>
              <Field label="Nº de factura">
                <input value={form.numeroFactura ?? ''} onChange={(e) => setField('numeroFactura', e.target.value)} className="input-form num" placeholder="LMS-2026-001" />
              </Field>
              <Field label="Fecha de la factura">
                <input type="date" value={form.fechaFactura ?? ''} onChange={(e) => setField('fechaFactura', e.target.value)} className="input-form" />
              </Field>
            </>
          )}
          <Field label="Notas" wide>
            <textarea value={form.notas ?? ''} onChange={(e) => setField('notas', e.target.value)} rows={2} className="input-form resize-none" />
          </Field>
        </FormGroup>

        <div className="sheet-actions">
          <Btn variant="secondary" size="lg" onClick={closeModal}>Cancelar</Btn>
          <Btn variant="primary" size="lg" onClick={save} disabled={!form.concepto || !form.cliente}>
            {editing ? 'Guardar' : 'Añadir ingreso'}
          </Btn>
        </div>
      </Modal>

      {/* Modal: Añadir gasto asociado directamente al ingreso */}
      <Modal isOpen={!!gastoTarget} onClose={closeGasto} title={gastoTarget ? `Añadir gasto — ${gastoTarget.concepto}` : 'Añadir gasto'} size="sm">
        {gastoTarget && (
          <div className="space-y-4">
            <div>
              <label className="label-form">Concepto *</label>
              <input value={gastoForm.concepto} onChange={(e) => setGastoForm((f) => ({ ...f, concepto: e.target.value }))} className="input-form" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <EventExpensePaymentFields value={gastoForm} onChange={patch => setGastoForm(f => f ? {...f,...patch} : f)} />
              <div>
                <label className="label-form">Categoría</label>
                <EventCategoryField value={gastoForm.categoria} onChange={categoria => setGastoForm({...gastoForm,categoria})} />
              </div>
              <EventExpenseVatFields value={gastoForm} onChange={patch=>setGastoForm(f=>f?{...f,...patch}:f)}/>

              <div>
                <label className="label-form">Fecha</label>
                <input type="date" value={gastoForm.fecha} onChange={(e) => setGastoForm((f) => ({ ...f, fecha: e.target.value }))} className="input-form" />
              </div>
              <div>
                <label className="label-form">Nº de factura <span className="text-ink-4 font-normal">(si la hay)</span></label>
                <input value={gastoForm.numeroFactura ?? ''} onChange={(e) => setGastoForm((f) => ({ ...f, numeroFactura: e.target.value || undefined }))} className="input-form" />
              </div>
              <div>
                <label className="label-form">Pagado por</label>
                <select value={gastoForm.pagadoPor} onChange={(e) => setGastoForm((f) => ({ ...f, pagadoPor: e.target.value as PagadoPor }))} className="input-form">
                  {PAGADORES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Este gasto quedará vinculado a este ingreso y aparecerá automáticamente en {area === 'montada' ? '"Gastos de eventos"' : '"Gastos de actuación"'} y en el cálculo de beneficio de este ingreso.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={closeGasto} className="flex-1">Cancelar</Button>
              <Button variant="primary" onClick={saveGasto} className="flex-1">Añadir gasto</Button>
            </div>
          </div>
        )}
      </Modal>

      {area === 'dj' && !isRealMadrid && (
        <Modal isOpen={showSuplidosListado} onClose={() => setShowSuplidosListado(false)} title="Suplidos por cobrar" size="lg">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <select value={filtroSupAnio} onChange={(e) => setFiltroSupAnio(e.target.value ? Number(e.target.value) : '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
                <option value="">Todos los años</option>
                {Array.from(new Set(suplidosArea.map((s) => new Date(s.fecha).getFullYear()))).sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={filtroSupMes} onChange={(e) => setFiltroSupMes(e.target.value !== '' ? Number(e.target.value) : '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
                <option value="">Todos los meses</option>
                {MESES_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={filtroSupCliente} onChange={(e) => setFiltroSupCliente(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
                <option value="">Todos los clientes</option>
                {clientesConSuplidos.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filtroSupActuacion} onChange={(e) => setFiltroSupActuacion(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
                <option value="">Todas las actuaciones</option>
                {ingresos.map((i) => <option key={i.id} value={i.id}>{i.concepto}</option>)}
              </select>
              <select value={filtroSupEstado} onChange={(e) => setFiltroSupEstado(e.target.value as '' | 'pendiente' | 'cobrado')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
                <option value="">Pendiente y cobrado</option>
                <option value="pendiente">Solo pendiente</option>
                <option value="cobrado">Solo cobrado</option>
              </select>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Actuación</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Concepto</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Adelantado</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Recuperado</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                      <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {suplidosListado.length === 0 ? (
                      <tr><td colSpan={11} className="text-center py-8 text-gray-400 text-sm">Sin suplidos registrados</td></tr>
                    ) : suplidosListado.map(({ suplido: s, ingreso: i }) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{i?.concepto ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">{i?.cliente ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{s.fecha}</td>
                        <td className="px-4 py-2.5 text-gray-600">{s.concepto}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-800">{fmt(s.importe)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600">{fmt(s.cantidadRecuperada ?? 0)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">{fmt(suplidoPendiente(s))}</td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge tone={s.estado === 'cobrado' ? 'success' : 'danger'}>{s.estado === 'cobrado' ? 'Cobrado' : 'Pendiente'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: añadir/editar un suplido del ingreso actual */}
      <Modal isOpen={showSuplidoFormModal} onClose={closeSuplidoFormModal} title={editingSuplidoForm ? 'Editar suplido' : 'Nuevo suplido'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-form">Concepto *</label>
              <input value={suplidoFormData.concepto ?? ''} onChange={(e) => setSuplidoFormData((f) => ({ ...f, concepto: e.target.value }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Cantidad adelantada (€) *</label>
              <input type="number" step="0.01" value={suplidoFormData.importe ?? 0} onChange={(e) => setSuplidoFormData((f) => ({ ...f, importe: parseFloat(e.target.value) || 0 }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fecha del adelanto</label>
              <input type="date" value={suplidoFormData.fecha ?? ''} onChange={(e) => setSuplidoFormData((f) => ({ ...f, fecha: e.target.value }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Estado</label>
              <select value={suplidoFormData.estado ?? 'pendiente'} onChange={(e) => setSuplidoFormData((f) => ({ ...f, estado: e.target.value as Suplido['estado'] }))} className="input-form">
                <option value="pendiente">Pendiente de cobrar</option>
                <option value="cobrado">Cobrado</option>
              </select>
            </div>
            <div>
              <label className="label-form">Cantidad recuperada (€)</label>
              <input type="number" step="0.01" value={suplidoFormData.cantidadRecuperada ?? 0} onChange={(e) => setSuplidoFormData((f) => ({ ...f, cantidadRecuperada: parseFloat(e.target.value) || 0 }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fecha de cobro</label>
              <input type="date" value={suplidoFormData.fechaCobro ?? ''} onChange={(e) => setSuplidoFormData((f) => ({ ...f, fechaCobro: e.target.value }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Suplido pendiente</label>
              <div className="input-form bg-gray-50 text-gray-700 font-semibold">{fmt(Math.max(0, (suplidoFormData.importe ?? 0) - (suplidoFormData.cantidadRecuperada ?? 0)))}</div>
            </div>
            <div className="col-span-2">
              <label className="label-form">Observaciones</label>
              <textarea value={suplidoFormData.observaciones ?? ''} onChange={(e) => setSuplidoFormData((f) => ({ ...f, observaciones: e.target.value }))} rows={2} className="input-form" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Este suplido no se sumará como ingreso ni como gasto — solo se usa para controlar dinero pendiente de recuperar.</p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeSuplidoFormModal} className="flex-1">Cancelar</Button>
            <Button variant="primary" onClick={saveSuplidoForm} className="flex-1">{editingSuplidoForm ? 'Guardar' : 'Añadir suplido'}</Button>
          </div>
        </div>
      </Modal>


    </div>
  );
};
