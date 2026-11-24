import { useState } from 'react';
import { Field } from '../kit';
import { errorTerminos, type Termino, type Terminos } from '../../lib/contratoTerminos';

/** Número que se puede vaciar y reescribir con libertad: mientras se escribe manda el texto, no el valor calculado. */
export function NumInput({ value, onChange, placeholder, step = '0.01', min = '0', cero = false, label }: {
  value: number | undefined; onChange: (n: number | undefined) => void; placeholder?: string; step?: string; min?: string; cero?: boolean; label?: string;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const fijo = value === undefined || (!cero && !value) ? '' : String(value);
  return <input type="number" inputMode="decimal" min={min} step={step} aria-label={label} placeholder={placeholder} className="input-form num"
    value={texto ?? fijo} onFocus={() => setTexto(fijo)} onBlur={() => setTexto(null)}
    onChange={(e) => { setTexto(e.target.value); const n = Number(e.target.value); onChange(e.target.value.trim() === '' || !Number.isFinite(n) ? undefined : n); }} />;
}

/** Plazos y porcentajes del modelo, modificables en cada contrato. */
export function TerminosFields({ defs, value, onChange }: { defs: readonly Termino[]; value?: Terminos; onChange: (t: Terminos) => void }) {
  const cambiados = defs.filter((d) => value?.[d.key] !== undefined && value[d.key] !== d.def).length;
  const error = errorTerminos(defs, value);
  return (
    <details className="fgroup">
      <summary className="fgroup-title cursor-pointer">Plazos y condiciones de este contrato{cambiados ? ` · ${cambiados} ${cambiados === 1 ? 'cambiado' : 'cambiados'}` : ' (si no tocas nada, los del abogado)'}</summary>
      <div className="fgroup-body">
        {defs.map((d) => {
          const val = value?.[d.key];
          const distinto = val !== undefined && val !== d.def;
          return <Field key={d.key} label={`${d.label} (${d.unidad})`} hint={distinto ? <>El del abogado: {d.def} · <button type="button" className="underline" onClick={() => onChange({ ...value, [d.key]: undefined })}>volver</button></> : undefined}>
            <NumInput cero min={String(d.min ?? 1)} step={d.unidad === 'veces' ? '0.5' : '1'} placeholder={String(d.def)} value={val ?? d.def} onChange={(n) => onChange({ ...value, [d.key]: n })} />
          </Field>;
        })}
        {error && <div className="field field-wide text-[13px] text-red-700" role="alert">{error}</div>}
      </div>
    </details>
  );
}
