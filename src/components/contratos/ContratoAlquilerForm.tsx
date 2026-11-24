import { FormGroup, Field, Chips } from '../kit';
import { euros } from '../../lib/contratoPdfKit';
import { NumInput, TerminosFields } from './campos';
import { TERMINOS_ALQUILER, ALMACEN, equipoVacio, importesAlquiler, jornadasAlquiler, type ContratoAlquiler, type EquipoAlquiler } from '../../lib/contratoAlquiler';

type Props = { value: ContratoAlquiler; onChange: (v: ContratoAlquiler) => void; disabled?: boolean };

/** Ficha con los datos del Anexo I del contrato de alquiler de equipos. */
export function ContratoAlquilerForm({ value: c, onChange, disabled }: Props) {
  const set = <K extends keyof ContratoAlquiler>(k: K, val: ContratoAlquiler[K]) => onChange({ ...c, [k]: val });
  const txt = (k: keyof ContratoAlquiler, label: string, opts: { wide?: boolean; placeholder?: string; rows?: number; hint?: string; type?: string } = {}) => (
    <Field label={label} wide={opts.wide} hint={opts.hint}>
      {opts.rows
        ? <textarea className="input-form" rows={opts.rows} placeholder={opts.placeholder} value={String(c[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} />
        : <input className="input-form" type={opts.type ?? 'text'} placeholder={opts.placeholder} value={String(c[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} />}
    </Field>
  );
  const num = (k: 'precioDiario' | 'precioAlquiler' | 'transporte' | 'tarifaEspera' | 'fianza', label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <NumInput value={c[k] || undefined} onChange={(n) => set(k, n ?? 0)} />
    </Field>
  );
  /** Campo en euros sin IVA; se guarda con IVA (21%). */
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sinIva = (k: 'precioDiario' | 'precioAlquiler' | 'transporte' | 'tarifaEspera', label: string, hint?: string) => (
    <Field label={label} hint={<>{c[k] > 0 ? `Con IVA: ${euros(c[k])}` : 'El IVA (21%) se calcula solo'}{hint ? ` · ${hint}` : ''}</>}>
      <NumInput value={c[k] ? r2(c[k] / 1.21) : undefined} onChange={(n) => set(k, r2((n ?? 0) * 1.21))} />
    </Field>
  );
  const jornadas = jornadasAlquiler(c);
  const imp = importesAlquiler(c);
  const entrega = c.modalidad === 'entrega';
  const setModalidad = (m: ContratoAlquiler['modalidad']) => onChange({
    ...c, modalidad: m,
    entregaLugar: m === 'almacen' ? ALMACEN : (c.entregaLugar === ALMACEN ? '' : c.entregaLugar),
    devolucionLugar: m === 'almacen' ? ALMACEN : (c.devolucionLugar === ALMACEN ? '' : c.devolucionLugar),
  });
  const equipos = c.equipos?.length ? c.equipos : [equipoVacio()];
  const setEquipo = (i: number, patch: Partial<EquipoAlquiler>) => set('equipos', equipos.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const valorTotal = equipos.reduce((a, e) => a + (Number(e.valor) || 0) * (Number(e.cantidad) || 1), 0);

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

      <FormGroup title="Entrega y devolución">
        <div className="field field-wide">
          <span className="field-label">Modalidad</span>
          <Chips label="Modalidad" value={c.modalidad} onChange={setModalidad}
            options={[{ value: 'almacen', label: 'Recogen en el almacén' }, { value: 'entrega', label: 'Lo llevamos nosotros' }]} />
        </div>
        <Field label="Fecha de entrega"><input type="date" className="input-form" value={c.entregaFecha} onChange={(e) => set('entregaFecha', e.target.value)} /></Field>
        <Field label="Hora de entrega"><input type="time" className="input-form" value={c.entregaHora} onChange={(e) => set('entregaHora', e.target.value)} /></Field>
        <Field label="Fecha de devolución"><input type="date" className="input-form" min={c.entregaFecha || undefined} value={c.devolucionFecha} onChange={(e) => set('devolucionFecha', e.target.value)} /></Field>
        <Field label="Hora de devolución"><input type="time" className="input-form" value={c.devolucionHora} onChange={(e) => set('devolucionHora', e.target.value)} /></Field>
        {entrega && <>
          {txt('entregaLugar', 'Dirección de entrega', { wide: true })}
          {txt('devolucionLugar', 'Dirección de recogida', { wide: true, placeholder: 'Normalmente la misma' })}
        </>}
        {txt('autorizados', 'Personas autorizadas a recoger y devolver (nombre, DNI y teléfono)', { wide: true, rows: 2 })}
        {txt('telefonoMontada', 'Teléfono de La Montada')}
        <div className="field text-[13.5px] text-ink-2 self-end">
          <p>{jornadas ? <>Jornadas de 24 h: <b className="num">{jornadas}</b></> : 'Pon las fechas para calcular las jornadas'}</p>
        </div>
      </FormGroup>

      <FormGroup title="Equipos alquilados">
        {txt('presupuestoRef', 'Presupuesto adjunto (referencia, fecha y versión)', { wide: true, placeholder: 'PRE-00052 · 11/11/2026 · v1' })}
        <div className="field field-wide space-y-2">
          {equipos.map((e, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_70px_1.6fr_1fr_auto] gap-2 items-end rounded-lg border border-black/10 p-2 sm:border-0 sm:p-0">
              <label className="text-[12.5px] col-span-2 sm:col-span-1">Equipo y marca/modelo<input className="input-form" value={e.equipo} placeholder="Altavoz RCF ART 912-A" onChange={(ev) => setEquipo(i, { equipo: ev.target.value })} /></label>
              <label className="text-[12.5px]">N.º de serie<input className="input-form" value={e.serie} onChange={(ev) => setEquipo(i, { serie: ev.target.value })} /></label>
              <label className="text-[12.5px]">Cant.<input type="number" min="1" step="1" className="input-form num" value={e.cantidad || ''} onChange={(ev) => setEquipo(i, { cantidad: Number(ev.target.value) })} /></label>
              <label className="text-[12.5px] col-span-2 sm:col-span-1">Accesorios y embalaje<input className="input-form" value={e.accesorios} placeholder="Cable, funda" onChange={(ev) => setEquipo(i, { accesorios: ev.target.value })} /></label>
              <label className="text-[12.5px]">Valor reposición (€)<input type="number" min="0" step="1" className="input-form num" value={e.valor || ''} onChange={(ev) => setEquipo(i, { valor: Number(ev.target.value) })} /></label>
              <button type="button" className="btn btn-ghost text-[13px]" aria-label={`Quitar equipo ${i + 1}`} disabled={equipos.length === 1}
                onClick={() => set('equipos', equipos.filter((_, j) => j !== i))}>Quitar</button>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button type="button" className="btn btn-ghost text-[13.5px]" onClick={() => set('equipos', [...equipos, equipoVacio()])}>+ Añadir equipo</button>
            {valorTotal > 0 && <span className="text-[13px] text-ink-3">Valor de reposición total: <b className="num">{euros(valorTotal)}</b></span>}
          </div>
        </div>
      </FormGroup>

      <FormGroup title="Precio y fianza">
        {sinIva('precioDiario', 'Precio diario sin IVA (€)', 'para retrasos y reparaciones')}
        {sinIva('precioAlquiler', 'Precio del alquiler sin IVA (€)', jornadas && c.precioDiario > 0 ? `${jornadas} jornadas × ${euros(r2(c.precioDiario / 1.21))} = ${euros(r2(jornadas * c.precioDiario / 1.21))} sin IVA` : 'todo el periodo')}
        {entrega && sinIva('transporte', 'Transporte sin IVA (€)', 'entrega y recogida')}
        {entrega && sinIva('tarifaEspera', 'Desplazamiento extra o espera sin IVA (€)')}
        <div className="field field-wide text-[13.5px] text-ink-2">
          <p>Total a pagar antes de la entrega (100%): <b className="num">{euros(imp.total)}</b> con IVA (<span className="num">{euros(imp.base)}</span> sin IVA)</p>
        </div>
        {num('fianza', 'Fianza (€)', 'Aparte del precio')}
        <Field label="Medio de la fianza">
          <select className="input-form" value={c.fianzaMedio} onChange={(e) => set('fianzaMedio', e.target.value)}>
            {['Transferencia', 'Preautorización en tarjeta', 'Efectivo', 'Otro'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        {txt('fianzaDevolucion', 'Cuenta o medio para devolver la fianza', { wide: true })}
        <div className="field field-wide text-[13px] text-ink-3">
          <p>Cuenta para los pagos (fija): La Montada Sound · {c.cuentaEntidad || 'banco sin indicar'} · {c.iban || <b className="text-red-700">falta el IBAN en Ajustes → Datos fiscales</b>}</p>
        </div>
      </FormGroup>

      <TerminosFields defs={TERMINOS_ALQUILER} value={c.terminos} onChange={(t) => set('terminos', t)} />

      <FormGroup title="Otras condiciones y firma">
        {txt('particulares', 'Condiciones particulares (opcional)', { wide: true, rows: 3, hint: 'Prevalecen sobre las generales' })}
        {txt('firmante', 'Firma por La Montada')}
        {txt('lugarFirma', 'Lugar de firma')}
        <Field label="Fecha de firma"><input type="date" className="input-form" value={c.fechaFirma} onChange={(e) => set('fechaFirma', e.target.value)} /></Field>
      </FormGroup>
    </fieldset>
  );
}
