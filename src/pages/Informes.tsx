import { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useStore } from '../store/useStore';
import { fmt, fmtShort, buildMonthlyTable, getAvailableYears } from '../utils/helpers';

type Tab = 'montada' | 'dj' | 'conjunto';
const TABS: { id: Tab; label: string }[] = [{ id: 'montada', label: 'La Montada Sound' }, { id: 'dj', label: 'DJ Personal' }, { id: 'conjunto', label: 'Conjunto' }];

const IS_PCT = 0.25;

const Row = ({ label, value, sub, bold, color }: { label: string; value: string; sub?: string; bold?: boolean; color?: string }) => (
  <div className={`flex items-center justify-between px-4 py-2.5 border-b border-surface-400/10 ${bold ? 'bg-surface-700/50' : ''}`}>
    <div>
      <span className={`text-sm ${bold ? 'font-semibold text-white' : 'text-zinc-400'}`}>{label}</span>
      {sub && <span className="text-xs text-zinc-600 ml-2">{sub}</span>}
    </div>
    <span className={`text-sm font-semibold ${color ?? (bold ? 'text-white' : 'text-zinc-300')}`}>{value}</span>
  </div>
);

const Divider = ({ label }: { label: string }) => (
  <div className="px-4 py-1.5 bg-surface-700/30 text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-surface-400/10">{label}</div>
);

const calcArea = (ing: { baseImponible: number; importeIVA: number }[], gas: { baseImponible: number; importeIVA: number; deducible: boolean }[]) => {
  const totalIng = ing.reduce((s, i) => s + i.baseImponible, 0);
  const totalGas = gas.reduce((s, g) => s + g.baseImponible, 0);
  const beneficioBruto = totalIng - totalGas;
  const is = Math.max(0, beneficioBruto * IS_PCT);
  const beneficioNeto = beneficioBruto - is;
  const ivaRep = ing.reduce((s, i) => s + i.importeIVA, 0);
  const ivaSop = gas.filter((g) => g.deducible).reduce((s, g) => s + g.importeIVA, 0);
  const ivaLiq = ivaRep - ivaSop;
  return { totalIng, totalGas, beneficioBruto, is, beneficioNeto, ivaRep, ivaSop, ivaLiq };
};

