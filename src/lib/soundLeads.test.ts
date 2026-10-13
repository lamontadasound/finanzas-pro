import {describe,it,expect} from 'vitest';
import {conversionPorCanal,type Lead} from './soundLeads';
describe('Conversión por canal',()=>{
 it('incluye pendientes en el denominador y agrupa canales sin distinguir mayúsculas',()=>{const rows=[{canal:' Web ',estado:'convertido'},{canal:'web',estado:'no_convertido'},{canal:'WEB',estado:'pendiente'},{canal:'Instagram',estado:'convertido'},{canal:'',estado:'pendiente'}] as Lead[];const result=conversionPorCanal(rows);expect(result[0]).toMatchObject({total:3,convertidos:1,perdidos:1,pendientes:1});expect(result[0].tasa).toBeCloseTo(100/3);expect(result.find(r=>r.canal==='Instagram')?.tasa).toBe(100);expect(result.find(r=>r.canal==='Sin indicar')?.tasa).toBe(0);});
 it('no inventa resultados sin contactos',()=>expect(conversionPorCanal([])).toEqual([]));
});
