import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {EventExpenseVatFields} from './EventExpenseVatFields';
import {eventExpenseVat} from '../../lib/eventExpensePayment';
it('separa base IVA y total sin cambiar el total de costes antiguos al abrir',()=>{expect(eventExpenseVat(100,21)).toEqual({baseImponible:100,porcentajeIVA:21,importeIVA:21,totalConIva:121,importe:121});expect(eventExpenseVat(100,0).importe).toBe(100);const change=vi.fn();render(<EventExpenseVatFields value={{importe:121}} onChange={change}/>);expect(screen.getByText(/Importe antiguo sin desglose/)).toBeTruthy();expect(change).not.toHaveBeenCalled();fireEvent.change(screen.getByLabelText('Total sin IVA del gasto'),{target:{value:'100'}});expect(change).toHaveBeenCalledWith(expect.objectContaining({baseImponible:100}));});
