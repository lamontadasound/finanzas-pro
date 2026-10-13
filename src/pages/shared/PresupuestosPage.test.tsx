import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PresupuestosPage } from './PresupuestosPage';
import { nuevoPresupuesto, type PresupuestoContenido } from '../../lib/presupuestos';
import { listarPresupuestos, guardarPresupuesto } from '../../lib/presupuestosDb';
const rights = vi.hoisted(() => ({ create:true,edit:true }));
vi.mock('../../store/useAuthStore',()=>({useAuthStore:(s:(v:unknown)=>unknown)=>s({canCreateLinea:()=>rights.create,canEditLinea:()=>rights.edit,canDeleteLinea:()=>false})}));
vi.mock('../../lib/presupuestosDb',()=>({listarPresupuestos:vi.fn(),guardarPresupuesto:vi.fn(),eliminarPresupuesto:vi.fn()}));
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();rights.create=true;rights.edit=true;vi.mocked(listarPresupuestos).mockResolvedValue([]);});
describe('Editor de presupuestos',()=>{
  it('no consulta ni permite crear presupuestos en DJ o Real Madrid',()=>{
    const {rerender}=render(<PresupuestosPage linea="dj"/>);
    expect(screen.queryByRole('button',{name:'Nuevo presupuesto'})).toBeNull();
    rerender(<PresupuestosPage linea="real_madrid"/>);
    expect(listarPresupuestos).not.toHaveBeenCalled();
  });
  it('abre propuestas desde las carpetas y cambia la opción Incluido con Apple Switch',async()=>{
    const contenido={...nuevoPresupuesto(),fecha:'2026-09-15',titulo:'Árbol de archivo',cliente:'Archivo',conceptos:[{id:'a',descripcion:'Montaje',cantidad:1,precio:100}]};
    vi.mocked(listarPresupuestos).mockResolvedValue([{id:'tree',numero:12,linea_negocio:'montada_sound',revision:1,contenido}]);
    render(<PresupuestosPage linea="montada_sound"/>);
    await screen.findByText('Árbol de archivo');
    fireEvent.click(screen.getByText('Archivo por año y mes'));
    fireEvent.click(screen.getByRole('button',{name:'septiembre'}));
    fireEvent.click(screen.getByRole('button',{name:'PRE-00012 · Archivo'}));
    const toggle=screen.getByRole('switch',{name:'Incluido'});
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('Seleccionar foto')).toBeTruthy();
  });
  it('cambia a tarjetas, filtra y abre el mismo presupuesto sin modificarlo',async()=>{
    const contenido={...nuevoPresupuesto(),titulo:'Montaje de boda',cliente:'Cliente prueba'};
    vi.mocked(listarPresupuestos).mockResolvedValue([{id:'one',numero:1,linea_negocio:'montada_sound',revision:1,contenido}]);
    render(<PresupuestosPage linea="montada_sound"/>);
    await screen.findByText('Montaje de boda');
    fireEvent.click(screen.getByRole('button',{name:'Vista de tarjetas'}));
    expect(screen.getByRole('button',{name:'Vista de tarjetas'}).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByLabelText('Buscar presupuestos'),{target:{value:'inexistente'}});
    await waitFor(()=>expect(screen.queryByText('Montaje de boda')).toBeNull());
    fireEvent.change(screen.getByLabelText('Buscar presupuestos'),{target:{value:'Cliente prueba'}});
    fireEvent.click(screen.getByRole('button',{name:/Montaje de boda/}));
    expect(screen.getByDisplayValue('Cliente prueba')).toBeTruthy();
    expect(guardarPresupuesto).not.toHaveBeenCalled();
  });
  it('genera un borrador y lo guarda en la línea correcta sin cerrar el editor',async()=>{
    vi.mocked(guardarPresupuesto).mockImplementation(async(linea,contenido)=>({id:'new',numero:1,linea_negocio:linea,contenido,revision:1}));
    render(<PresupuestosPage linea="montada_sound"/>);
    fireEvent.click(screen.getByRole('button',{name:'Nuevo presupuesto'}));
    fireEvent.change(screen.getByLabelText('Servicios que quieres presupuestar'),{target:{value:'2 x Sesión a 150 €\nTransporte'}});
    fireEvent.click(screen.getByRole('button',{name:'Crear conceptos desde la descripción'}));
    expect(screen.getByDisplayValue('Sesión')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Guardar presupuesto'}));
    await screen.findByText('Presupuesto guardado.');
    expect(guardarPresupuesto).toHaveBeenCalledWith('montada_sound',expect.objectContaining({estado:'borrador'}),null);
    expect(screen.getByRole('complementary',{name:'Resumen del presupuesto'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Descargar PDF'}));
    expect(screen.getByRole('alert').textContent).toContain('cliente');
  });
  it('conserva lo escrito cuando falla el guardado',async()=>{
    vi.mocked(guardarPresupuesto).mockRejectedValue(new Error('Sin conexión'));
    render(<PresupuestosPage linea="montada_installations"/>);
    fireEvent.click(screen.getByRole('button',{name:'Nuevo presupuesto'}));
    fireEvent.change(screen.getByLabelText('Servicios que quieres presupuestar'),{target:{value:'Sesión a 250 €'}});
    fireEvent.click(screen.getByRole('button',{name:'Crear conceptos desde la descripción'}));
    fireEvent.click(screen.getByRole('button',{name:'Guardar presupuesto'}));
    await screen.findByText('Sin conexión');expect(screen.getByDisplayValue('Sesión')).toBeTruthy();
  });
  it('abre los presupuestos existentes en modo lectura cuando faltan permisos de escritura',async()=>{
    rights.create=false;rights.edit=false;
    const contenido:PresupuestoContenido={...nuevoPresupuesto(),titulo:'Consulta',conceptos:[{id:'a',descripcion:'Sonido',cantidad:1,precio:20}]};
    vi.mocked(listarPresupuestos).mockResolvedValue([{id:'one',numero:1,linea_negocio:'montada_sound',revision:1,contenido}]);
    render(<PresupuestosPage linea="montada_sound"/>);
    await screen.findByText('Consulta');fireEvent.click(screen.getByRole('button',{name:/Consulta/}));
    expect(screen.queryByRole('button',{name:'Guardar presupuesto'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Añadir concepto'})).toBeNull();
    await waitFor(()=>expect(listarPresupuestos).toHaveBeenCalledWith('montada_sound'));
  });
});
