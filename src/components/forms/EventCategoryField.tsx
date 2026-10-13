import {useExpenseCategories,categoryOptions,categoryKey,type ExpenseScope} from '../../lib/expenseCategoryConfig';

/**
 * Selector cerrado de categorías. La lista se gestiona solo desde
 * Configuración; aquí no se pueden crear categorías nuevas. Si un gasto
 * antiguo tiene una categoría que ya no está configurada, se conserva como
 * opción para no perder el dato al editar.
 */
export function EventCategoryField({value='',onChange,scope='evento'}:{value?:string;onChange:(value:string)=>void;scope?:ExpenseScope}){
 const {categories}=useExpenseCategories();
 const options=categoryOptions(categories,scope);
 const legacy=!!value&&!options.some(o=>categoryKey(o)===categoryKey(value));
 return <select aria-label="Categoría del gasto" className="input-form" value={value} onChange={e=>onChange(e.target.value)}>
  {!value&&<option value="">Elige categoría</option>}
  {options.map(c=><option key={c} value={c}>{c}</option>)}
  {legacy&&<option value={value}>{value}</option>}
 </select>;
}
