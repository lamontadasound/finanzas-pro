import { TrendingUp, Calendar, Wallet, FileText, Package, LayoutDashboard, Users, CreditCard } from 'lucide-react';
import type { LineaId } from './businessLines';

export interface LineaNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  group?: string;
}

// Submenú de cada línea de negocio. Todas viven bajo /lineas/<id>/* salvo
// DJ, que conserva sus rutas históricas /dj/* (ya funcionales desde antes
// de esta reestructuración) para no duplicar páginas ni romper enlaces.
export const LINEA_NAV_ITEMS: Record<LineaId, LineaNavItem[]> = {
  montada_sound: [
    {to:"/lineas/montada-sound/crm",label:"CRM",icon:Users},
    {to:"/lineas/montada-sound/clientes",label:"Clientes",icon:Users},
    { to: '/lineas/montada-sound/resumen',       label: 'Resumen',          icon: LayoutDashboard },
    { to: '/lineas/montada-sound/ingresos',      label: 'Ingresos',         icon: TrendingUp },
    { to: '/lineas/montada-sound/gastos-eventos', label: 'Gastos de eventos', icon: Calendar },
    { to: '/lineas/montada-sound/gastos',        label: 'Gastos generales', icon: Wallet },
    { to: '/lineas/montada-sound/inversiones',   label: 'Inversiones',      icon: Package },
    { to: '/lineas/montada-sound/informes',      label: 'Informes',         icon: FileText },
    { to: '/lineas/montada-sound/reparto-socios', label: 'Reparto socios',  icon: Users },
  ],
  dj: [
    { to: '/lineas/dj/resumen',           label: 'Resumen',              icon: LayoutDashboard },
    { to: '/dj/ingresos',                 label: 'Ingresos',             icon: TrendingUp },
    { to: '/dj/gastos-actuacion',         label: 'Gastos de actuación',  icon: Calendar },
    { to: '/dj/gastos',                   label: 'Gastos generales',     icon: Wallet },
    { to: '/dj/informes',                 label: 'Informes',             icon: FileText },
  ],
  real_madrid: [
    { to: '/lineas/real-madrid/resumen',            label: 'Resumen',             icon: LayoutDashboard },
    { to: '/lineas/real-madrid/ingresos',           label: 'Ingresos',            icon: TrendingUp },
    { to: '/lineas/real-madrid/gastos-actuacion',   label: 'Gastos de actuación', icon: Calendar },
    { to: '/lineas/real-madrid/gastos',             label: 'Gastos generales',    icon: Wallet },
    { to: '/lineas/real-madrid/inversiones',        label: 'Inversiones',         icon: Package },
    { to: '/lineas/real-madrid/informes',           label: 'Informes',            icon: FileText },
  ],
  montada_installations: [
    {to:'/lineas/installations/reparto-socios',label:'Reparto socios',icon:Users},
    { to: '/lineas/installations/resumen',              label: 'Resumen',                icon: LayoutDashboard },
    { to: '/lineas/installations/ingresos',             label: 'Ingresos',               icon: TrendingUp },
    { to: '/lineas/installations/gastos-instalacion',   label: 'Gastos de instalación',  icon: Calendar },
    { to: '/lineas/installations/gastos',               label: 'Gastos generales',       icon: Wallet },
    { to: '/lineas/installations/informes',             label: 'Informes',               icon: FileText },
  ],
};

// Acciones principales de cada proyecto, siempre en el mismo orden.
for (const [id,items] of Object.entries(LINEA_NAV_ITEMS)) {
 const base = id==='montada_sound'?'/lineas/montada-sound':id==='montada_installations'?'/lineas/installations':id==='real_madrid'?'/lineas/real-madrid':'/lineas/dj';
 if(id==='montada_sound'||id==='montada_installations') items.push({to:base+'/presupuestos',label:'Presupuestos',icon:FileText});
 if(id==='montada_sound')items.push({to:base+'/contratos',label:'Contratos',icon:FileText});
 items.push({to:base+'/generar-facturas',label:'Generar facturas',icon:FileText});
 items.push({to:base+'/pagos',label:'Pagos',icon:CreditCard});
 const order=['Resumen','Ingresos','Gastos de eventos','Gastos de actuación','Gastos de instalación','Gastos generales','CRM','Presupuestos','Contratos','Generar facturas','Clientes','Inversiones','Reparto socios','Pagos','Informes'];
 const rank=(label:string)=>order.indexOf(label) < 0 ? 99 : order.indexOf(label);
 items.sort((a,b)=>rank(a.label)-rank(b.label));
}

for(const item of Object.values(LINEA_NAV_ITEMS).flat()) {
 if(item.label==='Gastos de eventos'){item.group='Gastos';item.label='Por eventos';}
 if(item.label==='Gastos de actuación'){item.group='Gastos';item.label='Por actuación';}
 if(item.label==='Gastos de instalación'){item.group='Gastos';item.label='Por instalación';}
 if(item.label==='Gastos generales'){item.group='Gastos';item.label='Generales';}
 if(item.label==='Reparto socios')item.label='Reparto';
}
