import { Link } from 'react-router-dom';
import { Plus, ChevronRight } from 'lucide-react';
import type { Ingreso, GastoEvento } from '../../types';
import { ingresoRentabilidad, gastoEventoSinIVA, gastoEventoConIVA } from '../../lib/ingresoRentabilidad';
import { resolveLinea } from '../../config/resolveLinea';
import { Modal } from '../ui/Modal';
import { ExpenseStatus } from '../ui/ExpenseStatus';
import { Pill, SplitBar, Btn } from '../kit';
import { ESTADO_LABEL, ESTADO_TONE } from '../ingresos/estado';
import { fmt } from '../../utils/helpers';

const paths = {
  montada_sound: '/lineas/montada-sound/gastos-eventos',
  dj: '/dj/gastos-actuacion',
  real_madrid: '/lineas/real-madrid/gastos-actuacion',
  montada_installations: '/lineas/installations/gastos-instalacion',
};

/** Ficha del evento: cifras clave, margen y gastos vinculados. */
export function IngresoRentabilidad({ ingreso, gastos, onClose, onAddExpense }: {
  ingreso: Ingreso; gastos: GastoEvento[]; onClose: () => void; onAddExpense?: () => void;
}) {
  const r = ingresoRentabilidad(ingreso, gastos);
  const margen = r.margen == null ? null : Math.round(r.margen * 10) / 10;
  return (
    <Modal isOpen onClose={onClose} title={ingreso.concepto} size="lg">
      <div className="flex items-center gap-2 flex-wrap -mt-1 mb-5 text-[14px] text-ink-3">
        <span>{ingreso.cliente}</span><span>·</span><span>{ingreso.fechaEvento}</span><span>·</span><span>{ingreso.tipoEvento}</span>
        <span className="ml-auto flex gap-2">
          <Pill tone={ESTADO_TONE[ingreso.estadoPago]}>{ESTADO_LABEL[ingreso.estadoPago] ?? ingreso.estadoPago}</Pill>
          {ingreso.numeroFactura && <Pill tone="info">{ingreso.numeroFactura}</Pill>}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          ['Sin IVA', fmt(ingreso.baseImponible), ''],
          ['Con IVA', fmt(ingreso.total), ''],
          ['Gastos s/IVA', fmt(r.coste), ''],
          ['Beneficio', fmt(r.beneficio), r.beneficio >= 0 ? 'text-[#1f9d55]' : 'text-[#d70015]'],
        ].map(([label, value, cls]) => (
          <div key={label} className="rounded-2xl bg-[var(--widget-2)] p-3.5">
            <p className="text-[12px] text-ink-3">{label}</p>
            <p className={`num mt-1 text-[18px] font-semibold tracking-[-0.02em] ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-[var(--widget-2)] p-4">
        <div className="flex justify-between text-[14px] mb-2.5">
          <span className="font-semibold">Margen</span>
          <span className={`num font-semibold ${r.beneficio >= 0 ? 'text-[#1f9d55]' : 'text-[#d70015]'}`}>{margen == null ? '—' : `${margen.toLocaleString('es-ES')} %`}</span>
        </div>
        <SplitBar parts={[
          { label: 'Gastos', value: r.coste, color: '#d70015' },
          { label: 'Beneficio', value: Math.max(0, r.beneficio), color: '#1f9d55' },
        ]} />
        <div className="flex justify-between mt-3 text-[13px] text-ink-3">
          <span>Cobrado <b className="num text-ink">{fmt(r.cobrado)}</b></span>
          <span>Pendiente <b className={`num ${r.pendiente > 0 ? 'text-[#c26a00]' : 'text-ink'}`}>{fmt(r.pendiente)}</b></span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 mb-2">
        <h3 className="widget-title">Gastos <span className="text-ink-3 font-normal">{r.gastos.length}</span></h3>
        {onAddExpense && <Btn variant="secondary" onClick={onAddExpense}><Plus size={15} strokeWidth={2.4} />Añadir gasto</Btn>}
      </div>
      {r.gastos.length ? (
        <div className="rounded-2xl bg-[var(--widget-2)] divide-y divide-black/[.06]">
          {r.gastos.map((g) => (
            <div key={g.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium truncate">{g.concepto}</p>
                <p className="text-[12.5px] text-ink-3">{g.categoria} · {g.fecha}</p>
              </div>
              <ExpenseStatus status={g.estadoPago} />
              <div className="text-right">
                <p className="num text-[14.5px] font-semibold">{fmt(gastoEventoConIVA(g))}</p>
                <p className="num text-[12px] text-ink-3">{fmt(gastoEventoSinIVA(g))} s/IVA</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-[var(--widget-2)] p-4 text-[14px] text-ink-3">Sin gastos todavía.</p>
      )}

      <Link onClick={onClose} to={`${paths[resolveLinea(ingreso)]}?ingreso=${encodeURIComponent(ingreso.id)}`} className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--blue)]">
        Abrir gastos de este evento <ChevronRight size={15} />
      </Link>
      {ingreso.notas && <p className="mt-5 rounded-2xl bg-[var(--widget-2)] p-4 text-[14px] whitespace-pre-wrap">{ingreso.notas}</p>}
    </Modal>
  );
}
