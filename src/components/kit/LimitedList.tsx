import {Children,useState,type ReactNode} from 'react';
import {Btn} from './index';
export function LimitedList({children,limit=12}:{children:ReactNode;limit?:number}){
 const [all,setAll]=useState(false);const rows=Children.toArray(children);
 return <>{all?rows:rows.slice(0,limit)}{rows.length>limit&&<div className="p-4"><Btn onClick={()=>setAll(!all)}>{all?'Ver menos':`Ver todos (${rows.length})`}</Btn></div>}</>;
}
