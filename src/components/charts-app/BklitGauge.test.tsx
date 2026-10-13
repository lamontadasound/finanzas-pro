import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {BklitGaugeCard} from './BklitCharts';
vi.mock('../charts/gauge',()=>({Gauge:({value}:{value:number})=><div data-testid="arc" data-value={value}/>}));
afterEach(cleanup);
describe('Margen legible fuera del arco',()=>{
 it.each([-350.25,325.6,0])('preserva el porcentaje real %s y limita solo el arco',pct=>{
  render(<BklitGaugeCard ingresosOperativos={100} margen={pct/100}/>);
  const label=screen.getByLabelText(`Margen operativo: ${pct.toLocaleString('es-ES',{maximumFractionDigits:1})}%`);
  expect(label.closest('[aria-hidden="true"]')).toBeNull();
  expect(screen.getByTestId('arc').getAttribute('data-value')).toBe(String(Math.min(100,Math.max(0,pct))));
 });
 it('no inventa un margen cuando no hay ingresos',()=>{
  render(<BklitGaugeCard ingresosOperativos={0} margen={0}/>);
  expect(screen.getByText('Sin datos')).toBeTruthy();expect(screen.queryByTestId('arc')).toBeNull();
 });
});
