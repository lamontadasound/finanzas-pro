import { useLocation } from 'react-router-dom';
import { Menu, Zap } from 'lucide-react';
import { ALL_NAV_TITLES } from './navConfig';

// Cabecera compacta — solo visible en móvil/tablet (la sidebar desktop ya
// muestra la navegación completa, así que aquí no se duplica: solo el botón
// de menú y el título de la sección actual).
export const Header = ({ onOpenMenu }: { onOpenMenu: () => void }) => {
  const { pathname } = useLocation();
  const current = ALL_NAV_TITLES.find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-white/90 backdrop-blur border-b border-gray-200">
      <button
        onClick={onOpenMenu}
        aria-label="Abrir menú"
        className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 active:scale-95 transition-transform"
      >
        <Menu size={19} />
      </button>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-md bg-gold-500 flex items-center justify-center flex-shrink-0">
          <Zap size={12} className="text-black" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-semibold text-gray-900 truncate">{current?.label ?? 'Finanzas Pro'}</p>
      </div>
    </header>
  );
};
