import type {CSSProperties,HTMLAttributes} from 'react';
import {useReducedMotion} from 'framer-motion';
// Adaptación propia de la interacción Magic Card de Magic UI.
// Sin capas sobre botones ni animación continua; solo responde al puntero.
export function SpotlightSurface({className='',children,...props}:HTMLAttributes<HTMLDivElement>){
 const reduced=useReducedMotion();
 return <div {...props} className={`studio-spotlight ${className}`} onPointerMove={e=>{
  if(reduced||e.pointerType!=='mouse')return;
  const r=e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--spot-x',`${e.clientX-r.left}px`);
  e.currentTarget.style.setProperty('--spot-y',`${e.clientY-r.top}px`);
 }} style={{'--spot-x':'50%','--spot-y':'0%',...props.style} as CSSProperties}>{children}</div>;
}
