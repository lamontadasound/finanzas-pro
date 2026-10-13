import {useState} from 'react';
import {useAuthStore} from '../../store/useAuthStore';
import {useStore} from '../../store/useStore';
import {useConfirmStore} from '../../store/useConfirmStore';
import {lineaDeFactura} from '../../lib/contabilidad';
import {supabase} from '../../lib/supabase';
import {db} from '../../lib/db';
import {Button} from '../ui/Button';
import {Modal} from '../ui/Modal';
import type {Factura} from '../../types';
export function EditarNumeroFactura({factura}:{factura:Factura}){
 const allowed=useAuthStore(s=>s.canGestionarNumeracion()&&s.canEditLinea(lineaDeFactura(factura))),actor=useAuthStore(s=>s.user?.id),confirm=useConfirmStore(s=>s.show);
 const [open,setOpen]=useState(false),[value,setValue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!allowed||factura.estado==='anulada'||factura.ocultaEn||factura.numeroSecuencial==null)return null;
 const save=()=>{const number=Number(value);if(!Number.isSafeInteger(number)||number<1){setError('Indica un número entero positivo.');return;}confirm(`¿Cambiar el número ${factura.numero} por ${number}? El cambio quedará registrado.`,async()=>{setBusy(true);setError('');try{const {error:e}=await supabase.rpc('editar_numero_factura',{p_id:factura.id,p_numero:number});if(e)throw e;const updated=await db.facturas.getById(factura.id);if(useAuthStore.getState().user?.id===actor)useStore.setState(s=>({facturas:s.facturas.map(f=>f.id===updated.id?updated:f)}));setOpen(false);}catch(e){setError(e&&typeof e==='object'&&'message' in e?String(e.message):'No se pudo cambiar el número.');}finally{setBusy(false);}});};
 return <><Button onClick={()=>{setValue(factura.numeroSecuencial!.toString());setError('');setOpen(true);}}>Editar numeración</Button><Modal isOpen={open} onClose={()=>!busy&&setOpen(false)} title={`Numeración de factura ${factura.numero}`}><div className="space-y-4"><label className="block">Número de factura<input className="input-form" type="number" min="1" step="1" value={value} disabled={busy} onChange={e=>setValue(e.target.value)}/></label><p className="text-sm text-gray-500">Los números usados por otras facturas no pueden repetirse. El número anterior queda en el historial.</p>{error&&<p role="alert" className="text-red-700">{error}</p>}<Button disabled={busy} onClick={save}>{busy?'Guardando…':'Guardar numeración'}</Button></div></Modal></>;
}
