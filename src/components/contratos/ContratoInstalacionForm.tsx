import { FormGroup, Field, Chips } from '../kit';
import { euros } from '../../lib/contratoPdfKit';
import { TRABAJOS, importesInstalacion, materialVacio, type ContratoInstalacion, type MaterialInstalacion } from '../../lib/contratoInstalacion';

type Props = { value: ContratoInstalacion; onChange: (v: ContratoInstalacion) => void; disabled?: boolean };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Ficha con los datos del Anexo I del contrato de instalación. */
export function ContratoInstalacionForm({ value: c, onChange, disabled }: Props) {
  const set = <K extends keyof ContratoInstalacion>(k: K, val: ContratoInstalacion[K]) => onChange({ ...c, [k]: val });
  const txt = (k: keyof ContratoInstalacion, label: string, opts: { wide?: boolean; placeholder?: string; rows?: number; hint?: string } = {}) => (
    <Field label={label} wide={opts.wide} hint={opts.hint}>
      {opts.rows
        ? <textarea className="input-form" rows={opts.rows} placeholder={opts.placeholder} value={String(c[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} />
        : <input className="input-form" placeholder={opts.placeholder} value={String(c[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} />}
    </Field>
  );
  const sinIva = (k: 'tarifaDesplazamientoBase' | 'horaTecnicoBase', label: string) => (
    <Field label={label} hint={c[k] > 0 ? `Con IVA: ${euros(r2(c[k] * 1.21))}` : 'El IVA (21%) se calcula solo'}>
      <input type="number" inputMode="decimal" min="0" step="0.01" className="input-form num" value={c[k] || ''} onChange={(e) => set(k, Number(e.target.value) || 0)} />
    </Field>
  );
  const imp = importesInstalacion(c);
  const material = c.material?.length ? c.material : [materialVacio()];
  const setMat = (i: number, patch: Partial<MaterialInstalacion>) => set('material', material.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const trabajos = c.trabajos ?? [];
  const toggleTrabajo = (t: string) => set('trabajos', trabajos.includes(t) ? trabajos.filter((x) => x !== t) : TRABAJOS.filter((x) => x === t || trabajos.includes(x)));

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

      <FormGroup title="Instalación">
        {txt('presupuestoRef', 'Presupuesto adjunto (referencia, fecha y versión)', { wide: true, placeholder: 'PRE-00052 · 11/11/2026 · v1' })}
        {txt('lugar', 'Lugar de instalación (dirección y espacio)', { wide: true })}
        {txt('tipoEstablecimiento', 'Tipo de establecimiento', { placeholder: 'Hotel, restaurante, concesionario…' })}
        <Field label="Fecha de la visita técnica"><input type="date" className="input-form" value={c.fechaVisita} onChange={(e) => set('fechaVisita', e.target.value)} /></Field>
        {txt('descripcion', 'Descripción general', { wide: true, rows: 2, placeholder: 'Proyector fijo en techo con pantalla motorizada, cableado HDMI hasta la mesa de control y configuración' })}
        {txt('tecnico', 'Técnico responsable')}
        {txt('duracion', 'Duración estimada', { placeholder: 'Una jornada' })}
        {txt('horario', 'Horario de trabajo permitido', { placeholder: 'L-V de 9:00 a 14:00' })}
      </FormGroup>

      <FormGroup title="Qué se instala">
        <div className="field field-wide space-y-2">
          {material.map((m, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[2.2fr_70px_1.4fr_1fr_auto] gap-2 items-end rounded-lg border border-black/10 p-2 sm:border-0 sm:p-0">
              <label className="text-[12.5px] col-span-2 sm:col-span-1">Equipo y marca/modelo<input className="input-form" value={m.equipo} placeholder="Proyector láser Epson EB-L630U" onChange={(e) => setMat(i, { equipo: e.target.value })} /></label>
              <label className="text-[12.5px]">Cant.<input type="number" min="1" step="1" className="input-form num" value={m.cantidad || ''} onChange={(e) => setMat(i, { cantidad: Number(e.target.value) })} /></label>
              <label className="text-[12.5px]">Ubicación<input className="input-form" value={m.ubicacion} placeholder="Techo del salón" onChange={(e) => setMat(i, { ubicacion: e.target.value })} /></label>
              <label className="text-[12.5px] col-span-2 sm:col-span-1">Garantía fabricante<input className="input-form" value={m.garantia} placeholder="3 años" onChange={(e) => setMat(i, { garantia: e.target.value })} /></label>
              <button type="button" className="btn btn-ghost text-[13px]" aria-label={`Quitar equipo ${i + 1}`} disabled={material.length === 1}
                onClick={() => set('material', material.filter((_, j) => j !== i))}>Quitar</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost text-[13.5px]" onClick={() => set('material', [...material, materialVacio()])}>+ Añadir equipo</button>
        </div>
      </FormGroup>

      <FormGroup title="Trabajos">
        <div className="field field-wide">
          <span className="field-label">Trabajos incluidos (toca para marcar o quitar)</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {TRABAJOS.map((t) => {
              const on = trabajos.includes(t);
              return <button key={t} type="button" aria-pressed={on} onClick={() => toggleTrabajo(t)}
                className={`rounded-full px-3 py-1.5 text-[13px] border ${on ? 'bg-ink text-white border-transparent' : 'bg-white border-black/15 text-ink-2'}`}>{on ? '✓ ' : ''}{t}</button>;
            })}
          </div>
        </div>
        {txt('trabajosOtros', 'Otros trabajos incluidos', { wide: true })}
        {txt('excluidos', 'Trabajos excluidos además de los generales', { wide: true, placeholder: 'Vacío = ninguno' })}
        {txt('recorridos', 'Recorridos de cableado y tramos que quedarán vistos', { wide: true, rows: 2 })}
        {txt('esteticos', 'Requisitos estéticos obligatorios', { wide: true, placeholder: 'Vacío = ninguno' })}
        <div className="field"><span className="field-label">Trabajos eléctricos por instalador habilitado</span>
          <Chips label="Trabajos eléctricos" value={c.electricos} onChange={(x) => set('electricos', x)} options={[{ value: 'no', label: 'No' }, { value: 'si', label: 'Sí' }]} />
        </div>
        {c.electricos === 'si' && txt('electricosDetalle', 'Alcance, responsable y precio', { wide: true })}
      </FormGroup>

      <FormGroup title="Precio y pago">
        <Field label="Precio total sin IVA (€)" hint={imp.total > 0 ? `IVA 21%: ${euros(imp.iva)} · Total con IVA: ${euros(imp.total)}` : 'El IVA (21%) se calcula solo'}>
          <input type="number" inputMode="decimal" min="0" step="0.01" className="input-form num" value={c.precioBase || ''} onChange={(e) => set('precioBase', Number(e.target.value) || 0)} />
        </Field>
        <Field label="Primer pago a la firma, con IVA (€)" hint={<>
          {imp.es50 ? '50% del total' : `${Math.round(imp.reserva / (imp.total || 1) * 1000) / 10}% del total`} · Resto al terminar la instalación: {euros(imp.resto)}
          {!imp.es50 && <> · <button type="button" className="underline" onClick={() => set('primerPago', 0)}>volver al 50%</button></>}
        </>}>
          <input type="number" inputMode="decimal" min="0" step="0.01" className="input-form num" value={imp.total > 0 ? (c.primerPago || imp.reserva) : ''}
            onChange={(e) => set('primerPago', Number(e.target.value) || 0)} />
        </Field>
        <div className="field field-wide text-[13.5px] text-ink-2">
          Total: <b className="num">{euros(imp.total)}</b> con IVA (<span className="num">{euros(imp.base)}</span> sin IVA) · Primer pago: <b className="num">{euros(imp.reserva)}</b> · Al terminar: <b className="num">{euros(imp.resto)}</b>
        </div>
        <Field label="Garantía de la instalación (meses)"><input type="number" min="1" step="1" className="input-form num" value={c.garantiaMeses || ''} onChange={(e) => set('garantiaMeses', Number(e.target.value) || 0)} /></Field>
        {sinIva('tarifaDesplazamientoBase', 'Desplazamiento y diagnóstico fuera de garantía, sin IVA (€)')}
        {sinIva('horaTecnicoBase', 'Hora de técnico adicional, sin IVA (€)')}
        {txt('seguro', 'Seguro de responsabilidad civil (aseguradora y póliza)', { wide: true, hint: 'Se recuerda para los siguientes contratos' })}
        <div className="field field-wide text-[13px] text-ink-3">
          Cuenta para los pagos (fija): La Montada Sound · {c.cuentaEntidad || 'banco sin indicar'} · {c.iban || <b className="text-red-700">falta el IBAN en Ajustes → Datos fiscales</b>}
        </div>
      </FormGroup>

      <FormGroup title="Personas de contacto">
        {txt('interlocutor', 'Interlocutor del cliente (nombre, teléfono y correo)', { wide: true, hint: 'Quien estará durante los trabajos y firma el acta' })}
        {txt('autorizado', 'Quién puede aceptar trabajos adicionales', { wide: true, placeholder: 'Vacío = solo el cliente' })}
      </FormGroup>

      <FormGroup title="Otras condiciones y firma">
        <div className="field"><span className="field-label">¿El cliente se opone a que usemos fotos de la instalación?</span>
          <Chips label="Oposición a imágenes" value={c.oposicionImagenes} onChange={(x) => set('oposicionImagenes', x)} options={[{ value: 'no', label: 'No' }, { value: 'si', label: 'Sí' }]} />
        </div>
        {txt('particulares', 'Condiciones particulares (opcional)', { wide: true, rows: 3, hint: 'Prevalecen sobre las generales' })}
        {txt('firmante', 'Firma por La Montada')}
        {txt('lugarFirma', 'Lugar de firma')}
        <Field label="Fecha de firma"><input type="date" className="input-form" value={c.fechaFirma} onChange={(e) => set('fechaFirma', e.target.value)} /></Field>
      </FormGroup>
    </fieldset>
  );
}
