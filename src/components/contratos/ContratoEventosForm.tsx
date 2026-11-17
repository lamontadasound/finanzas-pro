import { FormGroup, Field, Chips } from '../kit';
import { importesContrato, euros, type ContratoEventos } from '../../lib/contratoEventos';

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
        {boda
          ? txt('contrayentes', 'Novios', { wide: true, placeholder: 'Nombre y nombre' })
          : txt('contrayentes', 'Personas homenajeadas (si las hay)', { wide: true })}
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
        {txt('presupuestoRef', 'Presupuesto adjunto', { wide: true, placeholder: 'PRE-00052 del 11/11/2026' })}
        {txt('servicios', 'Servicios y equipos contratados', { wide: true, rows: 4, placeholder: 'Sonorización ceremonia y cóctel, pack montaje completo, DJ…' })}
        {txt('personal', 'Personal incluido')}
        {txt('extras', 'Extras aceptados (con importe)')}
      </FormGroup>

      <FormGroup title="Precio y pago">
        <Field label="Precio total con IVA (€)">
          <input type="number" inputMode="decimal" min="0" step="0.01" className="input-form num" value={c.precioTotal || ''} onChange={(e) => set('precioTotal', Number(e.target.value))} />
        </Field>
        <Field label="Hora extra con IVA (€)" hint="Si se pide el mismo día: +100 €">
          <input type="number" min="0" step="1" className="input-form num" value={c.horaExtra || ''} onChange={(e) => set('horaExtra', Number(e.target.value))} />
        </Field>
        <div className="field field-wide text-[13.5px] text-ink-2">
          Reserva a la firma (50%): <b className="num">{euros(imp.reserva)}</b> · Resto 10 días antes: <b className="num">{euros(imp.resto)}</b>
        </div>
        {txt('cuentaTitular', 'Titular de la cuenta')}
        {txt('cuentaEntidad', 'Banco')}
        {txt('iban', 'IBAN', { wide: true })}
      </FormGroup>

      <FormGroup title="Personas de contacto">
        {txt('interlocutor', 'Interlocutor del cliente el día del evento', { wide: true, placeholder: 'Nombre y teléfono' })}
        {txt('autorizado', 'Quién puede aprobar extras', { placeholder: 'Vacío = solo el cliente' })}
        {txt('limiteAutorizado', 'Hasta cuánto (€ con IVA)')}
        {txt('contactoMontada', 'Contacto de La Montada', { wide: true, placeholder: 'Nombre, teléfono y correo' })}
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

      <FormGroup title="Otras condiciones y firma">
        {txt('particulares', 'Condiciones particulares (opcional)', { wide: true, rows: 3, hint: 'Se añaden al Anexo I y prevalecen sobre las generales' })}
        {txt('firmante', 'Firma por La Montada')}
        {txt('cargoFirmante', 'En calidad de', { placeholder: 'Ej. administradora' })}
        {txt('lugarFirma', 'Lugar de firma')}
        <Field label="Fecha de firma"><input type="date" className="input-form" value={c.fechaFirma} onChange={(e) => set('fechaFirma', e.target.value)} /></Field>
      </FormGroup>
    </fieldset>
  );
}
