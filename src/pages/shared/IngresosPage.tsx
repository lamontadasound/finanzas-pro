import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, ChevronDown, Folder, ChevronLeft } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Area, Ingreso, PaymentMethod, PaymentStatus, GastoEvento, GastoEventoCategoria, GastoTipo, PagadoPor, Suplido } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const METODOS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'bizum', 'otro'];
const ESTADOS: PaymentStatus[] = ['presupuesto', 'pendiente', 'parcial', 'pagado', 'cancelado'];
const PCTS_IVA = [0, 10, 21];

// ── Formulario de ingresos: listas cerradas específicas de este formulario ──
const TIPOS_EVENTO_FORM = ['Boda', 'Alquiler', 'Evento corporativo', 'Real Madrid', 'DJ Session', 'Juan y Erra'];
const LINEAS_NEGOCIO = ['La Montada Sound', 'DJs', 'Real Madrid'] as const;
const ESTADOS_FORM: PaymentStatus[] = ['pendiente', 'parcial', 'pagado'];
const METODOS_FORM: PaymentMethod[] = ['transferencia', 'tarjeta', 'efectivo'];
const CAT_GASTO_EVENTO: GastoEventoCategoria[] = ['Cámara', 'DJ', 'Montador', 'Técnico', 'Decoración', 'Gasolina', 'Transporte', 'Personal', 'Alquiler', 'Proveedor', 'Otro'];
const TIPOS_GASTO_EVENTO: GastoTipo[] = ['fijo', 'variable'];
const PAGADORES: PagadoPor[] = ['La Montada', 'Julia', 'Rodrigo', 'Julia y Rodrigo', 'Marco'];

const estadoColor: Record<PaymentStatus, string> = {
  presupuesto: 'bg-gray-100 text-gray-600',
  pendiente:   'bg-amber-100 text-amber-700',
  parcial:     'bg-blue-100 text-blue-700',
  pagado:      'bg-green-100 text-green-700',
  cancelado:   'bg-red-100 text-red-600',
};

const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const suplidoPendiente = (s: Suplido) => Math.max(0, s.importe - (s.cantidadRecuperada ?? 0));

interface Props { area: Area }

const EMPTY = (area: Area): Partial<Ingreso> => ({
  area,
  concepto: '', cliente: '', empresa: false,
  tipoEvento: TIPOS_EVENTO_FORM[0], fechaEvento: new Date().toISOString().slice(0, 10),
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  metodoPago: 'transferencia', estadoPago: 'pendiente', pagosRecibidos: 0,
  facturaEmitida: false, notas: '', sinFactura: false,
  lineaNegocio: area === 'montada' ? 'La Montada Sound' : 'DJs',
  tieneReserva: false, reserva: 0,
});

// Estado automático según importe cobrado: pendiente / parcial / pagado
const calcularEstado = (total: number, cobrado: number): PaymentStatus => {
  if (cobrado <= 0) return 'pendiente';
  if (cobrado < total) return 'parcial';
  return 'pagado';
};

