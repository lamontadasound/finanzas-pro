import {useState} from 'react';
import {Button} from '../ui/Button';
import {useConfirmStore} from '../../store/useConfirmStore';
import {useStore} from '../../store/useStore';
import {supabase} from '../../lib/supabase';
import type {Factura} from '../../types';
export function EliminarFacturaButton({factura,onDeleted}:{factura:Factura;onDeleted?:()=>void}){
 const confirm=useConfirmStore(s=>s.show),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const remove=()=>confirm(`¿Eliminar la factura ${factura.numero} del listado? Se conserva su historial contable y su número. No elimina el archivo de Drive.`,async()=>{setBusy(true);setError('');try{const {error:e}=await supabase.rpc('ocultar_factura_generada',{p_id:factura.id});if(e)throw e;useStore.setState(s=>({facturas:s.facturas.map(f=>f.id===factura.id?{...f,ocultaEn:new Date().toISOString()}:f)}));onDeleted?.();}catch(e){setError(e&&typeof e==='object'&&'message' in e?String(e.message):'No se pudo eliminar.');}finally{setBusy(false);}});
 return <span><Button variant="danger" disabled={busy} onClick={remove}>{busy?'Eliminando…':'Eliminar factura'}</Button>{error&&<span role="alert" className="block text-red-700 text-sm">{error}</span>}</span>;
}
