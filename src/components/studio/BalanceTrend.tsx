import {useId} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
export function BalanceTrend({values}:{values:number[]}){
 const id=useId().replace(/:/g,''),reduced=useReducedMotion();
 const data=values.map(v=>Number.isFinite(v)?v:0);
 const low=Math.min(0,...data),high=Math.max(1,...data),span=high-low;
 const points=data.map((v,i)=>`${12+i*496/Math.max(1,data.length-1)},${96-(v-low)/span*76}`);
 const line=points.length?`M ${points.join(' L ')}`:'';
 return <div className="finance-balance-trend"><svg viewBox="0 0 520 112" role="img" aria-label="Evolución mensual del beneficio personal y repartos recibidos" preserveAspectRatio="none"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#547dde" stopOpacity=".19"/><stop offset="100%" stopColor="#547dde" stopOpacity="0"/></linearGradient></defs><path d="M 12 96 H 508" stroke="#dedfe4" strokeDasharray="3 5"/>{line&&<><path d={`${line} L 508 106 L 12 106 Z`} fill={`url(#${id})`}/><motion.path d={line} fill="none" stroke="#547dde" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={reduced?false:{pathLength:0}} animate={{pathLength:1}} transition={{duration:reduced?0:.8,ease:'easeOut'}}/></>}</svg><div aria-hidden="true"><span>Ene</span><span>Jun</span><span>Dic</span></div></div>;
}
