import {useState} from 'react';
import {Download} from 'lucide-react';
import {db} from '../../lib/db';
import {leerArchivoLocal} from '../../lib/localFileStore';
import {supabase} from '../../lib/supabase';
import {DOCUMENTOS_BUCKET} from '../../lib/storage';
import {Button} from '../ui/Button';

export function AdjuntoLocalViewer({documentoId,nombre}:{documentoId:string;nombre?:string}) {
  const [error,setError]=useState<string|null>(null);
  const descargar=async()=>{
    setError(null);
    try {
      const doc=await db.documentos.getById(documentoId);
      let blob:Blob;
      if(doc.storageKey.startsWith('local-indexeddb/')) {
        const local=await leerArchivoLocal(documentoId);
        if(!local)throw new Error('Este adjunto antiguo está en el dispositivo donde se guardó. Vuelve a adjuntarlo para subirlo a la nube.');
        blob=local.blob;
      } else {
        const {data,error}=await supabase.storage.from(DOCUMENTOS_BUCKET).download(doc.storageKey);
        if(error||!data)throw new Error('No se pudo descargar el archivo. Comprueba tu conexión y tus permisos.');
        blob=data;
      }
      const url=URL.createObjectURL(blob); const link=document.createElement('a');
      link.href=url;link.download=doc.nombre||nombre||'factura';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(e instanceof Error?e.message:'No se pudo abrir el archivo.');}
  };
  return <div><Button icon={<Download size={14}/>} onClick={descargar}>Descargar adjunto</Button>{error&&<p role="alert" className="text-xs text-red-600 mt-1 max-w-sm">{error}</p>}</div>;
}
