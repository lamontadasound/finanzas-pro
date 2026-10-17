import {afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {RepartoSociosPage} from './RepartoSociosPage';
const movements=vi.hoisted(()=>[] as Array<{id:string;socioId:string;tipo:string;fecha:string;cantidad:number;concepto:string}>);
const add=vi.fn().mockResolvedValue(true);
const socios=[{id:'js',nombre:'Julia',lineaNegocio:'montada_sound',activo:true},{id:'ji',nombre:'Julia',lineaNegocio:'montada_installations',activo:true}];
vi.mock('../../store/useStore',()=>({useStore:()=>({socios,ingresos:[],gastos:[],gastosEvento:[],movimientosSocios:movements,addMovimientoSocio:(...a:unknown[])=>add(...a),updateMovimientoSocio:vi.fn(),deleteMovimientoSocio:vi.fn()})}));
vi.mock('../../store/useAuthStore',()=>({useAuthStore:()=>({canCreateLinea:()=>true,canEditLinea:()=>true,canDeleteLinea:()=>true})}));
vi.mock('../../store/useConfirmStore',()=>({useConfirmStore:()=>vi.fn()}));
afterEach(()=>{cleanup();movements.length=0;add.mockReset().mockResolvedValue(true);});
describe('Reparto por importes',()=>{
 it('Installations ofrece un año completo y no capital',()=>{
 render(<RepartoSociosPage linea="montada_installations"/>);
 expect(screen.queryByLabelText('Periodo del reparto')).toBeNull();expect(screen.getByRole('group',{name:'Año'})).toBeTruthy();
 expect(screen.queryByText('Aportar capital')).toBeNull();expect(screen.queryByText('Retirar capital')).toBeNull();
 });
 it('Sound guarda el importe manual y mantiene el formulario si falla',async()=>{
 add.mockResolvedValue(false);render(<RepartoSociosPage/>);
 expect(screen.queryByLabelText('Periodo del reparto')).toBeNull();
 fireEvent.click(screen.getByText('Registrar reparto'));fireEvent.change(screen.getByLabelText('Importe (€)'),{target:{value:'345.67'}});fireEvent.click(screen.getByText('Guardar movimiento'));
 await waitFor(()=>expect(add).toHaveBeenCalledOnce());expect(add.mock.calls[0][0]).toMatchObject({socioId:'js',cantidad:345.67,tipo:'reparto_beneficio_cobrado'});
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar'));expect(screen.getByLabelText('Importe (€)')).toBeTruthy();
 });
});

it('incluye enero y diciembre del año, excluyendo años anteriores',()=>{
 const y=new Date().getFullYear();
 movements.push(...[{id:'ene',fecha:`${y}-01-01`,cantidad:100},{id:'dic',fecha:`${y}-12-31`,cantidad:200},{id:'old',fecha:`${y-1}-12-31`,cantidad:900}].map(m=>({...m,socioId:'js',tipo:'reparto_beneficio_cobrado',concepto:m.id})));
 render(<RepartoSociosPage/>);
 expect(screen.getByRole('button',{name:'Editar ene'})).toBeTruthy();expect(screen.getByRole('button',{name:'Editar dic'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Editar old'})).toBeNull();
 expect(screen.getByText('Repartido:').textContent).toContain('300,00');
});
