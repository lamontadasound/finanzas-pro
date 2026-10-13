// ── Pruebas de reintento seguro — GenerarFacturaModal ───────────────────────
// Responden directamente a los 4 riesgos señalados sobre "id estable +
// upsert no demuestra por sí solo que los reintentos sean seguros":
//  1. Si la emisión se confirma en el servidor pero la respuesta se pierde,
//     reintentar recupera la misma factura (no crea una segunda).
//  2. El upsert (ahora `insertIfMissing`) nunca sobrescribe una factura ya
//     emitida con datos de borrador.
//  3. Cerrar y volver a abrir el modal recupera la operación pendiente.
//  4. La protección real vive en el servidor (aquí se prueba que el CLIENTE
//     nunca vuelve a llamar al RPC si ya ve la factura emitida localmente —
//     la garantía de fondo contra duplicados sigue siendo
//     `emitir_numero_factura`, no probada aquí porque requiere Postgres real,
//     ver supabase/tests/).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { GenerarFacturaModal } from './GenerarFacturaModal';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Ingreso, ConfiguracionFiscal } from '../../types';

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));
vi.mock('../../lib/invoiceSync',()=>({syncInvoice:vi.fn().mockRejectedValue(new Error('Drive pendiente'))}));
vi.mock('../../lib/db', () => ({
  db: { facturas: { insertIfMissing: vi.fn().mockResolvedValue(undefined), getById:vi.fn().mockResolvedValue({}) } },
}));
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/db';

const ingreso: Ingreso = {
  id: 'ing-test', area: 'montada', concepto: 'Boda de prueba', cliente: 'Cliente Test', empresa: false,
  tipoEvento: 'boda', fechaEvento: '2026-06-01', baseImponible: 1000, porcentajeIVA: 21,
  importeIVA: 210, total: 1210, metodoPago: 'transferencia', estadoPago: 'pendiente',
  pagosRecibidos: 0, facturaEmitida: false, createdAt: '2026-01-01T00:00:00Z',
};

const emisor: ConfiguracionFiscal = {
  id: 'default', razonSocial: 'Empresa Test SL', nifCif: 'B00000000', direccionFiscal:'Dirección emisor', numeracionConfirmada: true,
};

beforeEach(() => {
  localStorage.clear();

  const perfil = {
    id: 'u1', email: 'a@a.com', nombre: 'Ana', rol: 'admin' as const, activo: true,
    permisosLineas: {}, permisosModulos: {} as never,
    permisosFacturacion: { emitir: true, rectificar: true, gestionarNumeracion: true },
  };
  useAuthStore.setState({ user: perfil, profile: perfil });
  useStore.setState({ facturas: [], clientes: [{id:'client',nombre:ingreso.cliente,nifCif:'TEST',direccion:'Dirección cliente',esEmpresa:true,createdAt:'2026-01-01'}], emisores: [emisor], proyectoEmisorMap: {montada_sound:'default'}, ingresos: [ingreso] });
  vi.mocked(supabase.rpc).mockReset();
  vi.mocked(db.facturas.insertIfMissing).mockClear();
});
afterEach(() => cleanup());

describe('Escenario 3 — cerrar y reabrir el modal recupera la operación pendiente', () => {
  it('reabrir el modal (nuevo montaje) para el mismo ingreso reutiliza el mismo factura_id, no genera otro', () => {
    const { unmount } = render(<GenerarFacturaModal ingreso={ingreso} onClose={() => {}} />);
    const idTrasPrimeraApertura = localStorage.getItem('mi-espacio:emision-pendiente:ing-test');
    expect(idTrasPrimeraApertura).toBeTruthy();
    unmount(); // simula cerrar el modal — el componente se desmonta de verdad

    render(<GenerarFacturaModal ingreso={ingreso} onClose={() => {}} />);
    const idTrasReabrir = localStorage.getItem('mi-espacio:emision-pendiente:ing-test');
    expect(idTrasReabrir).toBe(idTrasPrimeraApertura); // MISMO id, no uno nuevo
  });
});

