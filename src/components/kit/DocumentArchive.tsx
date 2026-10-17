import {useState,type ReactNode} from 'react';
import {YearGrid,MonthGrid} from '../ingresos/IngresosViews';
import {Btn,Widget} from './index';
import {LimitedList} from './LimitedList';

export function DocumentArchive<T>({items,date,total,render,unit=['documento','documentos']}:{items:T[];date:(item:T)=>string;total:(item:T)=>number;render:(item:T)=>ReactNode;unit?:[string,string]}) {
 const [year,setYear]=useState<number|null>(null);
 const [month,setMonth]=useState<number|null>(null);
 const [undated,setUndated]=useState(false);
 const dated=items.filter(i=>/^\d{4}-\d{2}-\d{2}/.test(date(i))&&!Number.isNaN(Date.parse(date(i))));
 const withoutDate=items.filter(i=>!dated.includes(i));
 const years=[...new Set(dated.map(i=>Number(date(i).slice(0,4))))].sort((a,b)=>b-a);
 const inYear=dated.filter(i=>Number(date(i).slice(0,4))===year);
 const rows=undated?withoutDate:inYear.filter(i=>Number(date(i).slice(5,7))===Number(month)+1).sort((a,b)=>date(b).localeCompare(date(a)));
 return <div className="space-y-4">
  {(year!==null||undated)&&<nav className="crumbs" aria-label="Archivo de documentos"><button onClick={()=>{setYear(null);setMonth(null);setUndated(false);}}>Archivo</button><span> / </span>{undated?<span>Sin fecha</span>:<><button onClick={()=>setMonth(null)}>{year}</button>{month!==null&&<span> / {new Date(year!,month,1).toLocaleDateString('es-ES',{month:'long'})}</span>}</>}</nav>}
  {!items.length?<Widget>Sin documentos todavía.</Widget>:undated||month!==null?<Widget pad={false}><LimitedList key={`${year}-${month}-${undated}`}>{rows.map(render)}</LimitedList></Widget>:year===null?<>
   <YearGrid unit={unit} onOpen={setYear} years={years.map(y=>{const r=dated.filter(i=>Number(date(i).slice(0,4))===y);return {year:y,count:r.length,total:r.reduce((n,i)=>n+total(i),0),months:Array.from({length:12},(_,m)=>r.filter(i=>Number(date(i).slice(5,7))===m+1).reduce((n,i)=>n+total(i),0))};})}/>
   {withoutDate.length>0&&<Btn onClick={()=>setUndated(true)}>Sin fecha ({withoutDate.length})</Btn>}
  </>:<MonthGrid year={year} unit={unit} emptyLabel="Sin documentos" onOpen={setMonth} months={Array.from({length:12},(_,m)=>{const r=inYear.filter(i=>Number(date(i).slice(5,7))===m+1);return {count:r.length,total:r.reduce((n,i)=>n+total(i),0),pendiente:0};})}/>}
 </div>;
}
