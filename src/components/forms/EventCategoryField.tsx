import {useId} from 'react';
import {useStore} from '../../store/useStore';
import {DEFAULT_CATEGORIES,categoryOptions,type ExpenseScope} from '../../lib/expenseCategoryConfig';
/** New names persist with the expense and become suggestions for subsequent expenses. */
export function EventCategoryField({value='',onChange,scope='evento'}:{value?:string;onChange:(value:string)=>void;scope?:ExpenseScope}){
 const id=useId();const historic=useStore(s=>scope==='evento'?s.gastosEvento:s.gastos);
 const options=categoryOptions(DEFAULT_CATEGORIES,scope,historic.map(g=>g.categoria));
 return <><input aria-label="Categoría del gasto" className="input-form" list={id} value={value} maxLength={80} placeholder="Elige o escribe una categoría" onChange={e=>onChange(e.target.value)} onBlur={()=>onChange(value.trim().replace(/\s+/g,' '))}/><datalist id={id}>{options.map(c=><option key={c} value={c}/>)}</datalist></>;
}
