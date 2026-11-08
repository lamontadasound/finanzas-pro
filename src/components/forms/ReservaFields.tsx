import type { Ingreso, PaymentMethod } from '../../types';
import { Field } from '../kit';
import { totalReservasDe } from '../../lib/contabilidad';
import { fmt } from '../../utils/helpers';
import { useConfirmStore } from '../../store/useConfirmStore';

const METHODS: PaymentMethod[] = ['transferencia', 'tarjeta', 'efectivo', 'bizum'];
const LABELS = { transferencia: 'Transferencia', tarjeta: 'Tarjeta', efectivo: 'Efectivo', bizum: 'Bizum' };
const EMPTY_SECOND: Partial<Ingreso> = { reserva2: 0, fechaCobroReserva2: undefined, metodoPagoReserva2: undefined, reserva2IncluyeIva: undefined };

/** Una línea por reserva; sus campos solo se despliegan al editarla. */
export function ReservaFields({ value, onChange }: { value: Partial<Ingreso>; onChange: (patch: Partial<Ingreso>) => void }) {
  const confirm = useConfirmStore((s) => s.show);
  const count = value.tieneReserva ? value.numeroReservas ?? 1 : 0;
  const changeCount = (next: number) => {
    const apply = () => onChange({
      tieneReserva: next > 0, numeroReservas: next === 2 ? 2 : 1,
      ...(next < 2 ? EMPTY_SECOND : {}),
      ...(next === 0 ? { reserva: 0, fechaCobroReserva: undefined, metodoPagoReserva: undefined, reservaIncluyeIva: undefined } : {}),
    });
    const secondHasData = !!(value.reserva2 || value.fechaCobroReserva2 || value.metodoPagoReserva2 || value.reserva2IncluyeIva != null);
    const firstHasData = !!(value.reserva || value.fechaCobroReserva || value.metodoPagoReserva || value.reservaIncluyeIva != null);
    if (next < count && ((next < 2 && secondHasData) || (next === 0 && firstHasData))) {
      confirm(next === 0 ? '¿Eliminar las reservas registradas? Se recalculará el importe pendiente.' : '¿Eliminar la segunda reserva y sus datos? Se recalculará el importe pendiente.', apply);
    } else apply();
  };
  return <div className="field-wide space-y-2">
    <div className="flex items-center justify-between gap-3">
      <label className="flex items-center gap-3 text-sm font-medium">Número de reservas
        <select className="input-form !w-20" value={count} onChange={(e) => changeCount(Number(e.target.value))}>
          <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option>
        </select>
      </label>
      {count > 0 && <span className="text-sm num">Total {fmt(totalReservasDe(value))}</span>}
    </div>
    {Array.from({ length: count }, (_, index) => {
      const second = index === 1;
      const amountKey = second ? 'reserva2' : 'reserva';
      const dateKey = second ? 'fechaCobroReserva2' : 'fechaCobroReserva';
      const methodKey = second ? 'metodoPagoReserva2' : 'metodoPagoReserva';
      const ivaKey = second ? 'reserva2IncluyeIva' : 'reservaIncluyeIva';
      const label = `Reserva ${index + 1}`;
      return <details key={index} className="rounded-xl border border-black/10 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          {label} · {fmt(value[amountKey] ?? 0)}
          <span className="ml-2 text-ink-3 font-normal">{value[dateKey] || 'Sin fecha'}</span>
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
          <Field label={`${label}: importe (€)`}>
            <input className="input-form num" type="number" min="0" step="0.01" inputMode="decimal" value={value[amountKey] ?? 0} onChange={(e) => onChange({ [amountKey]: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
          <Field label={`${label}: fecha`}>
            <input className="input-form" type="date" value={value[dateKey] ?? ''} onChange={(e) => onChange({ [dateKey]: e.target.value || undefined })} />
          </Field>
          <Field label={`${label}: método`}>
            <select className="input-form" value={value[methodKey] ?? ''} onChange={(e) => onChange({ [methodKey]: e.target.value || undefined })}>
              <option value="">Sin indicar</option>
              {value[methodKey] && !METHODS.includes(value[methodKey]) && <option value={value[methodKey]}>{value[methodKey]}</option>}
              {METHODS.map((m) => <option key={m} value={m}>{LABELS[m as keyof typeof LABELS]}</option>)}
            </select>
          </Field>
          <Field label={`${label}: IVA`}>
            <select className="input-form" value={value[ivaKey] == null ? '' : String(value[ivaKey])} onChange={(e) => onChange({ [ivaKey]: e.target.value === '' ? undefined : e.target.value === 'true' })}>
              <option value="">Sin indicar</option><option value="true">Con IVA</option><option value="false">Sin IVA</option>
            </select>
          </Field>
        </div>
      </details>;
    })}
  </div>;
}
