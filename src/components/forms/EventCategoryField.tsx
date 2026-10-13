import {useId,useState} from 'react';
import {useStore} from '../../store/useStore';
import {useExpenseCategories,categoryOptions} from '../../lib/expenseCategoryConfig';
export function EventCategoryField({value='',onChange}:{value?:string;onChange:(value:string)=>void}){
 const id=useId();const gastos=useStore(s=>s.gastosEvento);
 const {categories}=useExpenseCategories();
 const options=categoryOptions(categories,'evento',gastos.map(g=>g.categoria));
 const [custom,setCustom]=useState(false);
 const isCustom=custom||!!value&&!options.includes(value);
 return <div className="space-y-2"><select aria-label="Categoría del gasto" className="input-form" value={isCustom?'__custom__':value} onChange={e=>{const next=e.target.value;setCustom(next==='__custom__');onChange(next==='__custom__'?'':next);}}>
 {!value&&!isCustom&&<option value="">Elige categoría</option>}{options.map(c=><option key={c} value={c}>{c}</option>)}<option value="__custom__">＋ Escribir otra categoría</option>
 </select>{isCustom&&<><label htmlFor={id} className="label-form">Nombre de la categoría</label><input id={id} className="input-form" value={value} onChange={e=>onChange(e.target.value)} maxLength={80} placeholder="Ej. Alojamiento, Catering…"/><p className="text-xs text-gray-500">Estará disponible en la lista al guardar el gasto.</p></>}</div>;
}
