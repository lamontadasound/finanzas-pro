import {afterEach,it,expect} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {DocumentArchive} from './DocumentArchive';
afterEach(cleanup);
it('conserva documentos sin fecha y limita los listados largos',()=>{
 const items=Array.from({length:14},(_,id)=>({id,date:''}));
 render(<DocumentArchive items={items} date={i=>i.date} total={()=>0} render={i=><div key={i.id}>Documento {i.id}</div>}/>);
 fireEvent.click(screen.getByRole('button',{name:'Sin fecha (14)'}));
 expect(screen.queryByText('Documento 13')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/Ver todos/}));
 expect(screen.getByText('Documento 13')).toBeTruthy();
});
