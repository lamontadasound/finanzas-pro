import {useAuthStore} from '../../store/useAuthStore';
import {sectionForPath} from '../../config/serviceSections';
import { Fragment, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Briefcase } from 'lucide-react';
import { BUSINESS_LINES, type LineaId } from '../../config/businessLines';
import { LINEA_NAV_ITEMS } from '../../config/lineaNavItems';

// Own directional drill-down menu; no source from the paid Motion Slide Menu component.
export function SlideMenuLineas({visibleLineas,onNavigate}:{visibleLineas:LineaId[];onNavigate?:()=>void}) {
  const {pathname}=useLocation();
  const canViewSeccion=useAuthStore(s=>s.canViewSeccion);
  const reduced=useReducedMotion();
  const [selected,setSelected]=useState<LineaId|null>(()=>visibleLineas.find(id=>LINEA_NAV_ITEMS[id].some(i=>pathname===i.to||pathname.startsWith(i.to+'/')))??null);
  const [direction,setDirection]=useState(1);
  const active=selected && visibleLineas.includes(selected) ? selected : null;
  const transition={type:'spring' as const,bounce:0,duration:reduced?0:.36};
  return <div className="slide-business-menu">
    <div className="slide-business-heading">{active ? <button onClick={()=>{setDirection(-1);setSelected(null);}} aria-label="Volver a líneas de negocio"><ArrowLeft size={15}/><span>{BUSINESS_LINES[active].shortLabel}</span></button>:<span><Briefcase size={15}/>Líneas de negocio</span>}</div>
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div key={active??'root'} custom={direction} variants={{enter:(d:number)=>({x:reduced?0:d*35,opacity:0}),exit:(d:number)=>({x:reduced?0:-d*35,opacity:0})}} initial="enter" animate={{x:0,opacity:1}} exit="exit" transition={transition}>
        {active ? LINEA_NAV_ITEMS[active].filter(item=>canViewSeccion(active,sectionForPath(item.to))).map((item,index)=><Fragment key={item.to}>{item.group&&LINEA_NAV_ITEMS[active][index-1]?.group!==item.group&&<div className="sound-nav-group">{item.group}</div>}<NavLink to={item.to} onClick={onNavigate} className={({isActive})=>`slide-business-item ${item.group?'sound-nav-child ':''}${isActive?'is-active':''}`}><item.icon size={16}/><span>{item.label}</span></NavLink></Fragment>) : visibleLineas.map(id=><button key={id} className="slide-business-item" onClick={()=>{setDirection(1);setSelected(id);}}><Briefcase size={15}/><span>{BUSINESS_LINES[id].shortLabel}</span><ChevronRight size={14}/></button>)}
      </motion.div>
    </AnimatePresence>
  </div>;
}
