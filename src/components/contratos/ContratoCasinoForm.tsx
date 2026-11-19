import { FormGroup, Field, Chips } from '../kit';
import { euros } from '../../lib/contratoPdfKit';
import { importesCasino, mesaVacia, type ContratoCasino, type MesaCasino } from '../../lib/contratoCasino';

type Props = { value: ContratoCasino; onChange: (v: ContratoCasino) => void; disabled?: boolean };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Ficha con los datos del Anexo I del contrato de casino. */
export function ContratoCasinoForm({ value: c, onChange, disabled }: Props) {
  const set = <K extends keyof ContratoCasino>(k: K, val: ContratoCasino[K]) => onChange({ ...c, [k]: val });
  const txt = (k: keyof ContratoCasino, label: string, opts: { wide?: boolean; placeholder?: string; rows?: number; hint?: string } = {}) => (
    <Field label={label} wide={opts.wide} hint={opts.hint}>
      {opts.rows
        ? <textarea className="input-form" rows={opts.rows} placeholder={opts.placeholder} value={String(c[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} />
        : <input className="input-form" placeholder={opts.placeholder} value={String(c[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} />}
    </Field>
  );
  const siNo = (k: 'cubierto' | 'menores', label: string) => (
    <div className="field"><span className="field-label">{label}</span>
      <Chips label={label} value={c[k]} onChange={(x) => set(k, x)} options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} />
    </div>
  );
  const imp = importesCasino(c);
  const mesas = c.mesas?.length ? c.mesas : [mesaVacia()];
  const setMesa = (i: number, patch: Partial<MesaCasino>) => set('mesas', mesas.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <fieldset disabled={disabled} className="space-y-1">
      <FormGroup title="Cliente">
        {txt('cliente', 'Nombre / razón social', { wide: true })}
        {txt('nif', 'DNI / NIE / NIF')}
        {txt('domicilio', 'Domicilio')}
        {txt('representante', 'Representante (si lo hay)', { placeholder: 'Vacío = en nombre propio' })}
        {txt('telefono', 'Teléfono')}
        {txt('email', 'Email', { wide: true })}
      </FormGroup>

      <FormGroup title="Evento">
        <Field label="Fecha del evento"><input type="date" className="input-form" value={c.fechaEvento} onChange={(e) => set('fechaEvento', e.target.value)} /></Field>
        {txt('tipoYAsistentes', 'Tipo de evento y nº de asistentes', { placeholder: 'Cena de empresa · 150 asistentes' })}
        {txt('recinto', 'Recinto, dirección y espacio del casino', { wide: true })}
        {siNo('cubierto', 'Interior o cubierto')}
        {txt('responsableRecinto', 'Responsable del recinto (nombre, teléfono, correo)', { wide: true })}
      </FormGroup>

      <FormGroup title="Horarios">
        {txt('accesoMontaje', 'Acceso para montaje', { placeholder: '18:00 (mín. 2 h antes)' })}
        {txt('listoA', 'Casino listo para jugar a las', { placeholder: '20:00' })}
        {txt('servicio', 'Inicio y fin del casino', { placeholder: '20:00 – 23:00' })}
        {txt('desmontaje', 'Desmontaje', { placeholder: '23:00 – 00:00' })}
        {txt('duracionHoras', 'Duración (horas)')}
        {txt('comida', 'Comida del personal si pasa de 5 h (personas y hora)')}
      </FormGroup>

      <FormGroup title="Mesas">
        {txt('presupuestoRef', 'Presupuesto adjunto (referencia, fecha y versión)', { wide: true, placeholder: 'PRE-00052 · 11/11/2026 · v1' })}
        <div className="field field-wide space-y-2">
          {mesas.map((m, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1.2fr_60px_70px_2.4fr_1fr_auto] gap-2 items-end rounded-lg border border-black/10 p-2 sm:border-0 sm:p-0">
              <label className="text-[12.5px] col-span-2 sm:col-span-1">Mesa / concepto<input className="input-form" value={m.mesa} placeholder="Póker" onChange={(e) => setMesa(i, { mesa: e.target.value })} /></label>
              <label className="text-[12.5px]">Cant.<input type="number" min="1" step="1" className="input-form num" value={m.cantidad || ''} onChange={(e) => setMesa(i, { cantidad: Number(e.target.value) })} /></label>
              <label className="text-[12.5px]">Croupiers<input type="number" min="0" step="1" className="input-form num" value={m.croupiers || ''} onChange={(e) => setMesa(i, { croupiers: Number(e.target.value) })} /></label>
              <label className="text-[12.5px] col-span-2 sm:col-span-1">Qué incluye<input className="input-form" value={m.material} onChange={(e) => setMesa(i, { material: e.target.value })} /></label>
              <label className="text-[12.5px]">Espacio (m)<input className="input-form" value={m.espacio} placeholder="3 x 2" onChange={(e) => setMesa(i, { espacio: e.target.value })} /></label>
              <button type="button" className="btn btn-ghost text-[13px]" aria-label={`Quitar mesa ${i + 1}`} disabled={mesas.length === 1}
                onClick={() => set('mesas', mesas.filter((_, j) => j !== i))}>Quitar</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost text-[13.5px]" onClick={() => set('mesas', [...mesas, mesaVacia()])}>+ Añadir mesa</button>
        </div>
        {txt('fichasPorAsistente', 'Fichas o vales por asistente')}
        {txt('personalizacion', 'Personalización (logo, nombres, fecha)')}
        {txt('vestuario', 'Vestuario de los croupiers')}
        {txt('premios', 'Premios que da el cliente')}
        {siNo('menores', '¿Pueden jugar menores?')}
      </FormGroup>

      <FormGroup title="Precio y pago">
        <Field label="Precio total sin IVA (€)" hint={imp.total > 0 ? `IVA 21%: ${euros(imp.iva)} · Total con IVA: ${euros(imp.total)}` : 'El IVA (21%) se calcula solo'}>
          <input type="number" inputMode="decimal" min="0" step="0.01" className="input-form num" value={c.precioBase || (imp.base || '')}
            onChange={(e) => set('precioBase', Number(e.target.value) || 0)} />
        </Field>
        <Field label="Primer pago a la firma, con IVA (€)" hint={<>
          {imp.es50 ? '50% del total' : `${Math.round(imp.reserva / (imp.total || 1) * 1000) / 10}% del total`} · Resto 10 días antes: {euros(imp.resto)}
          {!imp.es50 && <> · <button type="button" className="underline" onClick={() => set('primerPago', 0)}>volver al 50%</button></>}
        </>}>
          <input type="number" inputMode="decimal" min="0" step="0.01" className="input-form num" value={imp.total > 0 ? (c.primerPago || imp.reserva) : ''}
            onChange={(e) => set('primerPago', Number(e.target.value) || 0)} />
        </Field>
        <div className="field field-wide text-[13.5px] text-ink-2">
          Total: <b className="num">{euros(imp.total)}</b> con IVA (<span className="num">{euros(imp.base)}</span> sin IVA) · Primer pago: <b className="num">{euros(imp.reserva)}</b> · Resto 10 días antes: <b className="num">{euros(imp.resto)}</b>
        </div>
        <div className="field">
          <span className="field-label">¿Hay hora extra?</span>
          <Chips label="¿Hay hora extra?" value={c.hayHoraExtra === false ? 'no' : 'si'} onChange={(x) => set('hayHoraExtra', x === 'si')}
            options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} />
        </div>
        {c.hayHoraExtra !== false && <Field label="Hora extra por mesa, sin IVA (€)" hint={c.horaExtraMesaBase > 0 ? `Con IVA: ${euros(r2(c.horaExtraMesaBase * 1.21))} · el mismo día +40%` : 'El mismo día: +40%'}>
          <input type="number" min="0" step="0.01" className="input-form num" value={c.horaExtraMesaBase || ''} onChange={(e) => set('horaExtraMesaBase', Number(e.target.value) || 0)} />
        </Field>}
        <Field label="Reposición ficha, con IVA (€)"><input type="number" min="0" step="0.01" className="input-form num" value={c.reposicionFicha || ''} onChange={(e) => set('reposicionFicha', Number(e.target.value) || 0)} /></Field>
        <Field label="Reposición baraja, con IVA (€)"><input type="number" min="0" step="0.01" className="input-form num" value={c.reposicionBaraja || ''} onChange={(e) => set('reposicionBaraja', Number(e.target.value) || 0)} /></Field>
        {txt('reposicionOtros', 'Reposición de otro material', { wide: true, placeholder: 'Ej. bola de ruleta 25 €' })}
        <div className="field field-wide text-[13px] text-ink-3">
          Cuenta para los pagos (fija): La Montada Sound · {c.cuentaEntidad || 'banco sin indicar'} · {c.iban || <b className="text-red-700">falta el IBAN en Ajustes → Datos fiscales</b>}
        </div>
      </FormGroup>

      <FormGroup title="Personas de contacto">
        {txt('interlocutor', 'Persona de contacto del cliente el día del evento (opcional)', { wide: true, hint: 'Si lo dejas vacío no sale en el contrato' })}
        {txt('autorizado', 'Quién puede contratar horas extra', { wide: true, placeholder: 'Vacío = solo el cliente' })}
      </FormGroup>

      <FormGroup title="Otras condiciones y firma">
        {txt('particulares', 'Condiciones particulares (opcional)', { wide: true, rows: 3, hint: 'Prevalecen sobre las generales' })}
        {txt('firmante', 'Firma por La Montada')}
        {txt('lugarFirma', 'Lugar de firma')}
        <Field label="Fecha de firma"><input type="date" className="input-form" value={c.fechaFirma} onChange={(e) => set('fechaFirma', e.target.value)} /></Field>
      </FormGroup>
    </fieldset>
  );
}
