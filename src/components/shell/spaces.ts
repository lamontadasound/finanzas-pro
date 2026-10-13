import {
  AudioLines, Disc3, Crown, Cable, House, Calculator, Settings2,
  LayoutGrid, ArrowDownLeft, Receipt, Radar, Contact, FileText, Signature,
  ReceiptText, Boxes, Split, CreditCard, ChartNoAxesColumn, Landmark, Users, SlidersHorizontal,
} from 'lucide-react';
import type { LineaId } from '../../config/businessLines';
import type { ModuloId } from '../../types';

export type SpaceIcon = typeof House;

export interface SpaceItem {
  to: string;
  label: string;
  icon: SpaceIcon;
  /** Rutas adicionales que también marcan este apartado como activo. */
  alsoActive?: string[];
  end?: boolean;
}

export interface Space {
  id: string;
  label: string;
  icon: SpaceIcon;
  /** Color del icono del dock y del ambiente de fondo. */
  tint: { from: string; to: string; glow: string };
  home: string;
  prefixes: string[];
  items: SpaceItem[];
  linea?: LineaId;
  modulo?: ModuloId;
  adminOnly?: boolean;
}

const montada = '/lineas/montada-sound';
const dj = '/lineas/dj';
const rm = '/lineas/real-madrid';
const inst = '/lineas/installations';

