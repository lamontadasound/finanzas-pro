/** Símbolo propio: tres espacios superpuestos dentro de una piedra pulida. */
export function BrandMark({size=28,className=''}:{size?:number;className?:string}){
 return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="12" fill="#2563eb"/><path d="M10 27V16a3 3 0 0 1 3-3h2v14M18 27V11h4v16M25 27V17a3 3 0 0 1 3-3h2v13" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 31h22" stroke="#bfdbfe" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
