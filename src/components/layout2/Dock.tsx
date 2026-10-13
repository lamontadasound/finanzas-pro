import { MotionBarLinks } from './MotionBarLinks';
import { LayoutDashboard, Building2, Music2, Trophy, HardHat, Wallet, Menu, BarChart3, CreditCard } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { BUSINESS_LINES, LINEA_IDS, type LineaId } from '../../config/businessLines';

interface DockItem { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }

// Ruta de "resumen" de cada línea — usada para el acceso rápido del Dock.
const RESUMEN_ROUTE: Record<LineaId, string> = {
  montada_sound: '/lineas/montada-sound/resumen',
  dj: '/lineas/dj/resumen',
  real_madrid: '/lineas/real-madrid/resumen',
  montada_installations: '/lineas/installations/resumen',
};
const LINEA_ICON: Record<LineaId, typeof LayoutDashboard> = {
  montada_sound: Building2,
  dj: Music2,
  real_madrid: Trophy,
  montada_installations: HardHat,
};

// Dock claro flotante — solo apartados de primer nivel, todo el resto vive
// en el Menú deslizante. Fase F: ya no hardcodea 'montada'/'dj' — itera
// `lineasVisibles()` (misma fuente de verdad que Sidebar/rutas), así un
// usuario con acceso solo a Real Madrid ve Real Madrid aquí, y uno con
// varias líneas ve cada una que tenga permitida (máx. 3 primeras, para no
// desbordar el Dock — el resto sigue accesible desde "Menú").
export const Dock2 = ({ onOpenMenu }: { onOpenMenu: () => void }) => {
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const lineasVisibles = useAuthStore((s) => s.lineasVisibles());
  const canViewModulo = useAuthStore((s) => s.canViewModulo);

  const lineaItems: DockItem[] = LINEA_IDS
    .filter((id) => lineasVisibles.includes(id))
    .slice(0, isAdmin ? 2 : 3)
    .map((id) => ({ to: RESUMEN_ROUTE[id], label: BUSINESS_LINES[id].shortLabel, icon: LINEA_ICON[id] }));

  const items: DockItem[] = isAdmin ? [
    {to:'/',label:'Resumen',icon:LayoutDashboard,end:true},
    ...(canViewModulo('informes')?[{to:'/contabilidad/informes',label:'Informes',icon:BarChart3}]:[]),
    ...(canViewModulo('contabilidad')?[{to:'/contabilidad/pagos',label:'Pagos',icon:CreditCard}]:[]),
  ] : [...lineaItems,...(canViewModulo('contabilidad')?[{to:'/contabilidad/resumen',label:'Contabilidad',icon:Wallet}]:[])];

  return (
    <nav
      className="lg:hidden fixed bottom-3 inset-x-3 z-40 finance-glass finance-dock rounded-[28px] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.16)] border border-gray-100 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      <div className="flex items-stretch justify-around px-1 py-1">
        <MotionBarLinks items={items} id="dock-motion-tabs"/>
        <button
          onClick={onOpenMenu}
          className="lg:hidden flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-[56px] min-h-[48px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          <Menu size={18} strokeWidth={1.9} />
          <span className="text-[10px] font-medium">Más</span>
        </button>
      </div>
    </nav>
  );
};
