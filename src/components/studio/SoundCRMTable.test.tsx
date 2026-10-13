import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {SoundCRMTable} from './SoundCRMTable';
import type {FichaCRM} from '../../lib/crmSound';
afterEach(cleanup);
const row:FichaCRM={cliente_id:'test',cliente:{id:'test',nombre:'Ana Prueba',email:'ana@example.invalid',telefono:'123',nifCif:'',direccion:'',esEmpresa:false,observaciones:'',createdAt:''},etapa:'perdido',origen:'Instagram',contacto_nombre:'Ana',tipo_servicio:'boda',motivo_perdida:'Fecha no disponible',fecha_cierre:'2026-09-20',fecha_seguimiento:null,proxima_accion:'',notas:''};
describe('Tabla comercial',()=>{
 it('muestra el origen, contacto, cierre y motivo y permite editar',()=>{const edit=vi.fn();render(<MemoryRouter><SoundCRMTable rows={[row]} canEdit onEdit={edit}/></MemoryRouter>);expect(screen.getByText('Instagram')).toBeTruthy();expect(screen.getByText('ana@example.invalid')).toBeTruthy();expect(screen.getByText('Cerrado · perdido')).toBeTruthy();expect(screen.getByText('Fecha no disponible')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Editar Ana Prueba'}));expect(edit).toHaveBeenCalledWith(row);});
 it('no permite editar en modo lectura',()=>{render(<MemoryRouter><SoundCRMTable rows={[row]} canEdit={false} onEdit={vi.fn()}/></MemoryRouter>);expect(screen.queryByRole('button',{name:'Editar Ana Prueba'})).toBeNull();});
});
