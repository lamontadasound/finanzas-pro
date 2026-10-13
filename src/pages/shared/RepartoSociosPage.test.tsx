import {afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {RepartoSociosPage} from './RepartoSociosPage';
const add=vi.fn().mockResolvedValue(true);
const socios=[{id:'js',nombre:'Julia',lineaNegocio:'montada_sound',activo:true},{id:'ji',nombre:'Julia',lineaNegocio:'montada_installations',activo:true}];
vi.mock('../../store/useStore',()=>({useStore:()=>({socios,ingresos:[],gastos:[],gastosEvento:[],movimientosSocios:[],addMovimientoSocio:(...a:unknown[])=>add(...a),updateMovimientoSocio:vi.fn(),deleteMovimientoSocio:vi.fn()})}));
vi.mock('../../store/useAuthStore',()=>({useAuthStore:()=>({canCreateLinea:()=>true,canEditLinea:()=>true,canDeleteLinea:()=>true})}));
vi.mock('../../store/useConfirmStore',()=>({useConfirmStore:()=>vi.fn()}));
afterEach(()=>{cleanup();add.mockReset().mockResolvedValue(true);});
describe('Reparto por importes',()=>{
 it('Installations ofrece meses y no capital',()=>{
 render(<RepartoSociosPage linea="montada_installations"/>);
 expect(screen.getByLabelText('Periodo del reparto').querySelectorAll('option')).toHaveLength(12);
 expect(screen.queryByText('Aportar capital')).toBeNull();expect(screen.queryByText('Retirar capital')).toBeNull();
 });
 it('Sound guarda el importe manual y mantiene el formulario si falla',async()=>{
 add.mockResolvedValue(false);render(<RepartoSociosPage/>);
 expect(screen.getByLabelText('Periodo del reparto').querySelectorAll('option')).toHaveLength(4);
 fireEvent.click(screen.getByText('Registrar reparto'));fireEvent.change(screen.getByLabelText('Importe (€)'),{target:{value:'345.67'}});fireEvent.click(screen.getByText('Guardar movimiento'));
 await waitFor(()=>expect(add).toHaveBeenCalledOnce());expect(add.mock.calls[0][0]).toMatchObject({socioId:'js',cantidad:345.67,tipo:'reparto_beneficio_cobrado'});
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar'));expect(screen.getByLabelText('Importe (€)')).toBeTruthy();
 });
});
