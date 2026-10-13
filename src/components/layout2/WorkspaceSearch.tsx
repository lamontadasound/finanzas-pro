import {useEffect,useRef,useState,type MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import {useNavigate} from 'react-router-dom';
import {Search,ArrowUpRight,X} from 'lucide-react';
import {useAuthStore} from '../../store/useAuthStore';
import {BUSINESS_LINES,LINEA_IDS} from '../../config/businessLines';
import {LINEA_NAV_ITEMS} from '../../config/lineaNavItems';
export function WorkspaceSearch(){
 const auth=useAuthStore(),navigate=useNavigate();
 const ref=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),input=useRef<HTMLInputElement>(null);
 const [query,setQuery]=useState('');
 const open=()=>{setQuery('');ref.current?.showModal();input.current?.focus();};
 const close=()=>{ref.current?.close();trigger.current?.focus();};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setQuery('');ref.current?.showModal();input.current?.focus();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 const handleNavigate=(e:MouseEvent<HTMLButtonElement>)=>{const path=e.currentTarget.dataset.route;if(path){close();navigate(path);}};
 const items=[{to:'/',label:'Mi resumen',group:'Mi espacio'},...LINEA_IDS.filter(id=>auth.canViewLinea(id)).flatMap(id=>LINEA_NAV_ITEMS[id].map(item=>({...item,group:BUSINESS_LINES[id].shortLabel}))),...(auth.canViewModulo('contabilidad')?[{to:'/contabilidad/facturas',label:'Facturas',group:'Contabilidad'},{to:'/contabilidad/pagos',label:'Pagos',group:'Contabilidad'}]:[])];
 const results=items.filter(i=>`${i.label} ${i.group}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));
 return <><button ref={trigger} className="studio-search-trigger" onClick={open} aria-label="Buscar un apartado"><Search size={16}/><span>Ir a un apartado…</span><kbd>⌘ K</kbd></button>{createPortal(<dialog ref={ref} className="studio-search-dialog" onClick={e=>{if(e.target===e.currentTarget)close();}} aria-label="Buscar un apartado"><div className="studio-search-top"><Search size={18}/><input ref={input} aria-label="Nombre del apartado" placeholder="Clientes, presupuestos, pagos…" value={query} onChange={e=>setQuery(e.target.value)}/><button onClick={close} aria-label="Cerrar búsqueda"><X size={18}/></button></div><div className="studio-search-results">{results.length?results.map(i=><button key={i.to} data-route={i.to} onClick={handleNavigate}><span><small>{i.group}</small>{i.label}</span><ArrowUpRight size={16}/></button>):<p>No hay apartados que coincidan con tu búsqueda.</p>}</div><footer>Busca por nombre o línea de negocio · Esc para cerrar</footer></dialog>,document.body)}</>;
}
