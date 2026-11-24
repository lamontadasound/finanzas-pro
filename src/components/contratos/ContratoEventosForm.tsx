import { FormGroup, Field, Chips } from '../kit';
import { NumInput, TerminosFields } from './campos';
import { valorTermino, dias } from '../../lib/contratoTerminos';
import { INCLUYE_HORA, TERMINOS_EVENTOS, importesContrato, textoIncluyeHora, euros, type ContratoEventos } from '../../lib/contratoEventos';

type Props = { value: ContratoEventos; onChange: (v: ContratoEventos) => void; disabled?: boolean };

/** Ficha con los puntos clave del contrato de eventos y bodas. */
export function ContratoEventosForm({ value: c, onChange, disabled }: Props) {
  const set = <K extends keyof ContratoEventos>(k: K, val: ContratoEventos[K]) => onChange({ ...c, [k]: val });
  const txt = (k: keyof ContratoEventos, label: string, opts: { wide?: boolean; placeholder?: string; rows?: number; hint?: string } = {}) => (
    <Field label={label} wide={opts.wide} hint={opts.hint}>
      {opts.rows
        ? <textarea className="input-form" rows={opts.rows} placeholder={opts.placeholder} value={String(c[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} />
        : <input className="input-form" placeholder={opts.placeholder} value={String(c[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} />}
    </Field>
  );
  const imp = importesContrato(c);
  const boda = c.tipoEvento === 'boda';
  return (
    <fieldset disabled={disabled} className="space-y-1">
      <FormGroup title="Tipo">
        <div className="field field-wide">
          <Chips label="Tipo de contrato" value={c.tipoEvento} onChange={(t) => set('tipoEvento', t)}
            options={[{ value: 'boda', label: 'Boda' }, { value: 'evento', label: 'Evento' }]} />
        </div>
      </FormGroup>

      <FormGroup title="Cliente">
        {txt('cliente', boda ? 'Nombre completo de quien contrata' : 'Nombre / razón social', { wide: true })}
        {txt('nif', 'DNI / NIE / NIF')}
        {txt('domicilio', 'Domicilio')}
        {txt('representante', boda ? 'Representante (si lo hay)' : 'Representante y cargo', { placeholder: boda ? 'Vacío = en nombre propio' : 'Ej. Ana Pérez, directora de eventos' })}
        {txt('telefono', 'Teléfono')}
        {txt('email', 'Email', { wide: true })}
      </FormGroup>

      <FormGroup title="Evento">
        <Field label="Fecha del evento"><input type="date" className="input-form" value={c.fechaEvento} onChange={(e) => set('fechaEvento', e.target.value)} /></Field>
        <Field label="Último día (si dura varios)" hint="Déjalo vacío si es un solo día"><input type="date" className="input-form" min={c.fechaEvento || undefined} value={c.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} /></Field>
        {txt('tipoYAsistentes', 'Tipo de evento y nº de invitados', { wide: true, placeholder: boda ? 'Boda · 180 invitados' : 'Cena de empresa · 250 asistentes' })}
        {txt('recinto', 'Recinto, dirección y espacio de instalación', { wide: true, placeholder: 'Finca El Olivar, Ctra. M-501 km 10 · jardín y salón' })}
        {txt('responsableRecinto', 'Responsable del recinto (nombre, teléfono, correo)', { wide: true })}
      </FormGroup>

      <FormGroup title="Horarios">
        {txt('montaje', 'Acceso y montaje', { placeholder: '13/06 de 10:00 a 14:00' })}
        {txt('pruebas', 'Pruebas', { placeholder: '14:00 – 15:00' })}
        {txt('servicio', 'Inicio y fin del servicio', { placeholder: '18:00 – 02:00' })}
        {txt('desmontaje', 'Desmontaje y retirada', { placeholder: '02:00 – 04:00' })}
        {txt('duracion', 'Duración contratada', { placeholder: '3 horas' })}
        {txt('tecnicosDjs', 'Técnicos y DJs incluidos', { placeholder: '1 técnico + 1 DJ' })}
      </FormGroup>

      <FormGroup title="Servicios">
        {txt('presupuestoRef', 'Presupuesto adjunto (referencia, fecha y versión)', { wide: true, placeholder: 'PRE-00052 · 11/11/2026 · v1' })}
        {txt('servicios', 'Servicios y equipos contratados', { wide: true, rows: 4, placeholder: 'Sonorización ceremonia y cóctel, pack montaje completo, DJ…' })}
        {txt('personal', 'Personal incluido')}
      </FormGroup>

      <FormGroup title="Precio y pago">
        <Field label="Precio sin IVA (€)" hint={imp.total > 0 ? `IVA 21%: ${euros(imp.iva)} · Total con IVA: ${euros(imp.total)}` : 'El IVA (21%) se calcula solo'}>
          <NumInput value={c.precioBase || imp.base || undefined} onChange={(n) => { const b = n ?? 0; onChange({ ...c, precioBase: b, precioTotal: Math.round(b * 1.21 * 100) / 100 }); }} />
        </Field>
        <Field label="Primer pago a la firma, con IVA (€)" hint={<>
          {imp.es50 ? '50% del total' : `${Math.round(imp.reserva / (imp.total || 1) * 1000) / 10}% del total`} · Sin IVA: {euros(Math.round(imp.reserva / 1.21 * 100) / 100)}
          {!imp.es50 && <> · <button type="button" className="underline" onClick={() => set('primerPago', 0)}>volver al 50%</button></>}
        </>}>
          <NumInput value={c.primerPago || undefined} placeholder={imp.total > 0 ? String(imp.reserva) : undefined} onChange={(n) => set('primerPago', n ?? 0)} />
        </Field>
        <div className="field field-wide text-[13.5px] text-ink-2">
          <p>Total: <b className="num">{euros(imp.total)}</b> con IVA (<span className="num">{euros(imp.base)}</span> sin IVA) · Primer pago: <b className="num">{euros(imp.reserva)}</b> · Resto {dias(valorTermino(TERMINOS_EVENTOS, c.terminos, 'resto'))} antes: <b className="num">{euros(imp.resto)}</b></p>
        </div>
        <div className="field">
          <span className="field-label">¿Hay hora extra?</span>
          <Chips label="¿Hay hora extra?" value={c.hayHoraExtra === false ? 'no' : 'si'} onChange={(x) => onChange({ ...c, hayHoraExtra: x === 'si', horaExtra: x === 'si' && !(c.horaExtra > 0) ? 250 : c.horaExtra })}
            options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} />
        </div>
        {c.hayHoraExtra !== false && <>
          <Field label="Hora extra, con IVA (€)" hint={c.horaExtra > 0 ? `Sin IVA: ${euros(Math.round(c.horaExtra / 1.21 * 100) / 100)}` : 'Vacío o 0 = sin hora extra'}>
            <NumInput value={c.horaExtra || undefined} onChange={(n) => set('horaExtra', n ?? 0)} />
          </Field>
          <Field label="Hora extra pedida el mismo día, con IVA (€)" hint={Number(c.horaExtraMismoDia) > 0 && c.horaExtraMismoDia !== c.horaExtra ? `Sin IVA: ${euros(Math.round(Number(c.horaExtraMismoDia) / 1.21 * 100) / 100)}` : 'Vacío = el mismo precio que antes'}>
            <NumInput value={c.horaExtraMismoDia || undefined} onChange={(n) => set('horaExtraMismoDia', n ?? 0)} />
          </Field>
          <div className="field field-wide">
            <span className="field-label">Qué incluye la hora extra (toca para marcar o quitar)</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {INCLUYE_HORA.map((x) => {
                const marcado: string[] = c.horaExtraIncluye ?? [...INCLUYE_HORA];
                const on = marcado.includes(x);
                return <button key={x} type="button" aria-pressed={on} onClick={() => set('horaExtraIncluye', on ? marcado.filter((y) => y !== x) : INCLUYE_HORA.filter((y) => y === x || marcado.includes(y)))}
                  className={`rounded-full px-3 py-1.5 text-[13px] border ${on ? 'bg-ink text-white border-transparent' : 'bg-white border-black/15 text-ink-2'}`}>{on ? '✓ ' : ''}{x.charAt(0).toUpperCase() + x.slice(1)}</button>;
              })}
            </div>
            <span className="field-hint">En el contrato: {textoIncluyeHora(c) || 'marca al menos una cosa'}</span>
          </div>
          {txt('horaExtraOtros', 'También incluye (opcional)', { placeholder: 'luces de pista' })}
          {txt('horaExtraNoIncluye', 'Tampoco incluye (opcional)', { placeholder: 'máquina de humo' })}
        </>}
        <div className="field field-wide text-[13px] text-ink-3">
          <p>Cuenta para los pagos (fija): {c.cuentaTitular || 'La Montada Sound, S.L.'} · {c.cuentaEntidad || 'banco sin indicar'} · {c.iban || <b className="text-red-700">falta el IBAN en Ajustes → Datos fiscales</b>}</p>
        </div>
      </FormGroup>

      <FormGroup title="Personas de contacto">
        {txt('interlocutor', 'Persona de contacto del cliente el día del evento (opcional)', { wide: true, placeholder: 'Ej. la wedding planner · nombre y teléfono', hint: 'Si lo dejas vacío no sale en el contrato' })}
        {txt('autorizado', 'Quién puede aprobar cambios y extras', { wide: true, placeholder: 'Nombre, teléfono y correo · vacío = solo el cliente' })}
      </FormGroup>

      <details className="fgroup">
        <summary className="fgroup-title cursor-pointer">Condiciones técnicas (opcional)</summary>
        <div className="fgroup-body">
          {txt('electrico', 'Potencia, tomas y responsable del suministro', { wide: true })}
          {txt('accesos', 'Accesos, descarga, escaleras y espacio', { wide: true })}
          {txt('zonaTecnica', 'Zona técnica y protección del cableado', { wide: true })}
          {txt('liquidos', 'Protección frente a líquidos / bebidas', { wide: true })}
          <div className="field field-wide"><span className="field-label">Instalación exterior</span>
            <Chips label="Instalación exterior" value={c.exterior} onChange={(x) => set('exterior', x)} options={[{ value: 'no', label: 'No' }, { value: 'si', label: 'Sí' }]} />
          </div>
          {c.exterior === 'si' && <>
            {txt('exteriorPlan', 'Cubierta y ubicación alternativa', { wide: true })}
            {txt('planMeteo', 'Plan por lluvia: responsable y plazo', { wide: true })}
          </>}
          {txt('acustica', 'Límites de sonido, limitador y hora máxima', { wide: true })}
          {txt('proveedores', 'Otros proveedores y efectos especiales', { wide: true })}
          {txt('comida', 'Comida del equipo (personas y hora)', { wide: true })}
          {txt('licencias', 'Licencias y quién las gestiona', { wide: true })}
        </div>
      </details>

      <TerminosFields defs={TERMINOS_EVENTOS} value={c.terminos} onChange={(t) => set('terminos', t)} />

      <FormGroup title="Otras condiciones y firma">
        {txt('particulares', 'Condiciones particulares (opcional)', { wide: true, rows: 3, hint: 'Se añaden al Anexo I y prevalecen sobre las generales' })}
        {txt('firmante', 'Firma por La Montada')}
        {txt('lugarFirma', 'Lugar de firma')}
        <Field label="Fecha de firma"><input type="date" className="input-form" value={c.fechaFirma} onChange={(e) => set('fechaFirma', e.target.value)} /></Field>
      </FormGroup>
    </fieldset>
  );
}
