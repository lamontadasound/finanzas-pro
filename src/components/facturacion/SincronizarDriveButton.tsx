import {useState} from 'react';
import {Cloud,Loader2,RefreshCw} from 'lucide-react';
import {syncInvoice} from '../../lib/invoiceSync';
import {useStore} from '../../store/useStore';
import {useAuthStore} from '../../store/useAuthStore';
import {lineaDeFactura} from '../../lib/contabilidad';
import type {Factura} from '../../types';
export function SincronizarDriveButton({factura}:{factura:Factura}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const allowed=useAuthStore(s=>s.canEditLinea(lineaDeFactura(factura)));
 if(factura.driveFileId)return <a className="inline-flex items-center gap-1 text-xs text-accent-700" href={factura.driveLink} target="_blank" rel="noreferrer"><Cloud size={14}/>Ver en Drive</a>;
 if(!allowed||factura.tipo==='emitida'&&!factura.numeroSecuencial)return null;
 return <div><button disabled={busy} className="inline-flex items-center gap-1 text-xs text-accent-700 disabled:opacity-50" onClick={async()=>{
  setBusy(true);setError('');try{const saved=await syncInvoice(factura);useStore.setState(s=>({facturas:s.facturas.map(f=>f.id===saved.id?saved:f)}));}catch(e){setError(e instanceof Error?e.message:'No se pudo sincronizar.');}finally{setBusy(false);}
 }}>{busy?<Loader2 size={14} className="animate-spin"/>:<RefreshCw size={14}/>} {busy?'Sincronizando…':'Guardar en Drive'}</button>{error&&<p role="alert" className="text-xs text-red-700 mt-1 max-w-xs">{error}</p>}</div>;
}
