import {useState} from 'react';
import {db} from '../lib/db';
import {useConfirmStore} from '../store/useConfirmStore';
import {useStore} from '../store/useStore';
import {supabase} from '../lib/supabase';
import type {Factura} from '../types';
export function useEliminarFactura(onDeleted?:()=>void){
 const confirm=useConfirmStore(s=>s.show),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const remove=(factura:Factura)=>{const draft=factura.numeroSecuencial==null;confirm(draft?'¿Eliminar este borrador sin emitir?':`¿Eliminar la factura ${factura.numero} del listado? Se conserva su historial contable y su número. No elimina el archivo de Drive.`,async()=>{setBusy(true);setError('');try{if(draft)await db.facturas.delete(factura.id);else {const {error:e}=await supabase.rpc('ocultar_factura_generada',{p_id:factura.id});if(e)throw e;}useStore.setState(s=>({facturas:draft?s.facturas.filter(f=>f.id!==factura.id):s.facturas.map(f=>f.id===factura.id?{...f,ocultaEn:new Date().toISOString()}:f)}));onDeleted?.();}catch(e){setError(e&&typeof e==='object'&&'message' in e?String(e.message):'No se pudo eliminar.');}finally{setBusy(false);}});};
 return {remove,busy,error};
}
