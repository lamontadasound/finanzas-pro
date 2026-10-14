import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { joinDriveExpenses, type DriveExpenseAmount, type DriveExpenseFile } from '../../lib/driveExpenses';
import { usePermittedFinancialData } from '../../hooks/usePermittedFinancialData';
import {
  TRIMESTRES, type Trimestre, type RegimenIS, REGIMEN_IS_LABEL, type DriveIncomeFile,
  facturasFiscales, resumenPeriodo, cuotaIS,
} from '../../lib/previsionFiscal';
import { PageHeader, Widget, Money, SplitBar, Dot, Segmented, Chips, Metric, YearStepper } from '../kit';
import { fmt, fmtShort } from '../../utils/helpers';

const PLAZO_303: Record<Trimestre, string> = { 1: '1–20 de abril', 2: '1–20 de julio', 3: '1–20 de octubre', 4: '1–30 de enero' };
const KEY = 'prevision-regimen-is';
const leerRegimen = (): RegimenIS => {
  try { return (localStorage.getItem(KEY) as RegimenIS) || 'micro'; } catch { return 'micro'; }
};

type Vista = 'anio' | `${Trimestre}`;

/** Previsión de IVA e Impuesto de Sociedades calculada solo con las facturas. */
export const PrevisionFiscal = () => {
  const { ingresos, facturas } = usePermittedFinancialData();
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [vista, setVista] = useState<Vista>('anio');
  const [regimen, setRegimenState] = useState<RegimenIS>(leerRegimen);
  const [verSinImporte, setVerSinImporte] = useState(false);
  const [drive, setDrive] = useState<{ ingresos: DriveIncomeFile[]; gastos: ReturnType<typeof joinDriveExpenses> } | null>(null);
  const [error, setError] = useState('');

  const setRegimen = (r: RegimenIS) => {
    setRegimenState(r);
    try { localStorage.setItem(KEY, r); } catch { /* opcional */ }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('drive_invoice_files').select('id,nombre,numero,anio,mes,tipo,url,actualizado_en,sincronizado_en'),
      supabase.from('drive_expense_amounts').select('*'),
    ]).then(([f, a]) => {
      if (!active) return;
      if (f.error || a.error) { setError('No se pudieron leer las facturas de Drive.'); setDrive({ ingresos: [], gastos: [] }); return; }
      const files = (f.data ?? []) as (DriveExpenseFile & DriveIncomeFile & { tipo: string })[];
      setDrive({
        ingresos: files.filter((x) => x.tipo === 'emitida'),
        gastos: joinDriveExpenses(files.filter((x) => x.tipo === 'recibida'), (a.data ?? []) as DriveExpenseAmount[]),
      });
    });
    return () => { active = false; };
  }, []);

  const base = useMemo(
    () => (drive ? facturasFiscales(facturas, drive.ingresos, ingresos, drive.gastos) : { facturas: [], sinImporte: [] }),
    [drive, facturas, ingresos],
  );
  const years = useMemo(() => {
    const ys = new Set(base.facturas.map((f) => f.anio));
    ys.add(nowYear);
    return [...ys].filter((y) => y > 2000);
  }, [base, nowYear]);

  const q = vista === 'anio' ? undefined : (Number(vista) as Trimestre);
  const p = resumenPeriodo(base.facturas, year, q);
  const anual = resumenPeriodo(base.facturas, year);
  const trimestres = TRIMESTRES.map((t) => resumenPeriodo(base.facturas, year, t));
  const cuota = cuotaIS(anual.beneficio, regimen, year);
  const sinImporte = base.sinImporte.filter((s) => s.anio === year);
  const periodoLabel = q ? `${q}T ${year}` : String(year);

  return (
    <div>
      <PageHeader title="Previsión">
        <Segmented id="prev-vista" value={vista} onChange={setVista}
          options={[{ value: 'anio' as Vista, label: 'Año' }, ...TRIMESTRES.map((t) => ({ value: `${t}` as Vista, label: `${t}T` }))]} />
        <YearStepper year={year} years={years} onChange={setYear} />
      </PageHeader>

      {error && <div role="alert" className="banner banner-warn mb-4">{error}</div>}
      {!drive ? <p role="status" className="text-ink-3">Leyendo facturas…</p> : (
        <div className="bento">
          <Widget className="span-2 lg-row-2 hero-card flex flex-col">
            <p className="text-[13px] font-medium opacity-75">IVA {p.ivaResultado >= 0 ? 'a pagar' : 'a compensar'} · {periodoLabel}</p>
            <p className="hero-value mt-3"><Money value={Math.abs(p.ivaResultado)} /></p>
            <p className="mt-2 text-[14px] opacity-80">{q ? `Modelo 303 · del ${PLAZO_303[q]}` : 'Suma de los cuatro trimestres'}</p>
            <div className="mt-auto pt-8">
              <SplitBar parts={[
                { label: 'IVA facturado', value: p.ivaFacturado, color: 'var(--tint-ink)' },
                { label: 'IVA desgravado', value: p.ivaDesgravado, color: 'color-mix(in srgb, var(--tint-ink) 32%, transparent)' },
              ]} />
              <div className="flex justify-between mt-3 text-[13px] gap-3">
                <span className="flex items-center gap-1.5"><Dot color="var(--tint-ink)" />Facturado <b className="num ml-1">{fmt(p.ivaFacturado)}</b></span>
                <span className="flex items-center gap-1.5 opacity-80"><Dot color="color-mix(in srgb, var(--tint-ink) 40%, transparent)" />Desgravado <b className="num ml-1">{fmt(p.ivaDesgravado)}</b></span>
              </div>
            </div>
          </Widget>

          <Metric label="Ingresos facturados" value={p.ingresosBase} delay={0.03} foot={<>{p.nIngresos} facturas · sin IVA</>} />
          <Metric label="Gastos con factura" value={p.gastosBase} delay={0.05} foot={<>{p.nGastos} facturas · sin IVA</>} />
          <Metric label="IVA facturado" value={p.ivaFacturado} delay={0.07} />
          <Metric label="IVA desgravado" value={p.ivaDesgravado} delay={0.09} />

          <Widget className="span-2" title={`Impuesto de Sociedades · ${year}`} delay={0.12}>
            <dl className="space-y-2.5 text-[14px]">
              <Line label="Ingresos facturados" value={anual.ingresosBase} />
              <Line label="Gastos con factura" value={-anual.gastosBase} />
              <div className="h-px bg-black/[.08]" />
              <Line label="Beneficio según facturas" value={anual.beneficio} strong />
            </dl>
            <div className="mt-4 rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--tint-b) 14%, #fff)' }}>
              <p className="text-[13px] text-ink-2">Impuesto estimado · se paga en julio {year + 1}</p>
              <p className="num text-[28px] font-semibold tracking-[-0.03em] mt-1"><Money value={cuota} /></p>
            </div>
            <div className="mt-4">
              <Chips label="Régimen" value={regimen} onChange={setRegimen}
                options={(Object.keys(REGIMEN_IS_LABEL) as RegimenIS[]).map((r) => ({ value: r, label: REGIMEN_IS_LABEL[r] }))} />
            </div>
          </Widget>

          {sinImporte.length > 0 && (
            <Widget className="span-2" delay={0.18}>
              <button className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setVerSinImporte((v) => !v)} aria-expanded={verSinImporte}>
                <span>
                  <b className="text-[15px]">{sinImporte.length} facturas sin importe en {year}</b>
                  <span className="block text-[13px] text-ink-3">No entran en la previsión hasta que tengan importe.</span>
                </span>
                <ChevronDown size={18} className={`text-ink-3 transition-transform ${verSinImporte ? 'rotate-180' : ''}`} />
              </button>
              {verSinImporte && (
                <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 divide-y divide-black/[.06]">
                  {sinImporte.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                      <span className="truncate">{s.nombre}</span>
                      <span className="text-ink-3 shrink-0">{s.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} · {s.mes}/{s.anio}</span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </Widget>
          )}
          <Widget className="span-full" title={`Por trimestres · ${year}`} delay={0.15}>
            <div className="qgrid">
              <span />
              {TRIMESTRES.map((t) => (
                <button key={t} className="qhead" data-on={vista === `${t}`} onClick={() => setVista(`${t}`)}>{t}T</button>
              ))}
              <span className="qlabel">IVA</span>
              {trimestres.map((r, i) => <Cell key={i} v={r.ivaResultado} on={vista === `${i + 1}`} />)}
              <span className="qlabel">Beneficio</span>
              {trimestres.map((r, i) => <Cell key={i} v={r.beneficio} on={vista === `${i + 1}`} />)}
            </div>
          </Widget>

        </div>
      )}
    </div>
  );
};

const Cell = ({ v, on }: { v: number; on: boolean }) => (
  <span className={`qcell num ${v < 0 ? 'text-[#1f9d55]' : ''}`} data-on={on}>{fmtShort(v)}</span>
);

const Line = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
  <div className="flex justify-between gap-3">
    <dt className={strong ? 'font-semibold' : 'text-ink-2'}>{label}</dt>
    <dd className={`num ${strong ? 'font-semibold' : ''}`}>{fmt(value)}</dd>
  </div>
);
