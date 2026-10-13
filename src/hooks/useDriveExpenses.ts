import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {useAuthStore} from '../store/useAuthStore';
import {joinDriveExpenses,type DriveExpenseFile,type DriveExpenseAmount,type DriveExpense} from '../lib/driveExpenses';
export function useDriveExpenses(){
 const admin=useAuthStore(s=>s.isAdmin());const profileId=useAuthStore(s=>s.profile?.id);
 const [snapshot,setSnapshot]=useState<{owner:string|undefined;rows:DriveExpense[]}>({owner:undefined,rows:[]}),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 const mounted=useRef(false),busy=useRef(false),generation=useRef(0);
 const load=useCallback(async()=>{
  const current=generation.current;
  const [f,a]=await Promise.all([supabase.from('drive_invoice_files').select('*').eq('tipo','recibida'),supabase.from('drive_expense_amounts').select('*')]);
  if(f.error||a.error)throw new Error('No se pudieron cargar los gastos de Drive.');
  if(mounted.current&&generation.current===current)setSnapshot({owner:profileId,rows:joinDriveExpenses(f.data as DriveExpenseFile[],a.data as DriveExpenseAmount[])});
 },[profileId]);
 const refresh=useCallback(async()=>{
  if(!admin||busy.current)return;busy.current=true;if(mounted.current){setRefreshing(true);setError('');}
  try{const {data,error:err}=await supabase.functions.invoke('drive-invoice-archive');
   if(err||!data?.ok){let message=data?.error;if(err&&'context' in err&&err.context instanceof Response)message=(await err.context.json().catch(()=>null))?.error??message;throw new Error(message||'No se pudo actualizar desde Drive. Se muestra la última importación.');}
   await load();
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'No se pudo actualizar Drive.');}finally{busy.current=false;if(mounted.current)setRefreshing(false);}
 },[admin,load]);
 useEffect(()=>{mounted.current=true;const current=++generation.current;
  void Promise.resolve().then(async()=>{if(!mounted.current||generation.current!==current)return;setLoading(true);setError('');try{await load();}catch(e){if(mounted.current&&generation.current===current)setError(e instanceof Error?e.message:'No se pudo cargar Drive.');}finally{if(mounted.current&&generation.current===current)setLoading(false);}});
  // Refresh when opening, then every five minutes while this section is visible.
  void refresh();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},300000);
  return()=>{mounted.current=false;generation.current=current+1;window.clearInterval(timer);};
 },[load,refresh,profileId]);
 return {rows:snapshot.owner===profileId?snapshot.rows:[],error,loading,refreshing,refresh,reload:load,admin};
}
