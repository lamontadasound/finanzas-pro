import {describe,it,expect} from 'vitest';
import {matchInvoiceDescription,REAL_MADRID_REFERENCE} from './realMadridInvoice';
describe('Plantilla Real Madrid',()=>{
 it('incluye fecha y partido con el formato solicitado',()=>{expect(matchInvoiceDescription('2026-08-30','Real Madrid vs Málaga')).toBe('FECHA EVENTO: 30 Agosto 2026 Real Madrid vs Málaga');expect(REAL_MADRID_REFERENCE).toBe('2627SER4531032474');});
 it('rechaza fecha o partido incompletos',()=>{expect(()=>matchInvoiceDescription('2026-02-30','Real Madrid vs Málaga')).toThrow();expect(()=>matchInvoiceDescription('2026-08-30',' ')).toThrow();});
});
