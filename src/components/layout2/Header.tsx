import { useAuthStore } from '../../store/useAuthStore';
import { useLocation } from 'react-router-dom';
import { SidebarToggleIcon } from '../unlumen-ui/sidebar-toggle-icon';
import { ALL_NAV_TITLES } from '../layout/navConfig';

// Header ancho y limpio — visible en todos los tamaños. En desktop convive
// con la sidebar mostrando solo el título de sección + acciones globales;
// en móvil incluye el botón de menú.
export const Header2 = ({ onOpenMenu, menuOpen = false }: { onOpenMenu: () => void; menuOpen?: boolean }) => {
  const { pathname } = useLocation();
  const profile = useAuthStore(s=>s.profile);
  const current = [...ALL_NAV_TITLES].sort((a,b)=>b.to.length-a.to.length).find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 min-h-16 py-3 px-4 lg:px-8 finance-header">
      <button
        onClick={onOpenMenu}
        aria-label="Abrir menú"
        className="lg:hidden p-2 -ml-2 rounded-full text-gray-500 hover:bg-white active:scale-95 transition-transform"
      >
        <SidebarToggleIcon isOpen={menuOpen}/>
      </button>
      <div className="studio-header-title">{pathname!=='/'&&<h2>{current?.label ?? 'Mi espacio'}</h2>}</div>
      <div className="flex-1" />
      <span className="studio-profile" aria-label={profile?.nombre||'Mi perfil'}>{(profile?.nombre||'M').slice(0,1).toUpperCase()}</span>
      <span className="hidden xl:inline text-xs font-medium text-gray-600">{new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</span>
    </header>
  );
};
