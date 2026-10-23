import {useEffect} from 'react';
import {create} from 'zustand';
import {supabase,supabaseConfigured} from './supabase';
import {EVENT_CATEGORIES} from './eventCategories';
export type ExpenseScope='general'|'evento';
export interface ExpenseCategory {nombre:string;color:string;general:boolean;evento:boolean}
export const GENERAL_CATEGORIES=['Almacén','RRSS','Marketing','Bodas.net','Personal','Impuestos','Material','Decoración'];
const PALETTE=['#2563eb','#7c3aed','#db2777','#d97706','#0d9488','#4f46e5','#dc2626','#059669','#9333ea','#0284c7','#c2410c','#475569'];
export const categoryKey=(name:string)=>name.trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
export function categoryColor(name:string,categories:ExpenseCategory[]=[]){
 const configured=categories.find(c=>categoryKey(c.nombre)===categoryKey(name));
 if(configured)return configured.color;
 let hash=0;for(const char of categoryKey(name))hash=(hash*31+char.charCodeAt(0))>>>0;
 return PALETTE[hash%PALETTE.length];
}
export const DEFAULT_CATEGORIES:ExpenseCategory[]=[...new Set([...GENERAL_CATEGORIES,...EVENT_CATEGORIES])].map((nombre,i)=>({nombre,color:PALETTE[i%PALETTE.length],general:GENERAL_CATEGORIES.includes(nombre),evento:EVENT_CATEGORIES.includes(nombre)}));
export function categoryOptions(categories:ExpenseCategory[],scope:ExpenseScope,historic:string[]=[]){
 const names=new Map(categories.filter(c=>c[scope]).map(c=>[categoryKey(c.nombre),c.nombre]));
 for(const name of historic)if(name?.trim()&&!names.has(categoryKey(name)))names.set(categoryKey(name),name.trim());
 return [...names.values()];
}
interface State {categories:ExpenseCategory[];loading:boolean;loaded:boolean;error:string;load:()=>Promise<void>;save:(category:ExpenseCategory)=>Promise<void>}
export const useExpenseCategoryStore=create<State>((set,get)=>({categories:DEFAULT_CATEGORIES,loading:false,loaded:false,error:'',
 load:async()=>{if(get().loading)return;set({loading:true,error:''});try{
 if(!supabaseConfigured){set({loaded:true});return;}
 const {data,error}=await supabase.from('expense_categories').select('nombre,color,general,evento').order('nombre');
 if(error)throw error;set({categories:data??DEFAULT_CATEGORIES,loaded:true});
 }catch{set({error:'No se pudo cargar la configuración de categorías. Reintenta.'});}finally{set({loading:false});}},
 save:async(category)=>{const {error}=await supabase.from('expense_categories').upsert(category,{onConflict:'nombre'});if(error)throw new Error('No se pudo guardar la categoría. Comprueba tus permisos y reintenta.');await get().load();if(get().error)throw new Error(get().error);}
}));
export function useExpenseCategories(){const state=useExpenseCategoryStore();const {loaded,load}=state;useEffect(()=>{if(!loaded)void load();},[loaded,load]);return state;}
