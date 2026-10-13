import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {Modal} from './Modal';import {lockPageScroll} from '../../lib/scrollLock';
vi.mock('../../store/useStore',()=>({useStore:(select:(s:{_saveError:null})=>unknown)=>select({_saveError:null})}));
afterEach(()=>{cleanup();document.body.style.overflow='';});
it('monta el formulario fuera del contenedor de página transformado',()=>{const {container}=render(<div style={{transform:'translateY(0)'}}><Modal open title="Nuevo gasto" onClose={()=>{}}><input aria-label="Concepto"/></Modal></div>);const dialog=screen.getByRole('dialog');expect(container.contains(dialog)).toBe(false);expect(dialog.closest('.finance-modal')?.parentElement).toBe(document.body);expect(screen.getByLabelText('Concepto')).toBeTruthy();});
it('restaura el scroll al desmontar el formulario',()=>{document.body.style.overflow='auto';const {unmount}=render(<Modal open title="Gasto" onClose={()=>{}}>Contenido</Modal>);expect(document.body.style.overflow).toBe('hidden');unmount();expect(document.body.style.overflow).toBe('auto');});
it('no libera el scroll mientras otro menú o formulario permanece abierto',()=>{const a=lockPageScroll();const b=lockPageScroll();a();expect(document.body.style.overflow).toBe('hidden');a();expect(document.body.style.overflow).toBe('hidden');b();expect(document.body.style.overflow).toBe('');});