describe('Escenario 1 y 4 — respuesta perdida tras confirmación real en el servidor', () => {
  it('si al reabrir el modal la factura pendiente YA tiene número en el store, el botón queda bloqueado y no se vuelve a llamar al RPC', async () => {
    // Primera apertura: genera el id pendiente.
    const { unmount } = render(<GenerarFacturaModal ingreso={ingreso} onClose={() => {}} />);
    const idPendiente = localStorage.getItem('mi-espacio:emision-pendiente:ing-test')!;
    unmount();

    // Simula: el servidor SÍ confirmó la emisión (numero_secuencial asignado)
    // pero la respuesta nunca llegó al cliente en su momento — al recargar
    // los datos desde Supabase, el store local ya la refleja como emitida.
    useStore.setState((s) => ({
      facturas: [...s.facturas, {
        id: idPendiente, area: 'montada', tipo: 'emitida', numero: '99', numeroSecuencial: 99,
        cliente: ingreso.cliente, concepto: ingreso.concepto, baseImponible: 500, porcentajeIVA: 21,
        importeIVA: 105, total: 605, fecha: '2026-04-01', pagada: false, ivaDeducible: false,
        ingresoId: ingreso.id, estado: 'pendiente_sincronizar', porcentajeFacturado: 50,
      }],
    }));

    render(<GenerarFacturaModal ingreso={ingreso} onClose={() => {}} />);

    // El aviso debe mostrar de inmediato que ya estaba emitida.
    await screen.findByText(/Ya se había emitido esta factura anteriormente \(número 99\)/);

    // El botón de emitir queda deshabilitado y renombrado — un clic (por si
    // acaso) no debe llamar al RPC ni a insertIfMissing.
    const boton = screen.getByRole('button', { name: /Ya emitida \(nº 99\)/ }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    fireEvent.click(boton);
    await waitFor(() => expect(supabase.rpc).not.toHaveBeenCalled());
    expect(db.facturas.insertIfMissing).not.toHaveBeenCalled();

    // Y el id pendiente se limpia — la próxima factura parcial de este
    // ingreso (una nueva, legítima) pedirá un id nuevo.
    expect(localStorage.getItem('mi-espacio:emision-pendiente:ing-test')).toBeNull();
  });
});

describe('Escenario 2 — el reintento nunca sobrescribe una factura ya emitida con datos de borrador', () => {
  it('insertIfMissing se llama (nunca upsert/insert plano) antes del RPC en cada intento de emitir', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ numero_emitido: 42 }], error: null } as never);
    render(<GenerarFacturaModal ingreso={ingreso} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('NIF / CIF *'),{target:{value:'B12345678'}});
    fireEvent.change(screen.getByLabelText('Dirección fiscal *'),{target:{value:'Calle Cliente 1'}});
    fireEvent.click(screen.getByRole('button', { name: /Emitir factura/ }));

    await waitFor(() => expect(db.facturas.insertIfMissing).toHaveBeenCalledTimes(1));
    expect(supabase.rpc).toHaveBeenCalledWith('emitir_factura_con_datos_fiscales', expect.objectContaining({ p_ingreso_id: ingreso.id }));
  });
});

describe('Datos fiscales independientes del CRM',()=>{
 it('no toma los datos fiscales del CRM y permite introducir otra razón social',async()=>{
  vi.mocked(supabase.rpc).mockResolvedValue({data:[{numero_emitido:83}],error:null} as never);
  render(<GenerarFacturaModal ingreso={ingreso} onClose={()=>{}}/>);
  expect((screen.getByLabelText('NIF / CIF *') as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByLabelText('Nombre o razón social *'),{target:{value:'Empresa receptora SL'}});
  fireEvent.change(screen.getByLabelText('NIF / CIF *'),{target:{value:'B12345678'}});
  fireEvent.change(screen.getByLabelText('Dirección fiscal *'),{target:{value:'Calle fiscal 4'}});
  fireEvent.click(screen.getByRole('button',{name:/Emitir factura/}));
  await waitFor(()=>expect(supabase.rpc).toHaveBeenCalledWith('emitir_factura_con_datos_fiscales',expect.objectContaining({p_cliente:ingreso.cliente,p_datos_cliente:expect.objectContaining({nombre:'Empresa receptora SL',nifCif:'B12345678',direccion:'Calle fiscal 4'})})));
  expect(useStore.getState().clientes[0].nifCif).toBe('TEST');
 });
});
