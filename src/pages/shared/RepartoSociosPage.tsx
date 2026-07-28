import { useState, useMemo, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, ChevronLeft, Power } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { MovimientoSocio, MovimientoSocioTipo, Socio } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const TIPOS_MOVIMIENTO: { value: MovimientoSocioTipo; label: string }[] = [
  { value: 'aportacion_personal', label: 'Aportación personal' },
  { value: 'reintegro_aportacion', label: 'Reintegro de aportación' },
  { value: 'beneficio_reinvertido', label: 'Beneficio reinvertido' },
  { value: 'reparto_beneficio_cobrado', label: 'Reparto de beneficio cobrado' },
  { value: 'adelanto_socio', label: 'Adelanto realizado por el socio' },
  { value: 'devolucion_adelanto', label: 'Devolución de adelanto' },
  { value: 'ajuste', label: 'Ajuste' },
];
const TIPO_LABEL = Object.fromEntries(TIPOS_MOVIMIENTO.map((t) => [t.value, t.label])) as Record<MovimientoSocioTipo, string>;

const EMPTY_MOV = (socioId: string): Partial<MovimientoSocio> => ({
  socioId, fecha: new Date().toISOString().slice(0, 10), tipo: 'aportacion_personal',
  cantidad: 0, concepto: '', cuenta: '', documentoId: '', observaciones: '',
});

const EMPTY_SOCIO_FORM = {
  id: '', nombre: '', porcentaje: 0,
  fechaIncorporacion: new Date().toISOString().slice(0, 10),
  activo: true, observaciones: '',
};

