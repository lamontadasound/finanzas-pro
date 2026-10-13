// ── Administración → Emisores fiscales (Fase H) ─────────────────────────────
// Sustituye por completo la antigua pantalla de un único "Datos fiscales":
// ahora gestiona una LISTA de emisores y su asignación por proyecto/línea.
// Admin-only (gateado por RequireAdminStrict en App.tsx). Ningún campo se
// rellena con datos reales inventados — cada emisor empieza vacío hasta que
// se completa aquí.
import { useState } from 'react';
import { Building2, Save, ShieldAlert, Plus, Trash2, Lock, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { db } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { uid } from '../../utils/helpers';
import { LINEA_IDS, BUSINESS_LINES } from '../../config/businessLines';
import type { ConfiguracionFiscal } from '../../types';

const CAMPOS: Array<{ key: keyof ConfiguracionFiscal; label: string; type?: string; placeholder?: string }> = [
  { key: 'nombreInterno', label: 'Nombre interno (solo para elegir aquí)', placeholder: 'p. ej. "La Montada Sound SL"' },
  { key: 'razonSocial', label: 'Razón social', placeholder: 'Nombre legal completo' },
  { key: 'nombreComercial', label: 'Nombre comercial', placeholder: 'Nombre con el que se factura' },
  { key: 'nifCif', label: 'NIF / CIF' },
  { key: 'direccionFiscal', label: 'Dirección fiscal' },
  { key: 'email', label: 'Correo de facturación', type: 'email' },
  { key: 'telefono', label: 'Teléfono de contacto' },
  { key: 'iban', label: 'IBAN' },
  { key: 'serieFormato', label: 'Serie activa (vacío: sin prefijo)', placeholder: 'p. ej. A2026' },
];

export const AdminDatosFiscales = () => {
  const emisores = useStore((s) => s.emisores);
  const proyectoEmisorMap = useStore((s) => s.proyectoEmisorMap);
  const addEmisor = useStore((s) => s.addEmisor);
  const updateEmisor = useStore((s) => s.updateEmisor);
  const deleteEmisor = useStore((s) => s.deleteEmisor);
  const setProyectoEmisor = useStore((s) => s.setProyectoEmisor);
  const user = useAuthStore((s) => s.user);
  const canGestionarNumeracion = useAuthStore((s) => s.canGestionarNumeracion());
  const showConfirm = useConfirmStore((s) => s.show);

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(emisores[0]?.id ?? null);
  const seleccionado = emisores.find((e) => e.id === seleccionadoId) ?? null;
  const [form, setForm] = useState<Partial<ConfiguracionFiscal>>(seleccionado ?? {});
  const [syncedFrom, setSyncedFrom] = useState(seleccionadoId);
  if (seleccionadoId !== syncedFrom) { setSyncedFrom(seleccionadoId); setForm(seleccionado ?? {}); }

  const [guardado, setGuardado] = useState(false);
  const [numeroInicial, setNumeroInicial] = useState('');
  const [avisoNumeracion, setAvisoNumeracion] = useState<string | null>(null);
  const [errorNumeracion, setErrorNumeracion] = useState<string | null>(null);

  const setField = (k: keyof ConfiguracionFiscal, v: string) => { setForm((f) => ({ ...f, [k]: v })); setGuardado(false); };

  const crearEmisor = async () => {
    const id = uid();
    const nuevo: ConfiguracionFiscal = { id, activo: true, numeracionConfirmada: false };
    if (!await addEmisor(nuevo)) return;
    setSeleccionadoId(id);
  };

  const guardar = async () => {
    if (!seleccionado) return;
    if (!await updateEmisor(seleccionado.id, { ...form, actualizadoPor: user?.id, actualizadoEn: new Date().toISOString() })) return;
    setGuardado(true);
  };

  const eliminar = () => {
    if (!seleccionado) return;
    if (seleccionado.id === 'default') return; // el emisor migrado del modelo antiguo nunca se borra desde aquí
    showConfirm(
      `¿Eliminar el emisor "${seleccionado.nombreInterno ?? seleccionado.id}"? Solo es posible si ningún proyecto lo tiene asignado.`,
      async () => { if (await deleteEmisor(seleccionado.id)) setSeleccionadoId(null); },
    );
  };

  const confirmarNumeracion = async () => {
    setErrorNumeracion(null); setAvisoNumeracion(null);
    if (!seleccionado) return;
    const n = Number(numeroInicial);
    if (!Number.isSafeInteger(n) || n < 1) { setErrorNumeracion('Indica un número inicial válido (entero positivo).'); return; }
    const { error } = await supabase.rpc('fijar_numero_inicial_factura', { p_numero_inicial: n, p_emisor_id: seleccionado.id, p_serie: seleccionado.serieFormato?.trim() ?? '' });
    if (error) {
      setErrorNumeracion(`No se pudo confirmar: ${error.message}.`);
      return;
    }
    const saved=await db.emisores.getById(seleccionado.id);
    useStore.setState(st=>({emisores:st.emisores.map(x=>x.id===saved.id?saved:x)}));
    setAvisoNumeracion(`Numeración confirmada — la próxima factura de este emisor será la nº ${n}.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Emisores fiscales</h1>
        <p className="text-sm text-gray-500">Solo administradores. Cada proyecto se asigna a uno de estos emisores — un proyecto no equivale automáticamente a una empresa distinta.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-card p-4 text-sm text-amber-800 flex gap-3">
        <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
        <p>
          Ningún campo se rellena automáticamente con datos reales — hasta que los completes, las facturas de ese
          emisor mostrarán <strong>"[Pendiente de configurar]"</strong>. El número inicial se confirma una única vez
          por emisor y nunca se puede reiniciar si ya se han emitido facturas con esa numeración.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Lista de emisores ─────────────────────────────────────────── */}
        <Card className="space-y-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-800">Emisores</h2>
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={crearEmisor}>Nuevo</Button>
          </div>
          {emisores.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">Sin emisores todavía.</p>
          ) : (
            <div className="space-y-1">
              {emisores.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSeleccionadoId(e.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    e.id === seleccionadoId ? 'bg-accent-50 text-accent-800 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <p className="truncate">{e.nombreInterno || e.razonSocial || `Emisor ${e.id}`}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    {e.numeracionConfirmada ? <CheckCircle2 size={11} className="text-accent-500" /> : <Lock size={11} />}
                    {e.numeracionConfirmada ? 'Numeración confirmada' : 'Numeración sin confirmar'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* ── Formulario del emisor seleccionado ───────────────────────────── */}
        <Card className="space-y-4 lg:col-span-2">
          {!seleccionado ? (
            <p className="text-sm text-gray-400 py-8 text-center">Selecciona o crea un emisor.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CAMPOS.map(({ key, label, type, placeholder }) => (
                  <div key={key} className={key === 'nombreInterno' ? 'sm:col-span-2' : ''}>
                    <label className="label-form">{label}</label>
                    <input
                      type={type ?? 'text'} className="input-form" placeholder={placeholder}
                      value={(form[key] as string) ?? ''} onChange={(e) => setField(key, e.target.value)}
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="label-form">Condiciones de pago</label>
                  <textarea className="input-form" rows={2} value={form.condicionesPago ?? ''} onChange={(e) => setField('condicionesPago', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label-form">Texto legal (pie de factura)</label>
                  <textarea className="input-form" rows={2} value={form.textoLegal ?? ''} onChange={(e) => setField('textoLegal', e.target.value)} />
                </div>
              </div>

              {seleccionado.actualizadoEn && (
                <p className="text-xs text-gray-400">Última actualización: {new Date(seleccionado.actualizadoEn).toLocaleString('es-ES')}</p>
              )}
              {guardado && <p className="text-sm text-accent-600 bg-accent-50 rounded-lg px-3 py-2">Guardado correctamente.</p>}

              <div className="flex justify-between pt-2 border-t border-gray-100">
                {seleccionado.id !== 'default' ? (
                  <Button variant="secondary" icon={<Trash2 size={14} />} onClick={eliminar}>Eliminar emisor</Button>
                ) : <span />}
                <Button variant="primary" icon={<Save size={16} />} onClick={guardar}>Guardar cambios</Button>
              </div>

              {/* ── Numeración — solo quien tenga el permiso "gestionar numeración" ── */}
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">Numeración de este emisor</h3>
                <p className="text-xs text-gray-500">Serie guardada: {seleccionado?.serieFormato || 'sin prefijo'}. Comprueba el último número real de esta serie. Una serie que ya emitió facturas no se puede reiniciar.</p>
                {!canGestionarNumeracion ? (
                  <p className="text-xs text-gray-400">No tienes permiso para gestionar la numeración. Pídeselo a un administrador.</p>
                ) : (
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="label-form">Próximo número real a emitir</label>
                      <input type="number" min={1} className="input-form w-40" value={numeroInicial} onChange={(e) => setNumeroInicial(e.target.value)} placeholder="Según tus facturas reales" />
                    </div>
                    <Button variant="secondary" onClick={confirmarNumeracion}>Confirmar numeración inicial</Button>
                  </div>
                )}
                {errorNumeracion && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorNumeracion}</p>}
                {avisoNumeracion && <p className="text-xs text-accent-600 bg-accent-50 rounded-lg px-3 py-2">{avisoNumeracion}</p>}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Asignación de proyectos a emisores ────────────────────────────── */}
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Proyectos asignados</h2>
        <p className="text-xs text-gray-400">Cada línea de negocio factura bajo el emisor que elijas aquí. Por defecto, todas usan el emisor "default" hasta que lo cambies.</p>
        <div className="divide-y divide-gray-50">
          {LINEA_IDS.map((lineaId) => (
            <div key={lineaId} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-700">{BUSINESS_LINES[lineaId].label}</span>
              <select
                className="input-form w-64"
                value={proyectoEmisorMap[lineaId] ?? 'default'}
                onChange={(e) => setProyectoEmisor(lineaId, e.target.value)}
              >
                {emisores.length === 0 && <option value="default">default</option>}
                {emisores.map((e) => <option key={e.id} value={e.id}>{e.nombreInterno || e.razonSocial || e.id}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-gray-400">
        <Building2 size={13} /> El número inicial/último confirmado de cada emisor se configura una única vez y no se puede reiniciar si ya hay facturas emitidas.
      </p>
    </div>
  );
};
