import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

interface Props {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

const fmtDefault = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' } as Intl.NumberFormatOptions);

// ── Contador animado para cifras financieras ────────────────────────────────
// Prioridad absoluta: el valor correcto SIEMPRE debe estar visible. La
// animación es puramente decorativa y nunca debe poder dejar la cifra
// congelada en 0 ni en un valor obsoleto.
//
// Causa raíz del bug anterior (auditado en esta ronda): la actualización de
// `motionVal` solo ocurría dentro de un `useEffect` condicionado a
// `useInView(ref, { once: true })`, y el render inicial pintaba `format(0)`
// como placeholder mientras tanto. Si el IntersectionObserver no llegaba a
// disparar `inView=true` a tiempo — pestaña sin foco, remontajes de Strict
// Mode reiniciando la suscripción, un cambio de filtro que ya no cruza el
// umbral de intersección porque `once` ya se había "consumido" con un valor
// previo — el valor se quedaba anclado en 0 para siempre, sin ningún
// mecanismo de respaldo. Reproducido de forma determinista en Dashboard,
// Resumen contable e Informe contable durante esta auditoría.
//
// Solución — 3 cambios:
//  1. El render inicial (y cada actualización) siempre pinta `format(value)`
//     — nunca `0` como placeholder. El valor está disponible desde el
//     primer render porque `useMotionValue(value)` se inicializa YA en el
//     valor real, no en 0.
//  2. Se elimina la dependencia de `useInView`/`once`: cualquier cambio de
//     `value` dispara la transición del spring, se vea o no en pantalla —
//     así los remontajes, los cambios de filtro y la llegada asíncrona de
//     datos siempre convergen al valor correcto, no solo la "primera vez
//     que entra en viewport".
//  3. `prefers-reduced-motion` hace un salto directo (`motionVal.jump`) sin
//     pasar nunca por el spring, y fuerza el texto final de inmediato — tal
//     como exige el requisito: "cuando el movimiento reducido esté
//     activado, debe mostrar inmediatamente el valor final". Además, un
//     temporizador de seguridad (ligeramente más largo que la duración del
//     spring) fuerza el texto final por si el evento `change` no llegara a
//     disparar por cualquier motivo del entorno.
export const AnimatedNumber = ({ value, format = fmtDefault, className }: Props) => {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const motionVal = useMotionValue(value);
  const spring = useSpring(motionVal, { duration: 700, bounce: 0 });

  useEffect(() => {
    if (reduceMotion) {
      motionVal.jump(value);
      if (ref.current) ref.current.textContent = format(value);
      return;
    }
    motionVal.set(value);
    // Red de seguridad: si el evento 'change' del spring no llegara a
    // disparar (p.ej. pestaña en segundo plano), el valor final se fuerza
    // igualmente tras la duración de la animación — nunca queda obsoleto.
    const t = setTimeout(() => {
      if (ref.current) ref.current.textContent = format(value);
    }, 750);
    return () => clearTimeout(t);
  }, [value, reduceMotion, format, motionVal]);

  useEffect(() => {
    if (!ref.current) return;
    const unsub = spring.on('change', (v) => {
      if (ref.current) ref.current.textContent = format(v);
    });
    return unsub;
  }, [spring, format]);

  return <span ref={ref} className={className}>{format(value)}</span>;
};