export const RepartoSociosPage = () => {
  const allIngresos     = useStore((s) => s.ingresos);
  const allGastos       = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const socios          = useStore((s) => s.socios);
  const addSocio        = useStore((s) => s.addSocio);
  const updateSocio     = useStore((s) => s.updateSocio);
  const deleteSocio     = useStore((s) => s.deleteSocio);
  const movimientos           = useStore((s) => s.movimientosSocios);
  const addMovimientoSocio    = useStore((s) => s.addMovimientoSocio);
  const updateMovimientoSocio = useStore((s) => s.updateMovimientoSocio);
  const deleteMovimientoSocio = useStore((s) => s.deleteMovimientoSocio);
  const canCreate = useAuthStore((s) => s.canCreate);
  const canEdit   = useAuthStore((s) => s.canEdit);
  const canDelete = useAuthStore((s) => s.canDelete);
  const showConfirm = useConfirmStore((s) => s.show);

  // Socios iniciales: Julia y Rodrigo, sin porcentaje predefinido (lo fija el administrador).
  useEffect(() => {
    if (socios.length === 0) {
      addSocio({ id: uid(), nombre: 'Julia', porcentaje: 0, activo: true, createdAt: new Date().toISOString() });
      addSocio({ id: uid(), nombre: 'Rodrigo', porcentaje: 0, activo: true, createdAt: new Date().toISOString() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [filtroAnio, setFiltroAnio] = useState<number | ''>('');
  const [filtroMes, setFiltroMes] = useState<number | ''>('');
  const [filtroSocio, setFiltroSocio] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<MovimientoSocioTipo | ''>('');
  const [fichaSocioId, setFichaSocioId] = useState<string | null>(null);

  const [showMovModal, setShowMovModal] = useState(false);
  const [editingMov, setEditingMov] = useState<MovimientoSocio | null>(null);
  const [movForm, setMovForm] = useState<Partial<MovimientoSocio>>(EMPTY_MOV(socios[0]?.id ?? ''));

  const [showSocioModal, setShowSocioModal] = useState(false);
  const [editingSocio, setEditingSocio] = useState<Socio | null>(null);
  const [socioForm, setSocioForm] = useState(EMPTY_SOCIO_FORM);

  const sociosActivos = socios.filter((s) => s.activo !== false);
  const sumaPorcentajes = sociosActivos.reduce((a, s) => a + s.porcentaje, 0);

  // ── Beneficio operativo de La Montada Sound, en el período filtrado ──────────
  const ingresosMontada     = useMemo(() => allIngresos.filter((i) => i.area === 'montada'), [allIngresos]);
  const gastosMontada       = useMemo(() => allGastos.filter((g) => g.area === 'montada'), [allGastos]);
  const gastosEventoMontada = useMemo(() => allGastosEvento.filter((g) => g.area === 'montada'), [allGastosEvento]);

  const enPeriodo = (fecha: string) => {
    const d = new Date(fecha);
    if (filtroAnio !== '' && d.getFullYear() !== filtroAnio) return false;
    if (filtroMes !== '' && d.getMonth() !== filtroMes) return false;
    return true;
  };

  const beneficioOperativo = useMemo(() => {
    const ingresosScope = ingresosMontada.filter((i) => enPeriodo(i.fechaEvento));
    const gastosEvScope  = gastosEventoMontada.filter((g) => enPeriodo(g.fecha));
    const gastosGenScope = gastosMontada.filter((g) => enPeriodo(g.fecha));
    const ingresosSinIva = ingresosScope.reduce((a, i) => a + i.baseImponible, 0);
    const gastosActuacion = gastosEvScope.reduce((a, g) => a + g.importe, 0);
    const gastosGenerales = gastosGenScope.reduce((a, g) => a + g.total, 0);
    return ingresosSinIva - gastosActuacion - gastosGenerales;
  }, [ingresosMontada, gastosMontada, gastosEventoMontada, filtroAnio, filtroMes]);

  const movimientosFiltrados = useMemo(() => movimientos.filter((m) => {
    if (!enPeriodo(m.fecha)) return false;
    if (filtroSocio && m.socioId !== filtroSocio) return false;
    if (filtroTipo && m.tipo !== filtroTipo) return false;
    return true;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha)), [movimientos, filtroAnio, filtroMes, filtroSocio, filtroTipo]);

  const sumaTipo = (socioId: string, tipo: MovimientoSocioTipo, movs: MovimientoSocio[]) =>
    movs.filter((m) => m.socioId === socioId && m.tipo === tipo).reduce((a, m) => a + m.cantidad, 0);

  const statsPorSocio = useMemo(() => {
    // Los cálculos de saldo usan todo el histórico del período filtrado (año/mes), no solo lo visible tras el filtro de tipo/socio.
    const movsScope = movimientos.filter((m) => enPeriodo(m.fecha));
    return socios.map((socio) => {
      const aportado    = sumaTipo(socio.id, 'aportacion_personal', movsScope);
      const adelantado  = sumaTipo(socio.id, 'adelanto_socio', movsScope);
      const reintegrado = sumaTipo(socio.id, 'reintegro_aportacion', movsScope);
      const devuelto    = sumaTipo(socio.id, 'devolucion_adelanto', movsScope);
      const reinvertido = sumaTipo(socio.id, 'beneficio_reinvertido', movsScope);
      const cobrado      = sumaTipo(socio.id, 'reparto_beneficio_cobrado', movsScope);
      const ajustes       = sumaTipo(socio.id, 'ajuste', movsScope);

      const aportacionPendiente = aportado + adelantado - reintegrado - devuelto;
      const beneficioAsignado = beneficioOperativo * (socio.porcentaje / 100);
      const beneficioPendiente = beneficioAsignado - cobrado - reinvertido;
      const saldoTotal = aportacionPendiente + beneficioPendiente + ajustes;

      return { socio, aportado, reinvertido, cobrado, devuelto: reintegrado + devuelto, aportacionPendiente, beneficioAsignado, beneficioPendiente, saldoTotal };
    });
  }, [socios, movimientos, beneficioOperativo, filtroAnio, filtroMes]);

  const openNewMov = (socioId?: string) => { setEditingMov(null); setMovForm(EMPTY_MOV(socioId || filtroSocio || socios[0]?.id || '')); setShowMovModal(true); };
  const openEditMov = (m: MovimientoSocio) => { setEditingMov(m); setMovForm({ ...m }); setShowMovModal(true); };
  const closeMovModal = () => { setShowMovModal(false); setEditingMov(null); };

  const saveMov = () => {
    if (!movForm.socioId || !movForm.concepto || !movForm.tipo || (movForm.cantidad ?? 0) <= 0) return;
    if (editingMov) {
      updateMovimientoSocio(editingMov.id, movForm);
    } else {
      addMovimientoSocio({ ...EMPTY_MOV(movForm.socioId), ...movForm, id: uid(), createdAt: new Date().toISOString() } as MovimientoSocio);
    }
    closeMovModal();
  };

  const openNewSocio = () => { setEditingSocio(null); setSocioForm(EMPTY_SOCIO_FORM); setShowSocioModal(true); };
  const openEditSocio = (s: Socio) => {
    setEditingSocio(s);
    setSocioForm({
      id: s.id, nombre: s.nombre, porcentaje: s.porcentaje,
      fechaIncorporacion: s.fechaIncorporacion ?? new Date().toISOString().slice(0, 10),
      activo: s.activo !== false, observaciones: s.observaciones ?? '',
    });
    setShowSocioModal(true);
  };
  const closeSocioModal = () => { setShowSocioModal(false); setEditingSocio(null); };

  const saveSocio = () => {
    if (!socioForm.nombre.trim()) return;
    if (editingSocio) {
      updateSocio(editingSocio.id, {
        nombre: socioForm.nombre, porcentaje: socioForm.porcentaje,
        fechaIncorporacion: socioForm.fechaIncorporacion, activo: socioForm.activo,
        observaciones: socioForm.observaciones,
      });
    } else {
      addSocio({
        id: uid(), nombre: socioForm.nombre.trim(), porcentaje: socioForm.porcentaje,
        fechaIncorporacion: socioForm.fechaIncorporacion, activo: socioForm.activo,
        observaciones: socioForm.observaciones, createdAt: new Date().toISOString(),
      });
    }
    closeSocioModal();
  };

  const toggleActivo = (s: Socio) => updateSocio(s.id, { activo: s.activo === false });

  const eliminarSocio = (s: Socio) => {
    const tieneMovimientos = movimientos.some((m) => m.socioId === s.id);
    const mensaje = tieneMovimientos
      ? `¿Eliminar a ${s.nombre}? Sus movimientos se mantendrán en el historial (aparecerán como "socio eliminado").`
      : `¿Eliminar a ${s.nombre}?`;
    showConfirm(mensaje, () => deleteSocio(s.id));
  };

  const fichaSocio = fichaSocioId ? socios.find((s) => s.id === fichaSocioId) : null;
  const fichaStats = fichaSocioId ? statsPorSocio.find((s) => s.socio.id === fichaSocioId) : null;
  const movimientosFicha = useMemo(
    () => fichaSocioId ? movimientos.filter((m) => m.socioId === fichaSocioId).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [],
    [movimientos, fichaSocioId],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reparto socios</h1>
          <p className="text-sm text-gray-500">La Montada Sound — control de aportaciones, reinversión y beneficio de cada socio</p>
        </div>
        {!fichaSocio && (
          <div className="flex items-center gap-2">
            {canCreate('montada') && (
              <button onClick={openNewSocio} className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">
                <Users size={14} /> Añadir socio
              </button>
            )}
            {canCreate('montada') && socios.length > 0 && (
              <button onClick={() => openNewMov()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors">
                <Plus size={16} /> Añadir movimiento
              </button>
            )}
          </div>
        )}
      </div>

      {sumaPorcentajes !== 100 && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          La suma de porcentajes de reparto de los socios activos es {sumaPorcentajes}% — debe ser 100%. Ajusta el porcentaje de cada socio.
        </p>
      )}

      {/* ── Ficha individual de un socio ── */}
      {fichaSocio && fichaStats ? (
        <div className="space-y-4">
          <button onClick={() => setFichaSocioId(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a todos los socios</button>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  {fichaSocio.nombre}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fichaSocio.activo === false ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>{fichaSocio.activo === false ? 'Inactivo' : 'Activo'}</span>
                </h2>
                <p className="text-sm text-gray-500">{fichaSocio.porcentaje}% de reparto{fichaSocio.fechaIncorporacion ? ` · desde ${fichaSocio.fechaIncorporacion}` : ''}</p>
                {fichaSocio.observaciones && <p className="text-xs text-gray-400 mt-1">{fichaSocio.observaciones}</p>}
              </div>
              <div className="flex gap-2">
                {canEdit('montada') && <button onClick={() => openEditSocio(fichaSocio)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50"><Edit2 size={12} /> Editar</button>}
                {canCreate('montada') && <button onClick={() => openNewMov(fichaSocio.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-black text-xs font-semibold rounded-lg hover:bg-amber-400"><Plus size={12} /> Añadir movimiento</button>}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><p className="text-xs text-gray-500">Total aportado</p><p className="font-semibold text-gray-900">{fmt(fichaStats.aportado)}</p></div>
              <div><p className="text-xs text-gray-500">Total reinvertido</p><p className="font-semibold text-gray-900">{fmt(fichaStats.reinvertido)}</p></div>
              <div><p className="text-xs text-gray-500">Total cobrado</p><p className="font-semibold text-gray-900">{fmt(fichaStats.cobrado)}</p></div>
              <div><p className="text-xs text-gray-500">Total devuelto</p><p className="font-semibold text-gray-900">{fmt(fichaStats.devuelto)}</p></div>
              <div><p className="text-xs text-gray-500">Aportación pendiente de devolver</p><p className="font-semibold text-amber-700">{fmt(fichaStats.aportacionPendiente)}</p></div>
              <div><p className="text-xs text-gray-500">Beneficio asignado</p><p className="font-semibold text-gray-900">{fmt(fichaStats.beneficioAsignado)}</p></div>
              <div><p className="text-xs text-gray-500">Beneficio pendiente de cobrar</p><p className="font-semibold text-amber-700">{fmt(fichaStats.beneficioPendiente)}</p></div>
              <div><p className="text-xs text-gray-500">Saldo total</p><p className={`font-semibold ${fichaStats.saldoTotal >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(fichaStats.saldoTotal)}</p></div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-800">Movimientos de {fichaSocio.nombre}</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Concepto</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Cuenta</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movimientosFicha.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">Sin movimientos registrados</td></tr>
                  ) : movimientosFicha.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{m.fecha}</td>
                      <td className="px-4 py-2.5 text-gray-600">{TIPO_LABEL[m.tipo]}</td>
                      <td className="px-4 py-2.5 text-gray-600">{m.concepto}{m.observaciones && <p className="text-xs text-gray-400">{m.observaciones}</p>}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-900">{fmt(m.cantidad)}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{m.cuenta || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          {canEdit('montada') && <button onClick={() => openEditMov(m)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                          {canDelete('montada') && <button onClick={() => showConfirm('¿Eliminar este movimiento?', () => deleteMovimientoSocio(m.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value ? Number(e.target.value) : '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Todos los años</option>
          {Array.from(new Set(movimientos.map((m) => new Date(m.fecha).getFullYear()))).sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value !== '' ? Number(e.target.value) : '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Todos los meses</option>
          {MESES_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select value={filtroSocio} onChange={(e) => setFiltroSocio(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Todos los socios</option>
          {socios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as MovimientoSocioTipo | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Todos los tipos</option>
          {TIPOS_MOVIMIENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <p className="text-xs text-gray-500">Beneficio operativo de La Montada Sound en el período: <span className="font-semibold text-gray-800">{fmt(beneficioOperativo)}</span></p>

      {/* Comparación de socios */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Socio</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">% Reparto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aportado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reinvertido</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cobrado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pendiente devolución</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Beneficio asignado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Beneficio pendiente</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Saldo total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statsPorSocio.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400 text-sm">Sin socios registrados</td></tr>
              ) : statsPorSocio.map(({ socio, aportado, reinvertido, cobrado, aportacionPendiente, beneficioAsignado, beneficioPendiente, saldoTotal }) => (
                <tr key={socio.id} className={`hover:bg-gray-50 ${socio.activo === false ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => setFichaSocioId(socio.id)} className="font-medium text-gray-900 hover:text-amber-600 hover:underline text-left">{socio.nombre}</button>
                    {socio.activo === false && <span className="ml-2 text-xs text-gray-400">(inactivo)</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{socio.porcentaje}%</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(aportado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(reinvertido)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(cobrado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-700">{fmt(aportacionPendiente)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(beneficioAsignado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-700">{fmt(beneficioPendiente)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${saldoTotal >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(saldoTotal)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {canEdit('montada') && <button onClick={() => toggleActivo(socio)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg" title={socio.activo === false ? 'Marcar activo' : 'Marcar inactivo'}><Power size={13} /></button>}
                      {canEdit('montada') && <button onClick={() => openEditSocio(socio)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                      {canDelete('montada') && <button onClick={() => eliminarSocio(socio)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de movimientos */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Movimientos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Socio</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Concepto</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Cuenta</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movimientosFiltrados.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">Sin movimientos registrados</td></tr>
              ) : movimientosFiltrados.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{socios.find((s) => s.id === m.socioId)?.nombre ?? 'Socio eliminado'}</td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{m.fecha}</td>
                  <td className="px-4 py-2.5 text-gray-600">{TIPO_LABEL[m.tipo]}</td>
                  <td className="px-4 py-2.5 text-gray-600">{m.concepto}{m.observaciones && <p className="text-xs text-gray-400">{m.observaciones}</p>}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-900">{fmt(m.cantidad)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{m.cuenta || '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      {canEdit('montada') && <button onClick={() => openEditMov(m)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                      {canDelete('montada') && <button onClick={() => showConfirm('¿Eliminar este movimiento?', () => deleteMovimientoSocio(m.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 px-5 py-2 border-t border-gray-100">Las aportaciones y reintegros de socios no se contabilizan como ingresos ni gastos operativos de la empresa. Pendiente de migración para persistir de forma permanente (tablas "socios"/"movimientos_socios").</p>
      </div>
      </>
      )}

      {/* Modal: nuevo/editar socio */}
      <Modal isOpen={showSocioModal} onClose={closeSocioModal} title={editingSocio ? 'Editar socio' : 'Añadir socio'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label-form">Nombre *</label>
            <input value={socioForm.nombre} onChange={(e) => setSocioForm({ ...socioForm, nombre: e.target.value })} className="input-form" placeholder="Nombre del socio" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-form">Porcentaje de reparto (%)</label>
              <input type="number" step="0.01" value={socioForm.porcentaje} onChange={(e) => setSocioForm({ ...socioForm, porcentaje: parseFloat(e.target.value) || 0 })} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fecha de incorporación</label>
              <input type="date" value={socioForm.fechaIncorporacion} onChange={(e) => setSocioForm({ ...socioForm, fechaIncorporacion: e.target.value })} className="input-form" />
            </div>
            <div className="col-span-2">
              <label className="label-form">Estado</label>
              <select value={socioForm.activo ? 'si' : 'no'} onChange={(e) => setSocioForm({ ...socioForm, activo: e.target.value === 'si' })} className="input-form">
                <option value="si">Activo</option>
                <option value="no">Inactivo</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label-form">Observaciones</label>
              <textarea value={socioForm.observaciones} onChange={(e) => setSocioForm({ ...socioForm, observaciones: e.target.value })} rows={2} className="input-form" />
            </div>
          </div>
          <p className="text-xs text-gray-400">La suma de porcentajes de todos los socios activos debe ser 100%.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={closeSocioModal} className="flex-1 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={saveSocio} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editingSocio ? 'Guardar' : 'Añadir'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal: nuevo/editar movimiento */}
      <Modal isOpen={showMovModal} onClose={closeMovModal} title={editingMov ? 'Editar movimiento' : 'Añadir movimiento'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-form">Socio *</label>
              <select value={movForm.socioId ?? ''} onChange={(e) => setMovForm((f) => ({ ...f, socioId: e.target.value }))} className="input-form">
                {socios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Fecha</label>
              <input type="date" value={movForm.fecha ?? ''} onChange={(e) => setMovForm((f) => ({ ...f, fecha: e.target.value }))} className="input-form" />
            </div>
            <div className="col-span-2">
              <label className="label-form">Tipo de movimiento *</label>
              <select value={movForm.tipo ?? 'aportacion_personal'} onChange={(e) => setMovForm((f) => ({ ...f, tipo: e.target.value as MovimientoSocioTipo }))} className="input-form">
                {TIPOS_MOVIMIENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Cantidad (€) *</label>
              <input type="number" step="0.01" value={movForm.cantidad ?? 0} onChange={(e) => setMovForm((f) => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Cuenta bancaria o método</label>
              <input value={movForm.cuenta ?? ''} onChange={(e) => setMovForm((f) => ({ ...f, cuenta: e.target.value }))} className="input-form" />
            </div>
            <div className="col-span-2">
              <label className="label-form">Concepto *</label>
              <input value={movForm.concepto ?? ''} onChange={(e) => setMovForm((f) => ({ ...f, concepto: e.target.value }))} className="input-form" />
            </div>
            <div className="col-span-2">
              <label className="label-form">Documento o justificante <span className="text-gray-400 font-normal">(referencia, pendiente de adjuntar archivo)</span></label>
              <input value={movForm.documentoId ?? ''} onChange={(e) => setMovForm((f) => ({ ...f, documentoId: e.target.value }))} className="input-form" placeholder="Nº de recibo, referencia, etc." />
            </div>
            <div className="col-span-2">
              <label className="label-form">Observaciones</label>
              <textarea value={movForm.observaciones ?? ''} onChange={(e) => setMovForm((f) => ({ ...f, observaciones: e.target.value }))} rows={2} className="input-form" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Este movimiento no se contabiliza como ingreso ni gasto operativo de la empresa — solo como control interno del socio.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={closeMovModal} className="flex-1 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={saveMov} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editingMov ? 'Guardar' : 'Añadir movimiento'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
