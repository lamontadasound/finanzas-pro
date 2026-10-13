import {useLocalDraft} from '../../hooks/useLocalDraft';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../lib/supabase';
import { syncInvoice } from '../../lib/invoiceSync';
import { db } from '../../lib/db';
import {
  PORCENTAJES_RAPIDOS, calcularFacturaParcial, puedeFacturarPorcentaje,
  resumenFacturacionIngreso, importeCobradoDe, importePendienteDeCobrarDe, resolverEmisorParaLinea,
} from '../../lib/facturacion';
import { facturaPdfBlobUrl } from '../../lib/facturaPdf';
import { obtenerOCrearEmisionPendiente, limpiarEmisionPendiente } from '../../lib/emisionPendiente';
import { uid } from '../../utils/helpers';
import { resolveLinea } from '../../config/resolveLinea';
import type { Ingreso, Factura } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

export function GenerarFacturaModal({ ingreso, onClose }: { ingreso: Ingreso; onClose: () => void }) {
  const facturas = useStore((s) => s.facturas);
  const addFactura = useStore((s) => s.addFactura);
  const emisores = useStore((s) => s.emisores);
  const proyectoEmisorMap = useStore((s) => s.proyectoEmisorMap);
  const user = useAuthStore((s) => s.user);
  const tienePermisoEmitirGlobal = useAuthStore((s) => s.canEmitirFacturas());
  const canCreateLinea = useAuthStore((s) => s.canCreateLinea);

  // ── Emisor fiscal — resuelto por la LÍNEA de este ingreso, nunca fijo ────
  // Sustituye el antiguo `configuracionFiscal` (fila única): cada proyecto
  // puede facturar bajo un emisor distinto — ver Administración → Emisores
  // fiscales para la asignación. Si la línea no tiene asignación válida
  // (ni explícita ni el emisor 'default'), `resolverEmisorParaLinea`
  // devuelve `null` — nunca elige uno arbitrario. En ese caso se exige una
  // selección manual explícita antes de poder emitir (ver `emisorManualId`).
  const lineaId = resolveLinea({ id: ingreso.id, area: ingreso.area, tipoEvento: ingreso.tipoEvento, lineaNegocio: ingreso.lineaNegocio });
  const emisorResuelto = resolverEmisorParaLinea(emisores, proyectoEmisorMap, lineaId);
  const emisor = emisorResuelto;
  const requiereSeleccionManual = !emisorResuelto;

  // CORRECCIÓN: tener el permiso fino "emitir" (global, por usuario) NO
  // basta por sí solo — hace falta ADEMÁS el permiso de la línea de
  // negocio de este ingreso concreto. Sin este cruce, alguien con permiso
  // de facturación pero sin acceso a, por ejemplo, Real Madrid, podría
  // emitir facturas sobre ingresos de Real Madrid igualmente. El servidor
  // repite exactamente este mismo cruce (`has_facturacion_perm` +
  // `has_line_perm` dentro de `emitir_numero_factura`) — este es solo el
  // reflejo en cliente para no hacer esperar al usuario a un viaje de red.
  const canEmitirFacturas = tienePermisoEmitirGlobal && canCreateLinea(lineaId);

  const draftKey=`mi-espacio:factura-ingreso:${user?.id}:${ingreso.id}`;
  const [porcentaje, setPorcentaje] = useLocalDraft<number>(draftKey+':porcentaje',()=>30);
  const [personalizado, setPersonalizado] = useLocalDraft(draftKey+':personalizado',()=>'');
  const [concepto, setConcepto] = useLocalDraft(draftKey+':concepto',()=>ingreso.concepto);
  const [observaciones, setObservaciones] = useLocalDraft(draftKey+':observaciones',()=>'');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pctEfectivo = personalizado !== '' ? Number(personalizado) : porcentaje;

  const calculo = useMemo(
    () => calcularFacturaParcial(ingreso.baseImponible, ingreso.porcentajeIVA, pctEfectivo || 0),
    [ingreso, pctEfectivo],
  );

  const resumen = useMemo(() => resumenFacturacionIngreso(ingreso, facturas), [ingreso, facturas]);
  const cobrado = useMemo(() => importeCobradoDe(ingreso), [ingreso]);
  const pendienteCobro = useMemo(() => importePendienteDeCobrarDe(ingreso), [ingreso]);

  const validacion = puedeFacturarPorcentaje(facturas, ingreso.id, pctEfectivo || 0);
  const [clienteFiscal,setClienteFiscal] = useLocalDraft(draftKey+':cliente',() => {
    const anterior = facturas.filter(f=>f.ingresoId===ingreso.id&&f.clienteSnapshot).sort((a,b)=>b.fecha.localeCompare(a.fecha))[0]?.clienteSnapshot;
    return {nombre:anterior?.nombre||ingreso.cliente,nifCif:anterior?.nifCif||'',direccion:anterior?.direccion||'',email:anterior?.email||'',telefono:anterior?.telefono||''};
  });
  useEffect(()=>()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);},[previewUrl]);

  // ── ID de emisión estable — persistente, no solo `useRef` ────────────────
  // BUG CORREGIDO (dos veces): la primera corrección usó `useRef(uid())`,
  // que sobrevive a un reintento DENTRO de la misma apertura del modal, pero
  // se pierde si el modal se cierra y se reabre (o la pestaña se recarga) —
  // si la emisión ya se había confirmado en el servidor pero la respuesta
  // nunca llegó, reabrir el modal generaba un id NUEVO y podía acabar
  // pidiendo una segunda factura real. Ahora el id persiste en `localStorage`
  // por ingreso (`lib/emisionPendiente.ts`) — sobrevive a cerrar/reabrir el
  // modal y a recargar la página. La garantía de que NUNCA se duplica un
  // número, aun así, vive en el SERVIDOR (`emitir_numero_factura` comprueba
  // `numero_secuencial` antes de incrementar el contador) — esto solo
  // asegura que el cliente reenvíe el mismo id de forma fiable.
  // Se guarda en `useState` (no `useRef`): un `ref` nunca debe leerse
  // durante el render — este valor SÍ se usa para calcular JSX, así que
  // debe ser estado, fijado una única vez con el inicializador perezoso.
  const [emisionId] = useState(() => obtenerOCrearEmisionPendiente(ingreso.id, uid));

  // Si al abrir el modal ya existe, en el store local, una factura con este
  // id de emisión pendiente Y ya tiene número asignado, significa que una
  // sesión anterior SÍ llegó a emitirla (aunque la respuesta se perdiera) —
  // se muestra de inmediato, sin dejar reintentar y arriesgar otra emisión.
  const emisionPreviaConfirmada = facturas.find((f) => f.id === emisionId && f.numeroSecuencial != null);
  // El aviso inicial se deriva en el propio inicializador de estado — evita
  // el patrón "setState dentro de un efecto al montar" (cascada de renders
  // innecesaria): si ya estaba confirmada, el primer render YA lo muestra.
  const [aviso, setAviso] = useState<string | null>(() =>
    emisionPreviaConfirmada
      ? `Ya se había emitido esta factura anteriormente (número ${emisionPreviaConfirmada.numero}) — no hace falta volver a emitirla.`
      : null,
  );
  useEffect(() => { if (emisionPreviaConfirmada) limpiarEmisionPendiente(ingreso.id); }, [emisionPreviaConfirmada, ingreso.id]);

  const construirFactura = (esBorrador: boolean): Factura => ({
    id: esBorrador ? uid() : emisionId, area: ingreso.area, lineaNegocio: lineaId, tipo: 'emitida', serie: emisor?.serieFormato?.trim() || undefined,
    numero: '', // se rellena tras el RPC si se emite; vacío en borrador
    cliente: ingreso.cliente, concepto,
    baseImponible: esBorrador ? 0 : calculo.baseImponible,
    porcentajeIVA: ingreso.porcentajeIVA,
    importeIVA: esBorrador ? 0 : calculo.importeIVA,
    total: esBorrador ? 0 : calculo.total,
    fecha: new Date().toISOString().slice(0, 10),
    pagada: false, ivaDeducible: false, ingresoId: ingreso.id,
    notas: observaciones || undefined,
    estado: 'borrador',
    porcentajeFacturado: esBorrador ? 0 : pctEfectivo,
    emitidaPor: user?.id, syncEstado: 'sin_sincronizar',
    historial: [{
      fecha: new Date().toISOString(), usuarioId: user?.id ?? '', usuarioNombre: user?.nombre ?? '',
      accion: 'creada', detalle: esBorrador ? 'Borrador (0%, sin número fiscal)' : `Factura del ${pctEfectivo}%`,
    }],
  });

  const handlePreview = () => {
    
    const url = facturaPdfBlobUrl({
      factura: { numero: '(vista previa)', fecha: new Date().toISOString().slice(0, 10), concepto, ...calculo, porcentajeIVA: ingreso.porcentajeIVA, porcentajeFacturado: pctEfectivo },
      fechaEvento: ingreso.fechaEvento,
      configuracionFiscal: emisor,
      cliente: clienteFiscal,
    });
    setPreviewUrl(url);
  };

  // Datos fiscales obligatorios para poder emitir de verdad — esto BLOQUEA
  // el botón, no es solo un aviso ni una marca de agua en el PDF. El backend
  // (RPC `emitir_numero_factura`) repite exactamente esta misma comprobación
  // server-side — el bloqueo del cliente es solo para no hacer esperar al
  // usuario a un viaje de red por algo que ya se sabe que va a fallar.
  const faltanDatosFiscales = !emisor?.razonSocial?.trim() || !emisor?.nifCif?.trim() || !emisor?.direccionFiscal?.trim() || !clienteFiscal.nombre.trim() || !clienteFiscal?.nifCif?.trim() || !clienteFiscal?.direccion?.trim();

  const handleGuardarBorrador = async () => {
    setError(null);
    const f = construirFactura(true);
    if (!canCreateLinea(lineaId)) { setError('No tienes permiso para guardar borradores.'); return; }
    if (!await addFactura(f)) return;
    setAviso('Borrador guardado — no consume número fiscal ni genera una factura real.');
  };

  const handleEmitir = async () => {
    setError(null);
    if (emisionPreviaConfirmada) return; // ya emitida en una sesión anterior — nunca reintentar
    // Permiso fino de facturación — independiente del CRUD genérico de
    // `contabilidad`. El servidor repite exactamente esta comprobación
    // (`has_facturacion_perm(auth.uid(),'emitir')` dentro del RPC) — este
    // bloqueo del cliente es solo para no hacer esperar al usuario.
    if (!canEmitirFacturas) { setError('No tienes permiso para emitir facturas. Pídele a un administrador que te lo conceda en Administración → Usuarios.'); return; }
    if (!emisor) { setError('Selecciona un emisor fiscal para esta línea antes de emitir.'); return; }
    if (!validacion.ok) { setError(validacion.motivo ?? 'Porcentaje no válido.'); return; }
    if (faltanDatosFiscales) { setError('Completa los datos fiscales del emisor y del cliente en esta factura.'); return; }
    setGuardando(true);
    try {
      const f = construirFactura(false);
      // El borrador debe existir ya en `facturas` antes del RPC — la función
      // `emitir_numero_factura` hace UPDATE sobre esta fila, nunca INSERT,
      // así toda la operación (número + guardado) queda en una única
      // transacción atómica del lado del servidor (ver migración SQL).
      //
      // BUG CORREGIDO: aquí había un `upsert`, no un `insertIfMissing`. En
      // un reintento (mismo `f.id`, pero `f` reconstruido como borrador sin
      // número), un `upsert` real SOBRESCRIBE cualquier fila existente — si
      // el primer intento ya se había confirmado en el servidor (número,
      // estado, snapshots asignados) pero la respuesta se perdió antes de
      // llegar al cliente, este `upsert` los BORRABA de vuelta a blanco
      // ANTES de volver a llamar al RPC — que entonces veía
      // `numero_secuencial IS NULL` (recién borrado) y asignaba un número
      // NUEVO: exactamente la duplicación que se quería evitar.
      // `insertIfMissing` nunca sobrescribe una fila que ya existe.
      await db.facturas.insertIfMissing(f);
      useStore.setState((s) => ({
        facturas: s.facturas.some((x) => x.id === f.id) ? s.facturas : [...s.facturas, f],
      }));

      // Numeración atómica — SIEMPRE vía RPC de Supabase, nunca calculada en
      // el cliente. Si la migración de Fase H aún no está desplegada, el RPC
      // no existe: se informa con claridad y la factura queda como borrador
      // local (no se pierde, se puede reintentar).
      const { data, error: rpcError } = await supabase.rpc('emitir_factura_con_datos_fiscales', {
        p_factura_id: f.id, p_area: f.area, p_tipo: f.tipo, p_cliente: f.cliente,
        p_concepto: f.concepto, p_base_imponible: f.baseImponible, p_porcentaje_iva: f.porcentajeIVA,
        p_importe_iva: f.importeIVA, p_total: f.total, p_fecha: f.fecha, p_ingreso_id: f.ingresoId,
        p_porcentaje_facturado: f.porcentajeFacturado, p_notas: f.notas ?? null, p_datos_cliente: clienteFiscal,
      });
      if (rpcError) {
        // El id de emisión pendiente se CONSERVA a propósito (no se limpia
        // aquí) — si el fallo fue de red y el servidor sí llegó a procesar
        // la petición, el próximo reintento (con el mismo id, gracias a
        // `emisionPendiente.ts`) recuperará el número ya asignado en vez de
        // crear uno nuevo.
        setError(`No se pudo confirmar la emisión: ${rpcError.message}. Conservamos el mismo intento para comprobar su resultado al reintentar.`);
        return;
      }
      const numeroAsignado = Array.isArray(data) ? data[0]?.numero_emitido : data?.numero_emitido;
      if (!Number.isSafeInteger(Number(numeroAsignado)) || Number(numeroAsignado)<1) throw new Error('Respuesta de numeración no válida. Reintenta para comprobar el resultado.');
      const emitida = await db.facturas.getById(f.id);
      useStore.setState((state) => ({ facturas: state.facturas.map(x => x.id === emitida.id ? emitida : x) }));
      limpiarEmisionPendiente(ingreso.id); // operación resuelta — la próxima factura parcial de este ingreso debe pedir un id nuevo
      setAviso(`Factura emitida con el número ${numeroAsignado}. Guardando PDF en Drive…`);
      try {const synced=await syncInvoice(emitida);useStore.setState(state=>({facturas:state.facturas.map(x=>x.id===synced.id?synced:x)}));setAviso(`Factura ${numeroAsignado} emitida y guardada en Drive.`);}
      catch {setAviso(`Factura ${numeroAsignado} emitida. El PDF está disponible en Facturas; Drive queda pendiente y se puede reintentar sin emitir otra factura.`);} 
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo emitir la factura.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal isOpen onClose={()=>!guardando&&onClose()} title={`Generar factura — ${ingreso.concepto}`} size="xl">
      <div className="space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-gray-200 p-5 space-y-2"><h2 className="font-semibold">Datos fiscales de La Montada</h2><p className="text-sm font-medium">{emisor?.razonSocial||'Emisor pendiente'}</p><p className="text-sm">{emisor?.nifCif}</p><p className="text-sm text-gray-600">{emisor?.direccionFiscal}</p><div className="border-t pt-3 text-sm"><span className="font-medium">Numeración automática</span><p className="text-gray-500 mt-1">Se asignará el siguiente número disponible al emitir, continuando las facturas de la app y el archivo de Drive importado.</p></div></section>
          <fieldset disabled={guardando||!!emisionPreviaConfirmada} className="rounded-2xl border border-gray-200 p-5 space-y-3"><legend className="font-semibold px-1">Datos fiscales del cliente</legend>{(['nombre','nifCif','direccion','email','telefono'] as const).map(key=><label key={key} className="block text-sm">{{nombre:'Nombre o razón social *',nifCif:'NIF / CIF *',direccion:'Dirección fiscal *',email:'Email',telefono:'Teléfono'}[key]}<input className="input-form mt-1" required={['nombre','nifCif','direccion'].includes(key)} maxLength={key==='direccion'?1000:key==='nombre'?200:key==='nifCif'?40:250} value={clienteFiscal[key]} onChange={e=>{setClienteFiscal({...clienteFiscal,[key]:e.target.value});setPreviewUrl(null);}}/></label>)}</fieldset>
        </div>
        {/* ── Selector de porcentaje ─────────────────────────────────────── */}
        <div>
          <label className="label-form">Porcentaje a facturar</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {PORCENTAJES_RAPIDOS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setPorcentaje(p); setPersonalizado(''); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  personalizado === '' && porcentaje === p ? 'bg-gold-500 text-white border-gold-500' : 'border-gray-200 text-gray-600 hover:border-gold-300'
                }`}
              >
                {p}%{p === 0 ? ' (borrador)' : ''}
              </button>
            ))}
            <input
              type="number" min={0} max={100} placeholder="Personalizado %"
              value={personalizado}
              onChange={(e) => setPersonalizado(e.target.value)}
              className="input-form w-36"
            />
          </div>
          {!validacion.ok && (pctEfectivo ?? 0) > 0 && (
            <p className="text-xs text-red-500 mt-1">{validacion.motivo}</p>
          )}
        </div>

        {/* ── Concepto / observaciones ───────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="label-form">Concepto</label>
            <input className="input-form" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
          </div>
          <div>
            <label className="label-form">Observaciones (opcional)</label>
            <textarea className="input-form" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
        </div>

        {/* ── Cálculo de esta factura ─────────────────────────────────────── */}
        <div className="rounded-xl bg-gray-50 p-4 grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-gray-400 text-xs">Base</p><p className="font-mono font-semibold">{fmt(calculo.baseImponible)}</p></div>
          <div><p className="text-gray-400 text-xs">IVA ({ingreso.porcentajeIVA}%)</p><p className="font-mono font-semibold">{fmt(calculo.importeIVA)}</p></div>
          <div><p className="text-gray-400 text-xs">Total</p><p className="font-mono font-semibold">{fmt(calculo.total)}</p></div>
        </div>

        {/* ── Resumen del ingreso — facturado (nunca confundido con cobrado) ── */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-gray-100 p-3">
            <p className="font-semibold text-gray-700 mb-1.5">Facturación</p>
            <p>Ya facturado: <span className="font-mono">{resumen.porcentajeFacturado}%</span> ({fmt(resumen.importeFacturado)})</p>
            <p>Pendiente de facturar: <span className="font-mono">{resumen.porcentajePendiente}%</span> ({fmt(resumen.importePendienteDeFacturar)})</p>
          </div>
          <div className="rounded-xl border border-gray-100 p-3">
            <p className="font-semibold text-gray-700 mb-1.5">Cobro (independiente de lo facturado)</p>
            <p>Cobrado: <span className="font-mono">{fmt(cobrado)}</span></p>
            <p>Pendiente de cobrar: <span className="font-mono">{fmt(pendienteCobro)}</span></p>
          </div>
        </div>

        {!canEmitirFacturas && (
          <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 font-medium">
            No tienes permiso para emitir facturas — puedes previsualizar y guardar como borrador, pero la emisión
            real está bloqueada tanto aquí como en el servidor.
          </p>
        )}
        {requiereSeleccionManual ? (
          <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">Asigna un emisor a este proyecto en Administración → Emisores fiscales para emitir.</p>
        ) : <p className="text-sm text-gray-600">Emisor: {emisor?.razonSocial}</p>}

        {faltanDatosFiscales && (
          <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 font-medium">
            Completa los campos obligatorios de los datos fiscales del cliente y comprueba los del emisor.
          </p>
        )}
        {!faltanDatosFiscales && emisor && !emisor.numeracionConfirmada && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            La numeración de facturación todavía no ha sido confirmada por un administrador en Supabase — la
            emisión seguirá bloqueada por el servidor hasta entonces, aunque aquí los datos fiscales ya estén completos.
          </p>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        {aviso && <p className="text-sm text-accent-600 bg-accent-50 rounded-lg px-3 py-2">{aviso}</p>}

        {previewUrl && (
          <iframe title="Vista previa factura" src={previewUrl} className="w-full h-80 rounded-lg border border-gray-200" />
        )}

        <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={handlePreview} disabled={guardando}>Vista previa PDF</Button>
          <Button variant="secondary" onClick={handleGuardarBorrador} disabled={guardando || !canCreateLinea(lineaId)}>Guardar borrador</Button>
          <Button variant="primary" onClick={handleEmitir} disabled={guardando || !validacion.ok || faltanDatosFiscales || !!emisionPreviaConfirmada || !canEmitirFacturas || !emisor}>
            {guardando ? 'Emitiendo…' : emisionPreviaConfirmada ? `Ya emitida (nº ${emisionPreviaConfirmada.numero})` : `Emitir factura (${pctEfectivo || 0}%)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
