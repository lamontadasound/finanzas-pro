import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {Button} from './Button';
afterEach(cleanup);
it('impide dobles envíos mientras una acción async está pendiente',async()=>{
 let resolve!:()=>void;
 const action=vi.fn(()=>new Promise<void>(r=>{resolve=r;}));
 render(<Button onClick={action}>Guardar</Button>);
 const button=screen.getByRole('button',{name:'Guardar'}) as HTMLButtonElement;
 fireEvent.click(button);fireEvent.click(button);
 expect(action).toHaveBeenCalledTimes(1);expect(button.disabled).toBe(true);
 resolve();await waitFor(()=>expect(button.disabled).toBe(false));
});
