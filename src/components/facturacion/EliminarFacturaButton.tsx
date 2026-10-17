import {Btn as Button} from '../kit';
import {useEliminarFactura} from '../../hooks/useEliminarFactura';
import type {Factura} from '../../types';
export function EliminarFacturaButton({factura,onDeleted,disabled=false}:{factura:Factura;onDeleted?:()=>void;disabled?:boolean}){
 const {remove,busy,error}=useEliminarFactura(onDeleted);
 return <span><Button variant="danger" disabled={busy||disabled} onClick={()=>remove(factura)}>{busy?'Eliminando…':'Eliminar factura'}</Button>{error&&<span role="alert" className="block text-red-700 text-sm">{error}</span>}</span>;
}
