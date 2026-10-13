import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion';
import type { Space } from './spaces';

/** Icono de app: squircle con el degradado propio de cada espacio. */
export const SpaceGlyph = ({ space, size = 44 }: { space: Space; size?: number }) => {
  const Icon = space.icon;
  return (
    <span
      className="glyph"
      style={{
        width: size, height: size, borderRadius: size * 0.27,
        background: `linear-gradient(160deg, ${space.tint.to}, ${space.tint.from})`,
      }}
    >
      <Icon size={size * 0.48} strokeWidth={1.9} color="#fff" />
    </span>
  );
};

const BASE = 46;
const MAX = 66;
const RANGE = 130;

const DockIcon = ({ space, active, mouseX }: { space: Space; active: boolean; mouseX: MotionValue<number> }) => {
  const ref = useRef<HTMLAnchorElement>(null);
  const distance = useTransform(mouseX, (x) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !Number.isFinite(x)) return RANGE;
    return x - (r.left + r.width / 2);
  });
  const target = useTransform(distance, [-RANGE, 0, RANGE], [BASE, MAX, BASE], { clamp: true });
  const size = useSpring(target, { stiffness: 380, damping: 30, mass: 0.6 });

  return (
    <Link ref={ref} to={space.home} className="dock-item" aria-label={space.label} aria-current={active ? 'page' : undefined}>
      <motion.span style={{ width: size, height: size }} className="dock-icon">
        <SpaceGlyphFluid space={space} />
      </motion.span>
      <span className="dock-tip">{space.label}</span>
      <span className="dock-dot" data-on={active} />
    </Link>
  );
};

/** Variante que llena su contenedor (lo dimensiona el muelle del dock). */
const SpaceGlyphFluid = ({ space }: { space: Space }) => {
  const Icon = space.icon;
  return (
    <span className="glyph glyph-fluid" style={{ background: `linear-gradient(160deg, ${space.tint.to}, ${space.tint.from})` }}>
      <Icon strokeWidth={1.9} color="#fff" />
    </span>
  );
};

export const Dock = ({ spaces, activeId }: { spaces: Space[]; activeId: string }) => {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
  const lineas = spaces.filter((s) => s.linea);
  const home = spaces.find((s) => s.id === 'home');
  const tools = spaces.filter((s) => !s.linea && s.id !== 'home');

  const render = (s: Space) => <DockIcon key={s.id} space={s} active={s.id === activeId} mouseX={mouseX} />;

  return (
    <nav className="dock" aria-label="Espacios">
      <motion.div
        className="dock-tray"
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
      >
        {home && render(home)}
        {lineas.length > 0 && <span className="dock-sep" aria-hidden />}
        {lineas.map(render)}
        {tools.length > 0 && <span className="dock-sep" aria-hidden />}
        {tools.map(render)}
      </motion.div>
    </nav>
  );
};
