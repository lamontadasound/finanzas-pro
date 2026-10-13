import {NavLink} from 'react-router-dom';
import {motion,useReducedMotion} from 'framer-motion';
import type {LucideIcon} from 'lucide-react';
export function MotionBarLinks({items,id}:{items:{to:string;label:string;icon:LucideIcon;end?:boolean}[];id:string}){
 const reduced=useReducedMotion();
 return <div className="motion-bar-links">{items.map(item=><NavLink key={item.to} to={item.to} end={item.end} aria-label={item.label} title={item.label}>{({isActive})=><motion.span className={`motion-bar-tab ${isActive?'is-active':''}`} whileTap={reduced?undefined:{scale:.94}} transition={{type:'spring',stiffness:450,damping:32}}>{isActive&&<motion.span className="motion-bar-pill" layoutId={reduced?undefined:id} transition={{type:'spring',stiffness:400,damping:35}}/>}<span className="relative flex"><item.icon size={21} strokeWidth={isActive?2.2:1.75}/></span><span className="motion-bar-label">{item.label}</span></motion.span>}</NavLink>)}</div>;
}