export const IngresosPage = ({ area }: Props) => {
  const allIngresos  = useStore((s) => s.ingresos);
  const ingresos     = useMemo(() => allIngresos.filter((i) => i.area === area), [allIngresos, area]);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const addGastoEvento = useStore((s) => s.addGastoEvento);
  const allSuplidos = useStore((s) => s.suplidos);
  const addSuplido    = useStore((s) => s.addSuplido);
  const updateSuplido = useStore((s) => s.updateSuplido);
  const deleteSuplido  = useStore((s) => s.deleteSuplido);
  const addIngreso   = useStore((s) => s.addIngreso);
  const updateIngreso = useStore((s) => s.updateIngreso);
  const deleteIngreso = useStore((s) => s.deleteIngreso);
  const canCreate    = useAuthStore((s) => s.canCreate);
  const canEdit      = useAuthStore((s) => s.canEdit);
  const canDelete    = useAuthStore((s) => s.canDelete);

  const [search, setSearch]       = useState('');
  const [filterEstado, setFilter] = useState<PaymentStatus | ''>('');
  const [filterCliente, setFilterCliente] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Ingreso | null>(null);
  const [form, setForm]           = useState<Partial<Ingreso>>(EMPTY(area));
  const [gastoTarget, setGastoTarget] = useState<Ingreso | null>(null);
  const [mostrarSuplidosForm, setMostrarSuplidosForm] = useState(false);
  const [showSuplidoFormModal, setShowSuplidoFormModal] = useState(false);
  const [editingSuplidoForm, setEditingSuplidoForm] = useState<Suplido | null>(null);
  const [suplidoFormData, setSuplidoFormData] = useState<Partial<Suplido>>({});
  const [gastoForm, setGastoForm] = useState<{ concepto: string; categoria: GastoEventoCategoria; tipo: GastoTipo; pagadoPor: PagadoPor; importe: number; fecha: string }>({ concepto: '', categoria: 'Otro', tipo: 'variable', pagadoPor: 'La Montada', importe: 0, fecha: new Date().toISOString().slice(0, 10) });
  const showConfirm = useConfirmStore((s) => s.show);
  const [sortField, setSortField] = useState<'fechaEvento' | 'total' | 'cliente'>('fechaEvento');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');

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
  const [selectedYear, setSelectedYear]   = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const anios = useMemo(() => {
    const map = new Map<number, { count: number; total: number }>();
    ingresos.forEach((i) => {
      const y = new Date(i.fechaEvento).getFullYear();
      const cur = map.get(y) ?? { count: 0, total: 0 };
      map.set(y, { count: cur.count + 1, total: cur.total + i.total });
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [ingresos]);

  const mesesDelAnio = useMemo(() => {
    if (selectedYear == null) return [];
    const map = new Map<number, { count: number; total: number }>();
    ingresos.filter((i) => new Date(i.fechaEvento).getFullYear() === selectedYear).forEach((i) => {
      const m = new Date(i.fechaEvento).getMonth();
      const cur = map.get(m) ?? { count: 0, total: 0 };
      map.set(m, { count: cur.count + 1, total: cur.total + i.total });
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [ingresos, selectedYear]);

  const totalAnio = useMemo(() => {
    if (selectedYear == null) return 0;
    return ingresos.filter((i) => new Date(i.fechaEvento).getFullYear() === selectedYear).reduce((a, i) => a + i.total, 0);
  }, [ingresos, selectedYear]);

  const totalMes = useMemo(() => {
    if (selectedYear == null || selectedMonth == null) return 0;
    return ingresos.filter((i) => {
      const d = new Date(i.fechaEvento);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    }).reduce((a, i) => a + i.total, 0);
  }, [ingresos, selectedYear, selectedMonth]);

  const clientesDisponibles = useMemo(() => Array.from(new Set(ingresos.map((i) => i.cliente).filter(Boolean))).sort(), [ingresos]);

  const enElMes = useMemo(() => {
    if (selectedYear == null || selectedMonth == null) return [];
    return ingresos.filter((i) => {
      const d = new Date(i.fechaEvento);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [ingresos, selectedYear, selectedMonth]);

  const filtered = useMemo(() => {
    let list = [...enElMes];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.concepto.toLowerCase().includes(q) || i.cliente.toLowerCase().includes(q));
    }
    if (filterEstado) list = list.filter((i) => i.estadoPago === filterEstado);
    if (filterCliente) list = list.filter((i) => i.cliente === filterCliente);
    list.sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [enElMes, search, filterEstado, filterCliente, sortField, sortDir]);

  const totalFiltrado = filtered.reduce((a, i) => a + i.total, 0);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY(area));
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
  const saveSuplidoForm = () => {
    if (!editing || !suplidoFormData.concepto || (suplidoFormData.importe ?? 0) <= 0) return;
    if (editingSuplidoForm) {
      updateSuplido(editingSuplidoForm.id, suplidoFormData);
    } else {
      addSuplido({
        id: uid(), area, ingresoId: editing.id, cliente: editing.cliente,
        concepto: suplidoFormData.concepto ?? '', importe: suplidoFormData.importe ?? 0,
        fecha: suplidoFormData.fecha ?? new Date().toISOString().slice(0, 10),
        estado: suplidoFormData.estado ?? 'pendiente', cantidadRecuperada: suplidoFormData.cantidadRecuperada ?? 0,
        fechaCobro: suplidoFormData.fechaCobro, observaciones: suplidoFormData.observaciones,
        metodoPago: 'transferencia', justificante: false, createdAt: new Date().toISOString(),
      } as Suplido);
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

  const save = () => {
    if (!form.concepto || !form.cliente) return;
    if (editing) {
      updateIngreso(editing.id, form);
    } else {
      addIngreso({ ...EMPTY(area), ...form, id: uid(), createdAt: new Date().toISOString() } as Ingreso);
    }
    closeModal();
  };

  // ── Gasto asociado directamente a un ingreso (Añadir gasto) ──
  const openGasto = (i: Ingreso) => {
    setGastoTarget(i);
    setGastoForm({ concepto: '', categoria: 'Otro', tipo: 'variable', pagadoPor: 'La Montada', importe: 0, fecha: new Date().toISOString().slice(0, 10) });
  };
  const closeGasto = () => setGastoTarget(null);
  const saveGasto = () => {
    if (!gastoTarget || !gastoForm.concepto || gastoForm.importe <= 0) return;
    addGastoEvento({
      id: uid(),
      ingresoId: gastoTarget.id,
      area,
      fecha: gastoForm.fecha,
      concepto: gastoForm.concepto,
      categoria: gastoForm.categoria,
      tipo: gastoForm.tipo,
      pagadoPor: gastoForm.pagadoPor,
      importe: gastoForm.importe,
      createdAt: new Date().toISOString(),
    } as GastoEvento);
    closeGasto();
  };
  const gastosDe = (ingresoId: string) => allGastosEvento.filter((g) => g.ingresoId === ingresoId);

  const sort = (f: typeof sortField) => {
    if (sortField === f) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(f); setSortDir('asc'); }
  };

  const SortIcon = ({ f }: { f: typeof sortField }) =>
    sortField === f ? <ChevronDown size={12} className={sortDir === 'desc' ? '' : 'rotate-180'} /> : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingresos</h1>
          <p className="text-sm text-gray-500">{filtered.length} registros · Total: {fmt(totalFiltrado)}</p>
        </div>
        <div className="flex items-center gap-3">
          {area === 'dj' && (
            <button onClick={() => setShowSuplidosListado(true)} className="text-left bg-white border border-gray-200 rounded-xl px-4 py-2 hover:border-amber-400 hover:shadow-sm transition-all">
              <p className="text-xs text-gray-500">Suplidos por cobrar</p>
              <p className={`text-sm font-bold ${totalSuplidosPendientes > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{fmt(totalSuplidosPendientes)}</p>
            </button>
          )}
          {canCreate(area) && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors"
            >
              <Plus size={16} /> Nuevo ingreso
            </button>
          )}
        </div>
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

      {/* Nivel 1: carpetas de años */}
      {selectedYear == null && (
        anios.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">Sin ingresos registrados todavía</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {anios.map(([y, data]) => (
              <button key={y} onClick={() => setSelectedYear(y)} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <Folder size={16} className="text-amber-500" />
                  <span className="text-lg font-bold text-gray-900">{y}</span>
                </div>
                <p className="text-xs text-gray-500">{data.count} ingresos</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
              </button>
            ))}
          </div>
        )
      )}

      {/* Nivel 2: carpetas de meses dentro del año */}
      {selectedYear != null && selectedMonth == null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedYear(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a años</button>
            <p className="text-sm text-gray-600">Total {selectedYear}: <span className="font-semibold text-gray-900">{fmt(totalAnio)}</span></p>
          </div>
          {mesesDelAnio.length === 0 ? (
            <p className="text-center py-16 text-gray-400 text-sm">Sin ingresos en {selectedYear}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {mesesDelAnio.map(([m, data]) => (
                <button key={m} onClick={() => setSelectedMonth(m)} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <Folder size={16} className="text-amber-500" />
                    <span className="font-bold text-gray-900">{MESES_FULL[m]}</span>
                  </div>
                  <p className="text-xs text-gray-500">{data.count} ingresos</p>
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

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar concepto o cliente…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-amber-400"
          />
        </div>
        <select
          value={filterEstado}
          onChange={(e) => setFilter(e.target.value as PaymentStatus | '')}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterCliente}
          onChange={(e) => setFilterCliente(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
        >
          <option value="">Todos los clientes</option>
          {clientesDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => sort('fechaEvento')}>
                  <span className="flex items-center gap-1">Fecha <SortIcon f="fechaEvento" /></span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Concepto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => sort('cliente')}>
                  <span className="flex items-center gap-1">Cliente <SortIcon f="cliente" /></span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Base sin IVA</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => sort('total')}>
                  <span className="flex items-center gap-1 justify-end">Total con IVA <SortIcon f="total" /></span>
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nº Factura</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">Sin resultados</td></tr>
              ) : filtered.map((i) => {
                const gastosIngreso = gastosDe(i.id);
                const totalGastosIngreso = gastosIngreso.reduce((a, g) => a + g.importe, 0);
                const beneficioIngreso = i.baseImponible - totalGastosIngreso;
                return (
                <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{i.fechaEvento}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {i.concepto}
                    {gastosIngreso.length > 0 && (
                      <p className="text-xs text-gray-400">
                        Gastos: {fmt(totalGastosIngreso)} · Beneficio: <span className={beneficioIngreso >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(beneficioIngreso)}</span>
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{i.cliente}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(i.baseImponible)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmt(i.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoColor[i.estadoPago]}`}>
                      {i.estadoPago}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {i.numeroFactura || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {canCreate(area) && (
                        <button onClick={() => openGasto(i)} className="text-xs text-amber-600 hover:text-amber-500 font-medium whitespace-nowrap mr-1">
                          + Añadir gasto
                        </button>
                      )}
                      {canEdit(area) && (
                        <button onClick={() => openEdit(i)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors">
                          <Edit2 size={13} />
                        </button>
                      )}
                      {canDelete(area) && (
                        <button onClick={() => showConfirm('¿Eliminar este ingreso? No se puede deshacer.', () => deleteIngreso(i.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
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

      {/* Modal edición */}
      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar ingreso' : 'Nuevo ingreso'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* 1. Concepto del evento */}
            <div className="col-span-2">
              <label className="label-form">Concepto del evento *</label>
              <input value={form.concepto ?? ''} onChange={(e) => setField('concepto', e.target.value)} className="input-form" placeholder="Descripción del ingreso" />
            </div>
            {/* 2. Cliente — texto libre, sin obligar a elegir uno existente */}
            <div>
              <label className="label-form">Cliente *</label>
              <input value={form.cliente ?? ''} onChange={(e) => setField('cliente', e.target.value)} className="input-form" placeholder="Nombre del cliente" />
            </div>
            {/* 3. Tipo de evento — cerrado a 3 opciones, sin vínculo a eventos existentes */}
            <div>
              <label className="label-form">Tipo de evento</label>
              <select value={form.tipoEvento ?? TIPOS_EVENTO_FORM[0]} onChange={(e) => setField('tipoEvento', e.target.value)} className="input-form">
                {TIPOS_EVENTO_FORM.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {/* Línea de negocio — campo distinto de "Tipo de evento" */}
            <div>
              <label className="label-form">Línea de negocio</label>
              <select value={form.lineaNegocio ?? (area === 'montada' ? 'La Montada Sound' : 'DJs')} onChange={(e) => setField('lineaNegocio', e.target.value as Ingreso['lineaNegocio'])} className="input-form">
                {LINEAS_NEGOCIO.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            {area === 'dj' && (
              <div>
                <label className="label-form">DJ relacionado</label>
                <input value={form.djRelacionado ?? ''} onChange={(e) => setField('djRelacionado', e.target.value)} className="input-form" placeholder="Nombre del DJ" />
              </div>
            )}
            {/* 4. Fecha del evento */}
            <div>
              <label className="label-form">Fecha del evento</label>
              <input type="date" value={form.fechaEvento ?? ''} onChange={(e) => setField('fechaEvento', e.target.value)} className="input-form" />
            </div>
            {/* 5. Base imponible */}
            <div>
              <label className="label-form">Base imponible (€)</label>
              <input type="number" step="0.01" value={form.baseImponible ?? 0} onChange={(e) => setField('baseImponible', parseFloat(e.target.value) || 0)} className="input-form" />
            </div>
            {/* 6. IVA */}
            <div>
              <label className="label-form">IVA (%)</label>
              <select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="input-form">
                {PCTS_IVA.map((p) => <option key={p} value={p}>{p}%</option>)}
              </select>
            </div>
            {/* 7. Total con IVA */}
            <div>
              <label className="label-form">Total con IVA</label>
              <div className="input-form bg-gray-50 text-gray-700 font-semibold">{fmt(form.total ?? 0)}</div>
            </div>
            {/* 8. Estado del pago — cerrado a 3 opciones (se calcula solo, editable manualmente) */}
            <div>
              <label className="label-form">Estado del pago</label>
              <select value={form.estadoPago} onChange={(e) => setField('estadoPago', e.target.value)} className="input-form">
                {(ESTADOS_FORM.includes(form.estadoPago as PaymentStatus) ? ESTADOS_FORM : [form.estadoPago as PaymentStatus, ...ESTADOS_FORM]).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {(form.pagosRecibidos ?? 0) > 0 && (
              <div className="col-span-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
                Cobrado mediante pagos registrados: <span className="font-semibold text-gray-700">{fmt(form.pagosRecibidos ?? 0)}</span> — gestiona estos pagos desde Contabilidad → Pagos recibidos.
              </div>
            )}

            {/* Reserva opcional — oculta hasta que se marque "Sí" */}
            <div className="col-span-2 border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Reserva</p>
              <div>
                <label className="label-form">¿Tiene reserva?</label>
                <select
                  value={form.tieneReserva ? 'si' : 'no'}
                  onChange={(e) => {
                    const tiene = e.target.value === 'si';
                    setField('tieneReserva', tiene);
                    if (!tiene) {
                      setField('reserva', 0);
                      setField('fechaCobroReserva', undefined);
                      setField('metodoPagoReserva', undefined);
                    }
                  }}
                  className="input-form"
                >
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              </div>
              {form.tieneReserva && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label-form">Cantidad de la reserva (€)</label>
                    <input type="number" step="0.01" value={form.reserva ?? 0} onChange={(e) => setField('reserva', parseFloat(e.target.value) || 0)} className="input-form" />
                  </div>
                  <div>
                    <label className="label-form">Fecha de cobro de la reserva</label>
                    <input type="date" value={form.fechaCobroReserva ?? ''} onChange={(e) => setField('fechaCobroReserva', e.target.value)} className="input-form" />
                  </div>
                  <div>
                    <label className="label-form">Método de pago <span className="text-gray-400 font-normal">(opcional)</span></label>
                    <select value={form.metodoPagoReserva ?? ''} onChange={(e) => setField('metodoPagoReserva', e.target.value || undefined)} className="input-form">
                      <option value="">—</option>
                      {METODOS_FORM.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Suplidos opcionales — solo DJs, no afectan a ingresos/gastos/IVA/beneficio/reserva */}
            {area === 'dj' && (
              <div className="col-span-2 border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Suplidos</p>
                <div>
                  <label className="label-form">¿Hay suplidos?</label>
                  <select value={mostrarSuplidosForm ? 'si' : 'no'} onChange={(e) => toggleSuplidos(e.target.value === 'si')} className="input-form">
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>
                {mostrarSuplidosForm && (
                  !editing ? (
                    <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl px-4 py-3">Guarda primero el ingreso para poder añadir suplidos.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div><p className="text-xs text-gray-500">Total adelantado</p><p className="font-semibold text-gray-900">{fmt(totalesSuplidosIngreso.adelantado)}</p></div>
                        <div><p className="text-xs text-gray-500">Total recuperado</p><p className="font-semibold text-green-700">{fmt(totalesSuplidosIngreso.recuperado)}</p></div>
                        <div><p className="text-xs text-gray-500">Pendiente de cobrar</p><p className={`font-semibold ${totalesSuplidosIngreso.pendiente > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{fmt(totalesSuplidosIngreso.pendiente)}</p></div>
                      </div>
                      <div className="flex justify-end">
                        <button type="button" onClick={openNewSuplidoForm} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-black text-xs font-semibold rounded-lg hover:bg-amber-400">
                          <Plus size={12} /> Añadir suplido
                        </button>
                      </div>
                      {suplidosDelIngreso.length > 0 && (
                        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
                          {suplidosDelIngreso.map((s) => (
                            <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 truncate">{s.concepto} <span className="text-gray-400 font-normal">· {s.fecha}</span></p>
                                <p className="text-xs text-gray-400">{fmt(s.importe)} adelantado · {fmt(s.cantidadRecuperada ?? 0)} recuperado · <span className={s.estado === 'cobrado' ? 'text-green-600' : 'text-amber-600'}>{s.estado === 'cobrado' ? 'Cobrado' : 'Pendiente'}</span></p>
                              </div>
                              <button type="button" onClick={() => openEditSuplidoForm(s)} className="p-1 text-gray-400 hover:text-amber-500"><Edit2 size={13} /></button>
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

            {/* 11. Importe pendiente — descuenta cobros registrados + reserva */}
            <div>
              <label className="label-form">Importe pendiente</label>
              <div className="input-form bg-gray-50 text-gray-700 font-semibold">
                {fmt(Math.max(0, (form.total ?? 0) - (form.pagosRecibidos ?? 0) - (form.tieneReserva ? (form.reserva ?? 0) : 0)))}
              </div>
            </div>

            {/* 12. Método de pago — cerrado a 3 opciones */}
            <div>
              <label className="label-form">Método de pago</label>
              <select value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className="input-form">
                {(METODOS_FORM.includes(form.metodoPago as PaymentMethod) ? METODOS_FORM : [form.metodoPago as PaymentMethod, ...METODOS_FORM]).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {/* 13. Fecha del pago */}
            <div>
              <label className="label-form">Fecha del pago</label>
              <input type="date" value={form.fechaPago ?? ''} onChange={(e) => setField('fechaPago', e.target.value)} className="input-form" />
            </div>
            {/* 16-17. Factura emitida + No factura */}
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.facturaEmitida} onChange={(e) => setField('facturaEmitida', e.target.checked)} className="rounded" />
                Factura emitida
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.sinFactura} onChange={(e) => setField('sinFactura', e.target.checked)} className="rounded" />
                No factura
              </label>
            </div>
            {form.facturaEmitida && (
              <div>
                <label className="label-form">Nº Factura</label>
                <input value={form.numeroFactura ?? ''} onChange={(e) => setField('numeroFactura', e.target.value)} className="input-form" placeholder="LMS-2026-001" />
              </div>
            )}
            <div className="col-span-2">
              <label className="label-form">Notas</label>
              <textarea value={form.notas ?? ''} onChange={(e) => setField('notas', e.target.value)} rows={2} className="input-form resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">
              {editing ? 'Guardar cambios' : 'Añadir ingreso'}
            </button>
          </div>
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
              <div>
                <label className="label-form">Categoría</label>
                <select value={gastoForm.categoria} onChange={(e) => setGastoForm((f) => ({ ...f, categoria: e.target.value as GastoEventoCategoria }))} className="input-form">
                  {CAT_GASTO_EVENTO.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label-form">Importe (€) *</label>
                <input type="number" step="0.01" value={gastoForm.importe} onChange={(e) => setGastoForm((f) => ({ ...f, importe: parseFloat(e.target.value) || 0 }))} className="input-form" />
              </div>
              <div>
                <label className="label-form">Tipo de gasto</label>
                <select value={gastoForm.tipo} onChange={(e) => setGastoForm((f) => ({ ...f, tipo: e.target.value as GastoTipo }))} className="input-form">
                  {TIPOS_GASTO_EVENTO.map((t) => <option key={t} value={t}>{t === 'fijo' ? 'Fijo' : 'Variable'}</option>)}
                </select>
              </div>
              <div>
                <label className="label-form">Fecha</label>
                <input type="date" value={gastoForm.fecha} onChange={(e) => setGastoForm((f) => ({ ...f, fecha: e.target.value }))} className="input-form" />
              </div>
              <div className="col-span-2">
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
              <button onClick={closeGasto} className="flex-1 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50">Cancelar</button>
              <button onClick={saveGasto} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">Añadir gasto</button>
            </div>
          </div>
        )}
      </Modal>

      {area === 'dj' && (
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
                      <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">Sin suplidos registrados</td></tr>
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
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.estado === 'cobrado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{s.estado === 'cobrado' ? 'Cobrado' : 'Pendiente'}</span>
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
            <button onClick={closeSuplidoFormModal} className="flex-1 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={saveSuplidoForm} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editingSuplidoForm ? 'Guardar' : 'Añadir suplido'}</button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
