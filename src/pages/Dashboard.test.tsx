import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { fixtureIngresos } from '../dev/fixtures';
const year = new Date().getFullYear();
const model = {
  ingresos: [
    { ...fixtureIngresos[1], id: 'a', fechaEvento: `${year}-01-15`, baseImponible: 100, total: 121 },
    { ...fixtureIngresos[1], id: 'b', fechaEvento: `${year}-02-15`, baseImponible: 200, total: 242 },
    { ...fixtureIngresos[1], id: 'c', fechaEvento: `${year - 1}-02-15`, baseImponible: 50, total: 60.5 },
  ], gastos: [], gastosEvento: [], socios: [], movimientosSocios: [],
};
vi.mock('../store/useStore', () => ({ useStore: () => model }));
vi.mock('../store/useAuthStore', () => ({ useAuthStore: (selector: (s: unknown) => unknown) => selector({ profile: { rol: 'admin' }, lineasVisibles: () => ['dj'] }) }));
afterEach(cleanup);
describe('Resumen personal por mes', () => {
  it('cambia el desglose al seleccionar un mes sin alterar el total anual', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    const annual = screen.getByRole('region', { name: 'Resumen anual' });
    expect(annual.querySelector('.premium-annual')?.textContent).toBe('300,00 €');
    fireEvent.click(screen.getByRole('button', { name: /febrero/i }));
    const detail = screen.getByRole('region', { name: 'Detalle del mes' });
    expect(detail.querySelector('.premium-month-total')?.textContent).toContain('200,00');
    expect(screen.getByRole('button', { name: /febrero/i }).getAttribute('aria-pressed')).toBe('true');
    expect(annual.querySelector('.premium-annual')?.textContent).toBe('300,00 €');
  });
  it('el selector móvil y el cambio de año actualizan el mismo detalle', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Mes del resumen'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Año del resumen'), { target: { value: String(year - 1) } });
    const detail = screen.getByRole('region', { name: 'Detalle del mes' });
    expect(detail.querySelector('.premium-month-total')?.textContent).toContain('50,00');
    expect(screen.getByRole('link', { name: /Gestionar pagos/ }).getAttribute('href')).toBe('/contabilidad/pagos');
  });
});
it('octubre: resumen limpio con año sin accesos de documentos',()=>{render(<MemoryRouter><Dashboard/></MemoryRouter>);expect(screen.getByRole('heading',{name:`Tu Resumen Julia: ${year}`})).toBeTruthy();expect(screen.queryByRole('navigation',{name:'Accesos rápidos'})).toBeNull();expect(screen.queryByText('Mi espacio / Personal')).toBeNull();});
