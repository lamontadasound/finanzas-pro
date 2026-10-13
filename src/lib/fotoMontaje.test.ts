import {afterEach,describe,expect,it,vi} from 'vitest';
import {prepararFotoMontaje} from './fotoMontaje';
import {nuevoPresupuesto,validarPresupuesto} from './presupuestos';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('Foto del montaje',()=>{
 it('rechaza formatos no admitidos y fotos demasiado grandes',async()=>{
  await expect(prepararFotoMontaje(new File(['pdf'],'x.pdf',{type:'application/pdf'}))).rejects.toThrow('JPG');
  const big=new File([new Uint8Array(10*1024*1024+1)],'x.jpg',{type:'image/jpeg'});
  await expect(prepararFotoMontaje(big)).rejects.toThrow('10 MB');
 });
 it('prepara una imagen proporcional y libera la URL temporal',async()=>{
  vi.stubGlobal('Image',class {src='';naturalWidth=3200;naturalHeight=1800;decode=async()=>{};});
  const revoke=vi.fn();vi.stubGlobal('URL',{createObjectURL:()=> 'blob:test',revokeObjectURL:revoke});
  const drawImage=vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillStyle:'',fillRect:vi.fn(),drawImage} as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue('data:image/jpeg;base64,AA==');
  const foto=await prepararFotoMontaje(new File(['test'],'montaje.jpg',{type:'image/jpeg'}));
  expect(foto).toMatchObject({ancho:1600,alto:900,nombre:'montaje.jpg'});expect(drawImage).toHaveBeenCalled();expect(revoke).toHaveBeenCalledWith('blob:test');
 });
 it('no permite guardar imágenes externas ni presupuestos que superen el límite',()=>{
  const p={...nuevoPresupuesto(),titulo:'Prueba',conceptos:[{id:'1',descripcion:'Sonido',cantidad:1,precio:100}]};
  expect(validarPresupuesto({...p,fotoMontaje:{dataUrl:'https://example.com/foto.jpg',nombre:'x',ancho:100,alto:100}})).toContain('foto');
  expect(validarPresupuesto({...p,notas:'x'.repeat(500000)})).toContain('demasiado texto');
 });
});
