import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {renderHook,act,cleanup} from '@testing-library/react';
import {useLocalDraft} from './useLocalDraft';
beforeEach(()=>localStorage.clear());afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('Recuperación de borradores',()=>{
 it('conserva el formulario, foto y revisión del presupuesto al remontar',()=>{const first=renderHook(()=>useLocalDraft('user:sound',()=>({texto:'',revision:2,foto:''})));act(()=>first.result.current[1]({texto:'Presupuesto boda',revision:2,foto:'data:image/jpeg;base64,example'}));first.unmount();const next=renderHook(()=>useLocalDraft('user:sound',()=>({texto:'',revision:0,foto:''})));expect(next.result.current[0]).toEqual({texto:'Presupuesto boda',revision:2,foto:'data:image/jpeg;base64,example'});});
 it('no recupera el borrador de otra cuenta o línea',()=>{localStorage.setItem('user:sound',JSON.stringify({version:1,value:'privado'}));expect(renderHook(()=>useLocalDraft('other:sound',()=>'nuevo')).result.current[0]).toBe('nuevo');});
 it('avisa si el navegador no permite guardar',()=>{vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('Quota');});expect(renderHook(()=>useLocalDraft('user:sound',()=>'datos')).result.current[2]).toContain('No se pudo guardar');});
});
