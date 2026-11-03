import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { pendienteDe, lineaDeIngreso } from '../../lib/contabilidad';
import { fmtShort } from '../../utils/helpers';
import { BrandMark } from '../ui/BrandMark';
import type { Space } from './spaces';

const Item = ({ space, active }: { space: Space; active: boolean }) => {
  const Icon = space.icon;
  return (
    <Link to={space.home} className="side-item" aria-current={active ? 'page' : undefined}>
      {active && <motion.span layoutId="side-pill" className="side-pill" transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }} />}
      <Icon size={16} strokeWidth={1.9} className="relative" />
      <span className="relative">{space.label}</span>
    </Link>
  );
};

/** Barra lateral de escritorio: saludo, espacios y tarjeta de lo pendiente de cobro. */
export const Sidebar = ({ spaces, activeId }: { spaces: Space[]; activeId: string }) => {
  const { pathname } = useLocation();
  const nombre = useAuthStore((s) => s.user?.nombre) ?? '';
  const lineas = useAuthStore((s) => s.lineasVisibles());
  const ingresos = useStore((s) => s.ingresos);
  const pendiente = ingresos
    .filter((i) => lineas.includes(lineaDeIngreso(i)) && ['pendiente', 'parcial'].includes(i.estadoPago))
    .reduce((a, i) => a + pendienteDe(i), 0);
  const home = spaces.find((s) => s.id === 'home');
  const negocio = spaces.filter((s) => s.linea);
  const gestion = spaces.filter((s) => !s.linea && s.id !== 'home');
  const primerNombre = nombre.split(' ')[0];

  return (
    <aside className="side">
      <Link to="/" className="flex items-center gap-2 press"><BrandMark size={26} /><b className="text-[15px] tracking-[-0.02em]">Mi espacio</b></Link>
      <h2 className="side-hello">Hola,<br />{primerNombre || 'de nuevo'}</h2>

      <nav className="side-nav" aria-label="Espacios">
        {home && <Item space={home} active={activeId === home.id} />}
        {negocio.length > 0 && <p className="side-group">Negocio</p>}
        {negocio.map((s) => <Item key={s.id} space={s} active={activeId === s.id} />)}
        {gestion.length > 0 && <p className="side-group">Gestión</p>}
        {gestion.map((s) => <Item key={s.id} space={s} active={activeId === s.id} />)}
      </nav>

      {pathname !== '/contabilidad/pagos' && (
        <Link to="/contabilidad/pagos" className="side-promo">
          <span className="text-[12.5px] font-medium opacity-80">Por cobrar</span>
          <b className="num text-[24px] tracking-[-0.03em] mt-1">{fmtShort(pendiente)}</b>
          <span className="side-promo-go"><ArrowUpRight size={15} /></span>
        </Link>
      )}
    </aside>
  );
};