export const SPACES: Space[] = [
  {
    id: 'home', label: 'Mi espacio', icon: House,
    tint: { from: '#3a3a3c', to: '#636366', glow: '#8e8e93' },
    home: '/', prefixes: ['/contabilidad/informes', '/contabilidad/pagos'],
    items: [
      { to: '/', label: 'Resumen', icon: LayoutGrid, end: true },
      { to: '/contabilidad/informes', label: 'Informes', icon: ChartNoAxesColumn },
      { to: '/contabilidad/pagos', label: 'Pagos', icon: CreditCard, alsoActive: ['/contabilidad/pagos-pendientes'] },
    ],
  },
  {
    id: 'montada', label: 'La Montada', icon: AudioLines, linea: 'montada_sound',
    tint: { from: '#5b3f35', to: '#b0805f', glow: '#c99a74' },
    home: `${montada}/resumen`, prefixes: [montada, '/montada/'],
    items: [
      { to: `${montada}/resumen`, label: 'Resumen', icon: LayoutGrid },
      { to: `${montada}/ingresos`, label: 'Ingresos', icon: ArrowDownLeft },
      { to: `${montada}/gastos-eventos`, label: 'Gastos', icon: Receipt, alsoActive: [`${montada}/gastos`] },
      { to: `${montada}/crm`, label: 'CRM', icon: Radar },
      { to: `${montada}/clientes`, label: 'Clientes', icon: Contact },
      { to: `${montada}/presupuestos`, label: 'Presupuestos', icon: FileText },
      { to: `${montada}/contratos`, label: 'Contratos', icon: Signature },
      { to: `${montada}/generar-facturas`, label: 'Facturas', icon: ReceiptText },
      { to: `${montada}/inversiones`, label: 'Inversiones', icon: Boxes },
      { to: `${montada}/reparto-socios`, label: 'Reparto', icon: Split },
      { to: `${montada}/pagos`, label: 'Pagos', icon: CreditCard },
      { to: `${montada}/informes`, label: 'Informes', icon: ChartNoAxesColumn },
    ],
  },
  {
    id: 'dj', label: 'DJ', icon: Disc3, linea: 'dj',
    tint: { from: '#c2255c', to: '#f76707', glow: '#ff8a5c' },
    home: `${dj}/resumen`, prefixes: [dj, '/dj/'],
    items: [
      { to: `${dj}/resumen`, label: 'Resumen', icon: LayoutGrid },
      { to: '/dj/ingresos', label: 'Ingresos', icon: ArrowDownLeft },
      { to: '/dj/gastos-actuacion', label: 'Gastos', icon: Receipt, alsoActive: ['/dj/gastos'] },
      { to: `${dj}/generar-facturas`, label: 'Facturas', icon: ReceiptText },
      { to: `${dj}/pagos`, label: 'Pagos', icon: CreditCard },
      { to: '/dj/informes', label: 'Informes', icon: ChartNoAxesColumn },
    ],
  },
  {
    id: 'rm', label: 'Real Madrid', icon: Crown, linea: 'real_madrid',
    tint: { from: '#14213d', to: '#3a5a9b', glow: '#d4af37' },
    home: `${rm}/resumen`, prefixes: [rm],
    items: [
      { to: `${rm}/resumen`, label: 'Resumen', icon: LayoutGrid },
      { to: `${rm}/ingresos`, label: 'Ingresos', icon: ArrowDownLeft },
      { to: `${rm}/gastos-actuacion`, label: 'Gastos', icon: Receipt, alsoActive: [`${rm}/gastos`] },
      { to: `${rm}/inversiones`, label: 'Inversiones', icon: Boxes },
      { to: `${rm}/generar-facturas`, label: 'Facturas', icon: ReceiptText },
      { to: `${rm}/pagos`, label: 'Pagos', icon: CreditCard },
      { to: `${rm}/informes`, label: 'Informes', icon: ChartNoAxesColumn },
    ],
  },
  {
    id: 'inst', label: 'Instalaciones', icon: Cable, linea: 'montada_installations',
    tint: { from: '#0b5d5e', to: '#2fb3a3', glow: '#5fd3c3' },
    home: `${inst}/resumen`, prefixes: [inst],
    items: [
      { to: `${inst}/resumen`, label: 'Resumen', icon: LayoutGrid },
      { to: `${inst}/ingresos`, label: 'Ingresos', icon: ArrowDownLeft },
      { to: `${inst}/gastos-instalacion`, label: 'Gastos', icon: Receipt, alsoActive: [`${inst}/gastos`] },
      { to: `${inst}/presupuestos`, label: 'Presupuestos', icon: FileText },
      { to: `${inst}/generar-facturas`, label: 'Facturas', icon: ReceiptText },
      { to: `${inst}/reparto-socios`, label: 'Reparto', icon: Split },
      { to: `${inst}/pagos`, label: 'Pagos', icon: CreditCard },
      { to: `${inst}/informes`, label: 'Informes', icon: ChartNoAxesColumn },
    ],
  },
  {
    id: 'conta', label: 'Contabilidad', icon: Calculator, modulo: 'contabilidad',
    tint: { from: '#1d4e89', to: '#4f8fd6', glow: '#7fb0e8' },
    home: '/contabilidad/resumen', prefixes: ['/contabilidad'],
    items: [
      { to: '/contabilidad/resumen', label: 'Resumen', icon: LayoutGrid },
      { to: '/contabilidad/facturas', label: 'Facturas', icon: ReceiptText },
      { to: '/contabilidad/impuestos', label: 'Impuestos', icon: Landmark },
    ],
  },
  {
    id: 'admin', label: 'Ajustes', icon: Settings2, modulo: 'administracion',
    tint: { from: '#6c6c70', to: '#aeaeb2', glow: '#c7c7cc' },
    home: '/admin/usuarios', prefixes: ['/admin'],
    items: [
      { to: '/admin/usuarios', label: 'Usuarios y permisos', icon: Users },
      { to: '/admin/ajustes', label: 'Configuración', icon: SlidersHorizontal },
    ],
  },
];

const startsWith = (path: string, prefix: string) =>
  prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix || path.startsWith(prefix + '/');

/** Espacio activo: el que tenga el prefijo más largo que encaje con la ruta. */
export function spaceForPath(pathname: string): Space {
  let best: Space = SPACES[0];
  let bestLen = -1;
  for (const s of SPACES) {
    for (const p of s.prefixes) {
      if (startsWith(pathname, p) && p.length > bestLen) { best = s; bestLen = p.length; }
    }
  }
  return best;
}

export function isItemActive(item: SpaceItem, pathname: string) {
  if (item.end) return pathname === item.to;
  return [item.to, ...(item.alsoActive ?? [])].some((p) => startsWith(pathname, p));
}