const MonthlyTable = ({ monthly }: { monthly: ReturnType<typeof buildMonthlyTable> }) => {
  let acum = 0;
  const totIng = monthly.reduce((s, r) => s + r.ing, 0);
  const totGas = monthly.reduce((s, r) => s + r.gTotal, 0);
  return (
    <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-surface-400/20">
          <th className="text-left px-4 py-3 text-zinc-500">Mes</th>
          <th className="text-right px-4 py-3 text-zinc-500">Ingresos</th>
          <th className="text-right px-4 py-3 text-zinc-500">G. Fijos</th>
          <th className="text-right px-4 py-3 text-zinc-500">G. Variables</th>
          <th className="text-right px-4 py-3 text-zinc-500">Balance</th>
          <th className="text-right px-4 py-3 text-zinc-500">Acumulado</th>
          <th className="text-right px-4 py-3 text-zinc-500">IVA rep.</th>
          <th className="text-right px-4 py-3 text-zinc-500">IVA sop.</th>
        </tr></thead>
        <tbody>
          {monthly.map((row) => { acum += row.balance; return (
            <tr key={row.num} className={`border-b border-surface-400/10 hover:bg-surface-700/50 ${row.ing === 0 && row.gTotal === 0 ? 'opacity-40' : ''}`}>
              <td className="px-4 py-2.5 text-zinc-300 font-medium">{row.label}</td>
              <td className="px-4 py-2.5 text-right text-green-400">{row.ing > 0 ? fmt(row.ing) : '—'}</td>
              <td className="px-4 py-2.5 text-right text-zinc-400">{row.gFijo > 0 ? fmt(row.gFijo) : '—'}</td>
              <td className="px-4 py-2.5 text-right text-zinc-400">{row.gVar > 0 ? fmt(row.gVar) : '—'}</td>
              <td className={`px-4 py-2.5 text-right font-semibold ${row.balance >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{row.ing > 0 || row.gTotal > 0 ? fmt(row.balance) : '—'}</td>
              <td className={`px-4 py-2.5 text-right font-semibold ${acum >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(acum)}</td>
              <td className="px-4 py-2.5 text-right text-zinc-500">{row.ivaRep > 0 ? fmt(row.ivaRep) : '—'}</td>
              <td className="px-4 py-2.5 text-right text-zinc-500">{row.ivaSop > 0 ? fmt(row.ivaSop) : '—'}</td>
            </tr>
          ); })}
        </tbody>
        <tfoot><tr className="bg-surface-700/50 font-semibold">
          <td className="px-4 py-3 text-zinc-300">TOTAL</td>
          <td className="px-4 py-3 text-right text-green-400">{fmt(totIng)}</td>
          <td className="px-4 py-3 text-right text-zinc-400">{fmt(monthly.reduce((s, r) => s + r.gFijo, 0))}</td>
          <td className="px-4 py-3 text-right text-zinc-400">{fmt(monthly.reduce((s, r) => s + r.gVar, 0))}</td>
          <td className={`px-4 py-3 text-right ${totIng - totGas >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmt(totIng - totGas)}</td>
          <td className="px-4 py-3 text-right text-blue-400">{fmt(acum)}</td>
          <td className="px-4 py-3 text-right text-zinc-500">{fmt(monthly.reduce((s, r) => s + r.ivaRep, 0))}</td>
          <td className="px-4 py-3 text-right text-zinc-500">{fmt(monthly.reduce((s, r) => s + r.ivaSop, 0))}</td>
        </tr></tfoot>
      </table>
    </div>
  );
};

export const Informes = () => {
  const { ingresos, gastos } = useStore();
  const allYears = useMemo(() => getAvailableYears([...ingresos, ...gastos]), [ingresos, gastos]);
  const [year, setYear] = useState(allYears[0] ?? new Date().getFullYear());
  const [tab, setTab] = useState<Tab>('conjunto');

  // Properly memoised filtered arrays — stable references for downstream useMemos
  const mIng = useMemo(() => ingresos.filter((i) => i.area === 'montada' && new Date(i.fechaEvento).getFullYear() === year), [ingresos, year]);
  const mGas = useMemo(() => gastos.filter((g) => g.area === 'montada' && new Date(g.fecha).getFullYear() === year), [gastos, year]);
  const djIng = useMemo(() => ingresos.filter((i) => i.area === 'dj' && new Date(i.fechaEvento).getFullYear() === year), [ingresos, year]);
  const djGas = useMemo(() => gastos.filter((g) => g.area === 'dj' && new Date(g.fecha).getFullYear() === year), [gastos, year]);

  const mC = useMemo(() => calcArea(mIng, mGas), [mIng, mGas]);
  const djC = useMemo(() => calcArea(djIng, djGas), [djIng, djGas]);

  const totalIng = mC.totalIng + djC.totalIng;
  const totalGas = mC.totalGas + djC.totalGas;
  const beneficioBruto = totalIng - totalGas;
  const is = Math.max(0, beneficioBruto * IS_PCT);
  const beneficioNeto = beneficioBruto - is;
  const ivaRep = mC.ivaRep + djC.ivaRep;
  const ivaSop = mC.ivaSop + djC.ivaSop;
  const ivaLiq = ivaRep - ivaSop;

  const mMonthly = useMemo(() => buildMonthlyTable(mIng, mGas, year), [mIng, mGas, year]);
  const djMonthly = useMemo(() => buildMonthlyTable(djIng, djGas, year), [djIng, djGas, year]);
  const conjChartData = mMonthly.map((r, i) => ({
    mes: r.label.slice(0, 3),
    montada: r.balance,
    dj: djMonthly[i].balance,
    conjunto: r.balance + djMonthly[i].balance,
  }));

  const exportXlsx = () => {
    const rows = mMonthly.map((r, i) => ({
      Mes: r.label,
      'Ing. Montada': r.ing, 'Gas. Montada': r.gTotal, 'Bal. Montada': r.balance,
      'Ing. DJ': djMonthly[i].ing, 'Gas. DJ': djMonthly[i].gTotal, 'Bal. DJ': djMonthly[i].balance,
      'Bal. Conjunto': r.balance + djMonthly[i].balance,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Informe ${year}`);
    XLSX.writeFile(wb, `informe-${year}.xlsx`);
  };

  const renderArea = (c: ReturnType<typeof calcArea>, label: string, monthly: ReturnType<typeof buildMonthlyTable>) => (
    <div className="space-y-4">
    <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-400/20">
        <h3 className="text-sm font-semibold text-white">{label} — {year}</h3>
      </div>
      <Divider label="Cuenta de resultados (base imponible)" />
      <Row label="Ingresos brutos (s/IVA)" value={fmt(c.totalIng)} color="text-green-400" />
      <Row label="Total gastos (s/IVA)" value={fmt(c.totalGas)} color="text-red-400" />
      <Row label="Beneficio bruto" value={fmt(c.beneficioBruto)} bold color={c.beneficioBruto >= 0 ? 'text-gold-400' : 'text-red-400'} />
      <Row label="Impuesto de Sociedades 25%" value={fmt(c.is)} sub="estimado" color="text-orange-400" />
      <Row label="Beneficio neto (después IS)" value={fmt(c.beneficioNeto)} bold color={c.beneficioNeto >= 0 ? 'text-blue-400' : 'text-red-400'} />
      <Divider label="IVA" />
      <Row label="IVA repercutido" value={fmt(c.ivaRep)} color="text-emerald-400" />
      <Row label="IVA soportado deducible" value={fmt(c.ivaSop)} color="text-orange-400" />
      <Row label={c.ivaLiq >= 0 ? 'IVA a pagar' : 'IVA a compensar'} value={fmt(Math.abs(c.ivaLiq))} bold color={c.ivaLiq >= 0 ? 'text-red-400' : 'text-green-400'} />
    </div>
    <div className="pt-1">
      <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">Desglose mensual — base imponible</p>
      <MonthlyTable monthly={monthly} />
    </div>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Informes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Análisis financiero y fiscal</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none">
            {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportXlsx} className="flex items-center gap-2 px-3 py-1.5 bg-surface-700 border border-surface-400/30 text-zinc-300 text-sm rounded-lg hover:text-white"><Download size={14} />Excel</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 border border-surface-400/20 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-gold-500/15 text-gold-400' : 'text-zinc-500 hover:text-zinc-200'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'montada' && renderArea(mC, 'La Montada Sound', mMonthly)}
      {tab === 'dj' && renderArea(djC, 'DJ Personal', djMonthly)}

      {tab === 'conjunto' && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-4"><p className="text-xs text-zinc-500 mb-1">Ingresos totales</p><p className="text-xl font-bold text-green-400">{fmtShort(totalIng)}</p><p className="text-xs text-zinc-600 mt-1">M: {fmtShort(mC.totalIng)} + DJ: {fmtShort(djC.totalIng)}</p></div>
            <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-4"><p className="text-xs text-zinc-500 mb-1">Gastos totales</p><p className="text-xl font-bold text-red-400">{fmtShort(totalGas)}</p><p className="text-xs text-zinc-600 mt-1">M: {fmtShort(mC.totalGas)} + DJ: {fmtShort(djC.totalGas)}</p></div>
            <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-4"><p className="text-xs text-zinc-500 mb-1">Beneficio bruto</p><p className={`text-xl font-bold ${beneficioBruto >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmtShort(beneficioBruto)}</p><p className="text-xs text-zinc-600 mt-1">Antes de IS</p></div>
            <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-4"><p className="text-xs text-zinc-500 mb-1">Beneficio neto</p><p className={`text-xl font-bold ${beneficioNeto >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmtShort(beneficioNeto)}</p><p className="text-xs text-zinc-600 mt-1">IS est.: {fmtShort(is)}</p></div>
          </div>

          {/* Full P&L */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-400/20"><h3 className="text-sm font-semibold text-white">Cuenta de Pérdidas y Ganancias — {year}</h3></div>
              <Divider label="Ingresos" />
              <Row label="La Montada Sound (s/IVA)" value={fmt(mC.totalIng)} color="text-green-400" />
              <Row label="DJ Personal (s/IVA)" value={fmt(djC.totalIng)} color="text-green-400" />
              <Row label="TOTAL INGRESOS" value={fmt(totalIng)} bold color="text-green-400" />
              <Divider label="Gastos" />
              <Row label="La Montada Sound (s/IVA)" value={fmt(mC.totalGas)} color="text-red-400" />
              <Row label="DJ Personal (s/IVA)" value={fmt(djC.totalGas)} color="text-red-400" />
              <Row label="TOTAL GASTOS" value={fmt(totalGas)} bold color="text-red-400" />
              <Divider label="Resultado" />
              <Row label="Beneficio bruto" value={fmt(beneficioBruto)} bold color={beneficioBruto >= 0 ? 'text-gold-400' : 'text-red-400'} />
              <Row label="Impuesto Sociedades 25%" value={`— ${fmt(is)}`} color="text-orange-400" />
              <Row label="BENEFICIO NETO" value={fmt(beneficioNeto)} bold color={beneficioNeto >= 0 ? 'text-blue-400' : 'text-red-400'} />
            </div>
            <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-400/20"><h3 className="text-sm font-semibold text-white">Liquidación IVA — {year}</h3></div>
              <Divider label="IVA repercutido (ventas)" />
              <Row label="La Montada Sound" value={fmt(mC.ivaRep)} />
              <Row label="DJ Personal" value={fmt(djC.ivaRep)} />
              <Row label="Total IVA repercutido" value={fmt(ivaRep)} bold color="text-emerald-400" />
              <Divider label="IVA soportado deducible (compras)" />
              <Row label="La Montada Sound" value={fmt(mC.ivaSop)} />
              <Row label="DJ Personal" value={fmt(djC.ivaSop)} />
              <Row label="Total IVA soportado" value={fmt(ivaSop)} bold color="text-orange-400" />
              <Divider label="Resultado IVA" />
              <Row label={ivaLiq >= 0 ? 'IVA a pagar a Hacienda' : 'IVA a compensar'} value={fmt(Math.abs(ivaLiq))} bold color={ivaLiq >= 0 ? 'text-red-400' : 'text-green-400'} />
            </div>
          </div>

          {/* Chart */}
          <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Balance mensual por área — {year}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={conjChartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="mes" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: any) => fmtShort(Number(v))} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="montada" name="La Montada" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dj" name="DJ Personal" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
