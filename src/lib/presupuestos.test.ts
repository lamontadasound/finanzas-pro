import { describe, expect, it } from 'vitest';
import { conceptosDesdeTexto, nuevoPresupuesto, totalesPresupuesto, validarPresupuesto } from './presupuestos';
import { generarPresupuestoPdf } from './presupuestoPdf';
const draft = () => ({ ...nuevoPresupuesto(), titulo: 'Evento de prueba', cliente: 'Cliente de prueba', conceptos: conceptosDesdeTexto('2 x Técnico de sonido a 180 €\nTransporte a 90 €') });
describe('Presupuestos', () => {
  it('extrae solo cantidades y precios explícitos sin recortar nombres', () => {
    const items = conceptosDesdeTexto('2 x Técnico de sonido a 180 €; Boda 1.250,50 €\nSonido para 150 personas el 20/09 de 18 a 22 h');
    expect(items.map(c => [c.descripcion, c.cantidad, c.precio])).toEqual([['Técnico de sonido',2,180],['Boda',1,1250.5],['Sonido para 150 personas el 20/09 de 18 a 22 h',1,null]]);
  });
  it('admite euros con punto decimal y cantidades fraccionadas', () => {
    expect(conceptosDesdeTexto('1,5 x Montaje a 50.25 EUR')[0]).toMatchObject({cantidad:1.5,precio:50.25,descripcion:'Montaje'});
  });
  it('redondea por concepto y calcula el IVA sobre el total sin IVA', () => {
    expect(totalesPresupuesto(draft())).toEqual({base:450,iva:94.5,total:544.5,pendientes:0});
    const p=draft(); p.conceptos=conceptosDesdeTexto('3 x Pieza a 0,10 €');
    expect(totalesPresupuesto(p)).toEqual({base:0.3,iva:0.06,total:0.36,pendientes:0});
  });
  it('permite guardar borradores pendientes pero impide finalizarlos y exportarlos', () => {
    const p = {...draft(), conceptos:conceptosDesdeTexto('Sonido')};
    expect(validarPresupuesto(p)).toBeNull();
    expect(validarPresupuesto(p,true)).toContain('precios pendientes');
    expect(validarPresupuesto({...p,estado:'aceptado'})).toContain('precios pendientes');
  });
  it('rechaza cantidades negativas, infinitos y fechas invertidas, admite precio cero', () => {
    const p=draft();p.conceptos[0].cantidad=-1;expect(validarPresupuesto(p)).toContain('cantidades');
    p.conceptos[0].cantidad=1;p.conceptos[0].precio=Infinity;expect(validarPresupuesto(p)).toContain('precios');
    p.conceptos[0].precio=0;expect(validarPresupuesto(p,true)).toBeNull();
    expect(validarPresupuesto({...p,validez:'2000-01-01'})).toContain('validez');
  });
  it('genera un PDF paginado con la línea de negocio y los importes correctos', () => {
    const contenido=draft();contenido.conceptos=Array.from({length:65},(_,i)=>({...contenido.conceptos[0],id:String(i),descripcion:`Servicio ${i+1} con montaje y desmontaje en recinto para el evento`}));
    const pdf=generarPresupuestoPdf({id:'test',numero:12,linea_negocio:'montada_sound',revision:1,contenido});
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    const output=pdf.output();expect(output).toContain('PRE-00012');expect(output).toContain('LA MONTADA SOUND');expect(output).toContain('23.400,00');
  });
});

describe('Modelo de presupuesto con descuentos',()=>{
  it('aplica el descuento por unidad igual que en la referencia y no cobra lo incluido',()=>{
    const p=draft();p.conceptos=[
      {id:'1',descripcion:'DJ La Montada',cantidad:1,precio:800,descuento:250},
      {id:'2',descripcion:'DJ Julia',cantidad:1,precio:1000,descuento:250},
      {id:'3',descripcion:'Mesa mezclas',cantidad:2,precio:200,descuento:100},
      {id:'4',descripcion:'Focos',cantidad:2,precio:850,descuento:250},
      {id:'5',descripcion:'Mostrador',cantidad:2,precio:80,descuento:30},
      {id:'6',descripcion:'Altavoces',cantidad:2,precio:200,descuento:100},
      {id:'7',descripcion:'Técnico incluido',cantidad:1,precio:null,incluido:true},
    ];
    expect(totalesPresupuesto(p)).toEqual({base:3000,iva:630,total:3630,pendientes:0});
    expect(validarPresupuesto(p,true)).toBeNull();
    p.conceptos[0].descuento=801;expect(validarPresupuesto(p)).toContain('descuento');
  });
});

describe('Plantilla corporativa marrón',()=>{
  it('presenta concepto y detalle por separado y mantiene una propuesta de cinco conceptos en una página',()=>{
    const contenido=draft();contenido.fechaEvento='25 de septiembre de 2026';
    contenido.conceptos=Array.from({length:5},(_,i)=>({id:String(i),descripcion:'Personal técnico',detalle:'Montaje por la mañana y desmontaje nocturno con técnicos especializados.',cantidad:1,precio:100}));
    const doc=generarPresupuestoPdf({id:'q',numero:123,linea_negocio:'montada_sound',revision:1,contenido});
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output()).toContain('Montaje por la');
    expect(doc.output()).toContain('PRE-00123');
  });
});
