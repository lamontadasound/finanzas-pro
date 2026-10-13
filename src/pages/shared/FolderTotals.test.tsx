import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IngresosPage } from './IngresosPage';
import { GastosPage } from './GastosPage';
import { GastosEventoPage } from './GastosEventoPage';
import { InformesPage } from './InformesPage';
import { fixtureIngresos, fixtureGastos } from '../../dev/fixtures';

vi.mock('../../store/useAuthStore', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({canCreateLinea: () => false, canEditLinea: () => false, canDeleteLinea: () => false}) }));
vi.mock('../../components/charts-app/BklitCharts', () => ({ BklitBarCard: () => null, BklitGaugeCard: () => null }));
vi.mock('../../components/charts-app/ActivityHeatmap', () => ({ ActivityHeatmap: () => null }));
vi.mock('../../store/useStore', () => ({ useStore: (selector: (state: unknown) => unknown) => selector({
  ingresos: fixtureIngresos, gastos: fixtureGastos, equipo: [], suplidos: [], eventos: [], clientes: [], facturas: [], documentos: [],
  gastosEvento: [
    {id: 'cost-1', ingresoId: 'fx-i1', area: 'montada', fecha: '2026-06-14', categoria: 'DJ', importe: 121, baseImponible: 100, importeIVA: 21},
    {id: 'cost-2', ingresoId: 'fx-i1', area: 'montada', fecha: '2026-06-14', categoria: 'Montador', importe: 50},
  ],
}) }));
afterEach(cleanup);

describe('Totales sin IVA en carpetas', () => {
  it('suma ingresos sin IVA por año y mes, separando otras áreas', () => {
    render(<MemoryRouter><IngresosPage area="montada" /></MemoryRouter>);
    expect(screen.getByText(/Total sin IVA: 3300,00/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: /2026.*Total sin IVA/}));
    expect(screen.getByRole('button', {name: /Junio.*Total sin IVA: 2400,00/})).toBeTruthy();
    expect(screen.getByRole('button', {name: /Mayo.*Total sin IVA: 900,00/})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: /Junio.*Total sin IVA/}));
    expect(screen.getByText(/Total sin IVA Junio 2026:/).textContent).toContain('2400,00');
  });
  it('abre la rentabilidad con gastos enlazados e importes sin IVA', () => {
    render(<MemoryRouter><IngresosPage area="montada" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', {name: /2026.*Total sin IVA/}));
    fireEvent.click(screen.getByRole('button', {name: /Junio.*Total sin IVA/}));
    expect(screen.getByRole('columnheader',{name:'Gastos sin IVA'})).toBeTruthy();
    expect(screen.getByRole('columnheader',{name:'Beneficio'})).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button',{name:'Ver rentabilidad de Boda — Finca El Encinar'})[0]);
    const detail=within(screen.getByRole('dialog'));
    expect(detail.getByText('2250,00 €')).toBeTruthy();
    expect(detail.getByText('93,8 %')).toBeTruthy();
    expect(detail.getByText('Gastos vinculados (2)')).toBeTruthy();
    expect(detail.getByRole('link',{name:'Abrir gastos de este evento'}).getAttribute('href')).toBe('/lineas/montada-sound/gastos-eventos?ingreso=fx-i1');
  });
  it('abre directamente los gastos del ingreso seleccionado',()=>{
    render(<MemoryRouter initialEntries={['/lineas/montada-sound/gastos-eventos?ingreso=fx-i1']}><GastosEventoPage area="montada"/></MemoryRouter>);
    expect(screen.getByRole('heading',{name:'Boda — Finca El Encinar'})).toBeTruthy();
    expect(screen.getByText('2250,00 €')).toBeTruthy();
  });
  it('suma gastos sin IVA y conserva el total anual al entrar en el mes', () => {
    render(<GastosPage area="montada" />);
    fireEvent.click(screen.getByRole('button', {name: /2026.*Total sin IVA: 350,00/}));
    fireEvent.click(screen.getByRole('button', {name: /Marzo.*Total sin IVA: 350,00/}));
    expect(screen.getByText(/Total sin IVA Marzo 2026:/).textContent).toContain('350,00');
  });
  it('usa el desglose de IVA y conserva los costes históricos sin desglose', () => {
    render(<MemoryRouter><GastosEventoPage area="montada" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', {name: /2026.*Total sin IVA: 150,00/}));
    fireEvent.click(screen.getByRole('button', {name: /Junio.*Total sin IVA: 150,00/}));
    expect(screen.getByRole('button', {name: /Finca El Encinar.*Total sin IVA: 150,00/})).toBeTruthy();
  });
  it('mantiene el informe mensual sin el bloque de pagos duplicado', () => {
    render(<InformesPage area="montada" />);
    expect(screen.getByRole('heading', {name: 'Informes'})).toBeTruthy();
    expect(screen.getByRole('columnheader', {name: 'Total sin IVA'})).toBeTruthy();
    expect(screen.queryByText(/Pagos pendientes de/)).toBeNull();
    expect(screen.queryByText('Total pendiente de cobrar')).toBeNull();
  });
});
