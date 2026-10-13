import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { AnimatedNumber } from './AnimatedNumber';

afterEach(cleanup);

const fmt = (n: number) => n.toFixed(2) + ' €';

describe('AnimatedNumber — nunca se queda congelado en 0', () => {
  it('el valor está disponible desde el primer render (no pinta 0 como placeholder)', () => {
    const { container } = render(<AnimatedNumber value={1234.5} format={fmt} />);
    // Render inicial síncrono: debe mostrar el valor real, nunca "0.00 €".
    expect(container.textContent).toBe('1234.50 €');
  });

  it('un valor de 0 real se muestra correctamente (no se confunde con el placeholder)', () => {
    const { container } = render(<AnimatedNumber value={0} format={fmt} />);
    expect(container.textContent).toBe('0.00 €');
  });

  it('valores cargados de forma asíncrona (props que cambian tras el montaje) convergen al valor final', async () => {
    const { container, rerender } = render(<AnimatedNumber value={0} format={fmt} />);
    expect(container.textContent).toBe('0.00 €');
    // Simula que los datos reales llegan después (fetch asíncrono resuelto).
    rerender(<AnimatedNumber value={9999.99} format={fmt} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 800)); // pasa la red de seguridad (750ms)
    });
    expect(container.textContent).toBe('9999.99 €');
  });

  it('remontajes y cambios de filtro (nuevo `value`) siempre terminan mostrando el valor correcto', async () => {
    const { container, rerender, unmount } = render(<AnimatedNumber value={100} format={fmt} />);
    rerender(<AnimatedNumber value={500} format={fmt} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
    expect(container.textContent).toBe('500.00 €');
    unmount();

    // Remontaje completo (simula Strict Mode / navegación entre pestañas) con un valor distinto.
    const { container: c2 } = render(<AnimatedNumber value={777.25} format={fmt} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
    expect(c2.textContent).toBe('777.25 €');
  });

  it('con prefers-reduced-motion activado, muestra el valor final inmediatamente, sin quedarse en 0', () => {
    // jsdom no implementa matchMedia — se define primero para poder simular
    // que el sistema operativo pide movimiento reducido.
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    const { container } = render(<AnimatedNumber value={4242.42} format={fmt} />);
    expect(container.textContent).toBe('4242.42 €');

    window.matchMedia = original;
  });
});
