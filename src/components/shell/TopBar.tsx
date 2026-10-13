import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { HardDriveDownload, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { isItemActive, type Space } from './spaces';
import { SpaceGlyph } from './Dock';

const downloadBackup = () => {
  const s = useStore.getState();
  const blob = new Blob(
    [JSON.stringify({
      version: '4',
      exportedAt: new Date().toISOString(),
      data: { eventos: s.eventos, ingresos: s.ingresos, gastos: s.gastos, suplidos: s.suplidos, facturas: s.facturas, equipo: s.equipo },
    }, null, 2)],
    { type: 'application/json' },
  );
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `finanzas-backup-${new Date().toISOString().slice(0, 10)}.json`,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

const ProfileMenu = () => {
  const { user, logout, isAdmin } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const initial = (user?.nombre || 'M').slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button className="avatar" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Mi cuenta">
        {initial}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="popover right-0 top-[calc(100%+10px)] w-64"
            style={{ transformOrigin: 'top right' }}
            initial={{ opacity: 0, scale: 0.94, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          >
            <div className="px-3 py-2.5">
              <p className="text-[15px] font-semibold">{user?.nombre}</p>
              <p className="text-[12px] text-ink-3 truncate">{user?.email}</p>
            </div>
            <div className="popover-sep" />
            {isAdmin() && (
              <button role="menuitem" className="popover-item" onClick={() => { downloadBackup(); setOpen(false); }}>
                <HardDriveDownload size={16} /> Copia de seguridad
              </button>
            )}
            <button role="menuitem" className="popover-item text-[#d70015]" onClick={async () => { await logout(); navigate('/login'); }}>
              <LogOut size={16} /> Cerrar sesión
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const TopBar = ({ space }: { space: Space }) => {
  const { pathname } = useLocation();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Mantiene visible la pestaña activa cuando la barra se desplaza en móvil.
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [pathname]);

  return (
    <header className="topbar" data-scrolled={scrolled}>
      <div className="topbar-inner">
        <Link to={space.home} className="flex items-center gap-2.5 shrink-0 press">
          <SpaceGlyph space={space} size={30} />
          <span className="text-[17px] font-semibold tracking-[-0.02em]">{space.label}</span>
        </Link>

        {space.items.length > 1 && (
          <div ref={scroller} className="segbar" role="navigation" aria-label={`Apartados de ${space.label}`}>
            {space.items.map((item) => {
              const active = isItemActive(item, pathname);
              return (
                <Link key={item.to} to={item.to} className="seg" aria-current={active ? 'page' : undefined}>
                  {active && (
                    <motion.span layoutId={`seg-${space.id}`} className="seg-pill" transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }} />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-3 shrink-0 ml-auto lg:ml-0">
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
};
