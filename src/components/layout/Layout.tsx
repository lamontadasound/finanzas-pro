import { useStore } from '../../store/useStore';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Sidebar2 } from '../layout2/Sidebar';
import { Header2 } from '../layout2/Header';
import { Dock2 } from '../layout2/Dock';

export const Layout = ({ children }: { children: ReactNode }) => {
  const reduceMotion = useReducedMotion();
  const saveError = useStore(s=>s._saveError);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="finance-shell studio-shell flex min-h-screen">
      <Sidebar2 mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header2 menuOpen={mobileOpen} onOpenMenu={() => setMobileOpen(true)} />
        {saveError && <div role="alert" className="mx-4 my-2 rounded-xl bg-red-50 text-red-800 p-4 text-sm">No se ha guardado el cambio. {saveError}<button className="ml-3 underline" onClick={()=>useStore.setState({_saveError:null})}>Cerrar</button></div>}
        <main className="flex-1 overflow-x-hidden min-w-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28 lg:pb-10">
              <motion.div
                className="finance-page"
                key={pathname}
                initial={reduceMotion ? false : { opacity: 0, y: 12, filter: 'blur(3px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', bounce: 0, duration: 0.5 }}
              >
                {children}
              </motion.div>
          </div>
        </main>
      </div>
      <Dock2 onOpenMenu={() => setMobileOpen(true)} />
    </div>
  );
};
