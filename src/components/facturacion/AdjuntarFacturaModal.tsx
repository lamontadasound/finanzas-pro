// ── "Adjuntar factura" — factura recibida de un Gasto (Fase H) ─────────────
// Registra la factura ORIGINAL del proveedor (su propio número, nunca la
// numeración interna de facturas emitidas) junto con el archivo (PDF/imagen).
// Detecta posibles duplicados con `esPosibleDuplicado` (mismo proveedor +
// mismo nº de proveedor, o mismo proveedor + misma fecha + mismo importe) —
// nunca bloquea, solo avisa para revisión humana.
//
// La subida real a Google Drive todavía no está conectada (Fase H, límite
// explícito). El archivo NO se presenta como "guardado" a menos que
// realmente lo esté: se persiste de verdad en IndexedDB de este navegador
// (`localFileStore`) antes de marcar nada como completado — si esa escritura
// falla, se informa el error y NO se crea la factura ni el documento (evita
// dejar un registro que dice "adjuntado" sin archivo real detrás).
import { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useStore } from '../../store/useStore';
import { esPosibleDuplicado } from '../../lib/facturacion';
import { subirDocumento } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { db, toDbFactura, toDbDocumento } from '../../lib/db';
import { syncInvoice } from '../../lib/invoiceSync';
import { useAuthStore } from '../../store/useAuthStore';
import { uid } from '../../utils/helpers';
import type { Gasto, Factura } from '../../types';

export function AdjuntarFacturaModal({ gasto, onClose }: { gasto: Gasto; onClose: () => void }) {
  const facturas = useStore((s) => s.facturas);
  const user=useAuthStore(s=>s.user);
  const [facturaId]=useState(uid);
  const [documentoGuardado,setDocumentoGuardado]=useState<Awaited<ReturnType<typeof subirDocumento>>|null>(null);

  const [numeroProveedor, setNumeroProveedor] = useState(gasto.numeroFactura ?? '');
  const [proveedor, setProveedor] = useState(gasto.proveedor ?? '');
  const [fecha, setFecha] = useState(gasto.fecha);
  const [concepto, setConcepto] = useState(gasto.concepto);
  const [base, setBase] = useState(gasto.baseImponible);
  const [iva, setIva] = useState(gasto.importeIVA);
  const [total, setTotal] = useState(gasto.total);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const facturasRecibidas = useMemo(() => facturas.filter((f) => f.tipo === 'recibida'), [facturas]);
  const posibleDuplicado = useMemo(
    () => esPosibleDuplicado({ proveedor, numeroProveedor, fecha, total }, facturasRecibidas),
    [proveedor, numeroProveedor, fecha, total, facturasRecibidas],
  );

  const handleGuardar = async () => {
    setError(null);
    if (!proveedor.trim() || !numeroProveedor.trim()) {
      setError('Proveedor y número de factura del proveedor son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      let documento=documentoGuardado;
      if(archivo && !documento) {
        documento=await subirDocumento({file:archivo,entityType:'gasto',entityId:gasto.id,area:gasto.area,tipo:'factura',subidoPor:user?.id??'',subidoPorNombre:user?.nombre??''});
        setDocumentoGuardado(documento);
      }
      const nueva: Factura = {
        id: facturaId, area: gasto.area, lineaNegocio:gasto.lineaNegocio, gastoId:gasto.id, tipo: 'recibida',
        numero: numeroProveedor, // número PROPIO del proveedor — nunca la serie interna
        numeroProveedor, proveedor,
        cliente: proveedor, concepto, baseImponible: base, porcentajeIVA: gasto.porcentajeIVA,
        importeIVA: iva, total, fecha,
        pagada: gasto.estadoPago === 'pagado', ivaDeducible: gasto.deducible,
        posibleDuplicado,
        syncEstado: archivo ? 'pendiente' : 'sin_sincronizar',
        documentoId: documento?.id,
        notas: `Vinculada al gasto: ${gasto.concepto} (${gasto.id})`,
      };

      const {error:saveError}=await supabase.rpc('save_received_invoice',{p_factura:toDbFactura(nueva),p_documento:documento?toDbDocumento(documento):null});
      if(saveError)throw new Error(saveError.message);
      const saved=await db.facturas.getById(facturaId);
      useStore.setState(state=>({facturas:[...state.facturas.filter(f=>f.id!==saved.id),saved],documentos:documento?[...state.documentos.filter(d=>d.id!==documento.id),documento]:state.documentos}));
      setOk('Factura guardada. '+(documento?'El adjunto está disponible entre dispositivos.':'Sin archivo adjunto.'));
      if(documento)try{const synced=await syncInvoice(saved);useStore.setState(state=>({facturas:state.facturas.map(f=>f.id===synced.id?synced:f)}));setOk('Factura y adjunto guardados también en Google Drive.');}catch{setOk('Factura y adjunto guardados. La copia en Google Drive queda pendiente; puedes reintentar desde Facturas.');}
    } catch(e){setError(e instanceof Error?e.message:'No se pudo guardar la factura.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Adjuntar factura — ${gasto.concepto}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-form">Proveedor *</label>
            <input className="input-form" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
          </div>
          <div>
            <label className="label-form">Nº factura del proveedor *</label>
            <input className="input-form" value={numeroProveedor} onChange={(e) => setNumeroProveedor(e.target.value)} />
          </div>
          <div>
            <label className="label-form">Fecha</label>
            <input type="date" className="input-form" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="label-form">Línea de negocio</label>
            <input className="input-form bg-gray-50" value={gasto.lineaNegocio ?? gasto.area} disabled />
          </div>
          <div className="col-span-2">
            <label className="label-form">Concepto</label>
            <input className="input-form" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
          </div>
          <div>
            <label className="label-form">Base</label>
            <input type="number" className="input-form" value={base} onChange={(e) => setBase(Number(e.target.value))} />
          </div>
          <div>
            <label className="label-form">IVA</label>
            <input type="number" className="input-form" value={iva} onChange={(e) => setIva(Number(e.target.value))} />
          </div>
          <div>
            <label className="label-form">Total</label>
            <input type="number" className="input-form" value={total} onChange={(e) => setTotal(Number(e.target.value))} />
          </div>
          <div>
            <label className="label-form">Archivo (PDF/imagen)</label>
            <input type="file" accept="application/pdf,image/*" className="input-form" disabled={!!documentoGuardado} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        {posibleDuplicado && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            ⚠️ Posible duplicado: ya existe una factura de este proveedor con el mismo número, o con la misma fecha e importe exactos.
          </p>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        {ok && <p className="text-sm text-accent-600 bg-accent-50 rounded-lg px-3 py-2">{ok}</p>}

        <p className="text-[11px] text-gray-400">El archivo se guarda en almacenamiento privado. La copia a tu carpeta de Google Drive se confirma por separado.</p>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cerrar</Button>
          <Button variant="primary" onClick={handleGuardar} disabled={guardando || !!ok} className="flex-1">
            {guardando ? 'Guardando…' : 'Adjuntar factura'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
