import {Modal} from '../ui/Modal';
// ── "Ver PDF" de una factura YA EMITIDA — usa SIEMPRE sus snapshots ────────
// CORRECCIÓN: al volver a descargar/previsualizar el PDF de una factura ya
// emitida, se debe reconstruir con los datos que tenía EN EL MOMENTO de
// emitirse (`emisorSnapshot`/`clienteSnapshot`, congelados por el servidor),
// nunca con el estado actual del emisor o del cliente — que pueden haber
// cambiado desde entonces (NIF corregido, IBAN nuevo, cliente editado…).
// Una factura ya emitida es un documento fiscal histórico: su PDF debe ser
// exactamente reproducible, siempre igual, pase lo que pase después.
import { useState, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { facturaPdfBlobUrl } from '../../lib/facturaPdf';
import type { Factura } from '../../types';

export function VerPdfFacturaButton({ factura }: { factura: Factura }) {
  const [url, setUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);

  useEffect(() => () => { if(url) URL.revokeObjectURL(url); }, [url]);
  const handleClick = () => {
    if (url) { URL.revokeObjectURL(url); setUrl(null); return; } // toggle: si ya está abierto, lo cierra
    setGenerando(true);
    try {
      const nuevaUrl = facturaPdfBlobUrl({
        factura: {
          numero: factura.numero, fecha: factura.fecha, concepto: factura.concepto,
          baseImponible: factura.baseImponible, importeIVA: factura.importeIVA,
          porcentajeIVA: factura.porcentajeIVA, retencion: factura.retencion,
          total: factura.total, porcentajeFacturado: factura.porcentajeFacturado,
          notas: factura.notas, fechaEvento:factura.fechaEvento,
        },
        // NUNCA el emisor/cliente en vivo — solo lo que quedó congelado al emitir.
        configuracionFiscal: factura.emisorSnapshot ?? null,
        cliente: { ...factura.clienteSnapshot, nombre: factura.clienteSnapshot?.nombre ?? factura.cliente },
      });
      setUrl(nuevaUrl);
    } finally {
      setGenerando(false);
    }
  };

  if (!factura.emisorSnapshot || !factura.clienteSnapshot) {
    // Facturas emitidas antes de que existiera el snapshot (o migradas sin
    // él) — no se reconstruye con datos en vivo, que sería exactamente el
    // fallo que esto corrige. Se informa en vez de fingir un PDF fiel.
    return <span className="text-[10px] text-gray-300" title="Esta factura no tiene datos fiscales congelados — no se puede regenerar su PDF de forma fiel">Sin snapshot</span>;
  }

  return (
    <div>
      <button onClick={handleClick} disabled={generando} className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-accent-600">
        {generando ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
        {url ? 'Cerrar PDF' : 'Ver PDF'}
      </button>
      {url && <Modal isOpen onClose={handleClick} title={`Factura ${factura.numero}`} size="xl"><div className="space-y-3"><a className="inline-block underline" href={url} download={`Factura-${factura.numero}.pdf`}>Descargar PDF</a><iframe title={`Factura ${factura.numero}`} src={url} className="w-full h-[65vh] border rounded-lg"/></div></Modal>}
    </div>
  );
}
