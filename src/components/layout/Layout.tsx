import type { CSSProperties, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { SPACES, spaceForPath } from '../shell/spaces';
import { Dock } from '../shell/Dock';
import { TopBar } from '../shell/TopBar';

export const Layout = ({ children }: { children: ReactNode }) => {
  const reduceMotion = useReducedMotion();
  const saveError = useStore((s) => s._saveError);
  const { pathname } = useLocation();
  const canViewLinea = useAuthStore((s) => s.canViewLinea);
  const canViewModulo = useAuthStore((s) => s.canViewModulo);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const visible = SPACES.filter((s) => {
    if (s.linea) return canViewLinea(s.linea);
    if (s.id === 'admin') return canViewModulo('administracion') || isAdmin();
    if (s.modulo) return canViewModulo(s.modulo);
    return true;
  }).map((s) => (s.id === 'admin' && !isAdmin() ? { ...s, items: s.items.filter((i) => i.to !== '/admin/ajustes') } : s))
    .map((s) => (s.id === 'home' ? {
      ...s,
      items: s.items.filter((i) =>
        i.to === '/' || (i.to.includes('informes') ? canViewModulo('informes') : canViewModulo('contabilidad'))),
    } : s));

  const space = visible.find((s) => s.id === spaceForPath(pathname).id) ?? spaceForPath(pathname);

  return (
    <div
      className="app"
      style={{ '--tint-a': space.tint.from, '--tint-b': space.tint.to, '--tint-glow': space.tint.glow, '--tint-ink': space.tint.ink ?? '#ffffff' } as CSSProperties}
    >
      <div className="ambient" aria-hidden />
      <TopBar space={space} />
      {saveError && (
        <div role="alert" className="mx-auto max-w-6xl px-4 sm:px-6 mt-3">
          <div className="banner banner-danger">
            No se ha guardado el cambio. {saveError}
            <button className="ml-auto underline" onClick={() => useStore.setState({ _saveError: null })}>Cerrar</button>
          </div>
        </div>
      )}
      <main className="app-main">
        <motion.div
          className="finance-page"
          key={pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', bounce: 0, duration: 0.45 }}
        >
          {children}
        </motion.div>
      </main>
      <Dock spaces={visible} activeId={space.id} />
    </div>
  );
};
