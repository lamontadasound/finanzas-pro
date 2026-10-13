import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
// Browser-only drafts: keys must include the authenticated user and document scope.
export function useLocalDraft<T>(key:string,initial:()=>T):[T,Dispatch<SetStateAction<T>>,string]{
 const [value,setValue]=useState<T>(()=>{try{const raw=localStorage.getItem(key);if(raw){const saved=JSON.parse(raw);if(saved.version===1)return saved.value as T;}}catch{/* A damaged draft must not prevent opening the editor. */}return initial();});
 const [error,setError]=useState('');
 // Report the result of synchronizing with browser storage, including quota failures.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify({version:1,value}));setError('');}catch{setError('No se pudo guardar el borrador en este navegador. Guarda el documento antes de salir.');}},[key,value]);
 return [value,setValue,error];
}
