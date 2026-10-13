import { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Area } from '../../types';
import { motion } from 'framer-motion';
import { PageHeader, YearStepper, Btn, Metric, Widget } from '../../components/kit';
import { MonthlyBars } from '../../components/kit/MonthlyBars';
import { gastoEventoSinIVA, ingresoRentabilidad } from '../../lib/ingresoRentabilidad';
import { useExpenseCategories, categoryColor } from '../../lib/expenseCategoryConfig';
import type { LineaId } from '../../config/businessLines';
import { resolveLinea } from '../../config/resolveLinea';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' } as Intl.NumberFormatOptions);

const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface Props {
  area: Area;
  /** Fase D: separa DJ de Real Madrid dentro de `area='dj'`. Cuando vale
   *  'real_madrid', el inventario de equipo también se filtra por
   *  `equipo.area==='real_madrid'` (esa tabla ya distingue Real Madrid a
   *  nivel de columna, sin necesitar `resolveLinea`). */
  filterLinea?: LineaId;
  tituloLinea?: string;
}

export const InformesPage = ({ area, filterLinea }: Props) => {
  const { categories } = useExpenseCategories();
  const allIngresos     = useStore((s) => s.ingresos);
  const allGastos       = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const ingresos     = useMemo(
    () => allIngresos.filter((i) => i.area === area && (!filterLinea || resolveLinea({ id: i.id, area: i.area, tipoEvento: i.tipoEvento, lineaNegocio: i.lineaNegocio }) === filterLinea)),
    [allIngresos, area, filterLinea],
  );
  const gastos       = useMemo(() => allGastos.filter((g) => {
    if (g.area !== area) return false;
    if (filterLinea) return resolveLinea(g) === filterLinea;
    return true;
  }), [allGastos, area, filterLinea]);
  const ingresoIds   = useMemo(() => new Set(ingresos.map((i) => i.id)), [ingresos]);
  const gastosEvento = useMemo(
    () => allGastosEvento.filter((g) => g.area === area && (!filterLinea || ingresoIds.has(g.ingresoId))),
    [allGastosEvento, area, filterLinea, ingresoIds],
  );

  const [year, setYear] = useState(new Date().getFullYear());

  const gastosAnio = useMemo(
    () => gastos.filter((g) => new Date(g.fecha).getFullYear() === year),
    [gastos, year],
  );
  const gastosEventoAnio = useMemo(
    () => gastosEvento.filter((g) => new Date(g.fecha).getFullYear() === year),
    [gastosEvento, year],
  );
  const ingresosAnio = useMemo(
    () => ingresos.filter((i) => new Date(i.fechaEvento).getFullYear() === year),
    [ingresos, year],
  );

  // ── Gauge: margen operativo real del año — ingresos y gastos SIN IVA ────────
  const ingresosOperativosAnio = useMemo(() => ingresosAnio.reduce((s, i) => s + i.baseImponible, 0), [ingresosAnio]);

  const porCategoriaGenerales = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    gastosAnio.forEach((g) => {
      const cur = map.get(g.categoria) ?? { count: 0, total: 0 };
      map.set(g.categoria, { count: cur.count + 1, total: cur.total + g.baseImponible });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [gastosAnio]);

  const porCategoriaEvento = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    gastosEventoAnio.forEach((g) => {
      const cur = map.get(g.categoria) ?? { count: 0, total: 0 };
      map.set(g.categoria, { count: cur.count + 1, total: cur.total + gastoEventoSinIVA(g) });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [gastosEventoAnio]);

  // Dataset combinado (generales + evento) para el Bar Chart de Bklit.
  const gastosPorCategoriaChart = useMemo(() => {
    const map = new Map<string, number>();
    porCategoriaGenerales.forEach(([cat, d]) => map.set(cat, (map.get(cat) ?? 0) + d.total));
    porCategoriaEvento.forEach(([cat, d]) => map.set(cat, (map.get(cat) ?? 0) + d.total));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([categoria, total]) => ({ categoria, total }));
  }, [porCategoriaGenerales, porCategoriaEvento]);

  const yearOpts = useMemo(() => {
    const years = new Set<number>();
    [...ingresos, ...gastos].forEach((x) => years.add(new Date('fecha' in x ? x.fecha : x.fechaEvento).getFullYear()));
    if (!years.size) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [ingresos, gastos]);

  const monthly = useMemo(() => {
    return MESES_FULL.map((mes, m) => {
      const ingMes = ingresos.filter((i) => {
        const d = new Date(i.fechaEvento); return d.getFullYear() === year && d.getMonth() === m;
      });
      const gasMes = gastos.filter((g) => {
        const d = new Date(g.fecha); return d.getFullYear() === year && d.getMonth() === m;
      });
      const gesEvMes = gastosEvento.filter((g) => {
        const d = new Date(g.fecha); return d.getFullYear() === year && d.getMonth() === m;
      });

      const totalIng    = ingMes.reduce((a, i) => a + i.total, 0);
      const baseImp     = ingMes.reduce((a, i) => a + i.baseImponible, 0);
      const totalGas    = gasMes.reduce((a, g) => a + g.total, 0);
      const costesEv    = gesEvMes.reduce((a, g) => a + g.importe, 0);
      const beneficio   = baseImp - costesEv;
      const cobrado     = ingMes.filter((i) => i.estadoPago === 'pagado').reduce((a, i) => a + i.total, 0);

      return { mes, totalIng, baseImp, totalGas, costesEv, beneficio, cobrado, numEv: ingMes.length };
    });
  }, [ingresos, gastos, gastosEvento, year]);


  const exportCSV = () => {
    const header = 'Mes;Ingresos;Total sin IVA;Gastos;Costes Evento;Beneficio Real;Cobrado;Nº Eventos';
    const rows = monthly.map((m) =>
      [m.mes, m.totalIng.toFixed(2), m.baseImp.toFixed(2), m.totalGas.toFixed(2),
       m.costesEv.toFixed(2), m.beneficio.toFixed(2), m.cobrado.toFixed(2), m.numEv].join(';')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `informe-${area}-${year}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const costeEvento = (ids: Set<string>) => gastosEvento.filter((g) => ids.has(g.ingresoId)).reduce((a, g) => a + gastoEventoSinIVA(g), 0);
  const idsAnio = new Set(ingresosAnio.map((i) => i.id));
  const costesEventoAnio = costeEvento(idsAnio);
  const generalesAnio = gastosAnio.reduce((a, g) => a + g.baseImponible, 0);
  const beneficioAnio = ingresosOperativosAnio - generalesAnio - costesEventoAnio;
  const mesesChart = MESES_FULL.map((_, m) => {
    const ing = ingresosAnio.filter((i) => new Date(i.fechaEvento).getMonth() === m);
    const base = ing.reduce((a, i) => a + i.baseImponible, 0);
    const gas = costeEvento(new Set(ing.map((i) => i.id))) + gastosAnio.filter((g) => new Date(g.fecha).getMonth() === m).reduce((a, g) => a + g.baseImponible, 0);
    const gastoVisible = Math.min(gas, base);
    return { gastos: gastoVisible, beneficio: Math.max(0, base - gastoVisible) };
  });
  const categorias = gastosPorCategoriaChart.slice(0, 7);
  const maxCat = Math.max(1, ...categorias.map((c) => c.total));
  const mejores = ingresosAnio
    .map((i) => ({ i, r: ingresoRentabilidad(i, gastosEvento) }))
    .sort((x, y) => y.r.beneficio - x.r.beneficio)
    .slice(0, 5);

  return (
    <div>
      <PageHeader title="Informes">
        <YearStepper year={year} years={yearOpts} onChange={setYear} />
        <Btn variant="secondary" onClick={exportCSV}><Download size={15} />Exportar</Btn>
      </PageHeader>

      <div className="bento">
        <Metric label="Ingresos sin IVA" value={ingresosOperativosAnio} />
        <Metric label="Gastos sin IVA" value={generalesAnio + costesEventoAnio} delay={0.03} />
        <Metric label="Beneficio" value={beneficioAnio} delay={0.06} tone={beneficioAnio >= 0 ? 'positive' : 'negative'} />
        <Metric label="Margen" value={ingresosOperativosAnio ? Math.round((beneficioAnio / ingresosOperativosAnio) * 100) : 0} kind="percent" delay={0.09} />

        <Widget className="span-full" title="Cómo se reparte cada mes" delay={0.12}>
          <MonthlyBars year={year} data={mesesChart} showTotals={false} series={[
            { key: 'gastos', label: 'Gastos', color: 'color-mix(in srgb, var(--tint-b) 32%, #fff)' },
            { key: 'beneficio', label: 'Beneficio', color: 'var(--tint-a)' },
          ]} />
        </Widget>

        <Widget className="span-2" title="Gastos por categoría" delay={0.15}>
          {categorias.length === 0 ? <p className="text-ink-3 text-[14px]">Sin gastos en {year}.</p> : (
            <div className="space-y-3">
              {categorias.map((c) => (
                <div key={c.categoria}>
                  <div className="flex justify-between text-[14px] mb-1.5"><span className="font-medium">{c.categoria}</span><b className="num">{fmt(c.total)}</b></div>
                  <div className="h-2 rounded-full bg-black/[.05] overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: categoryColor(c.categoria, categories) }}
                      initial={{ width: 0 }} animate={{ width: `${(c.total / maxCat) * 100}%` }} transition={{ type: 'spring', bounce: 0, duration: 0.8 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Widget>

        <Widget className="span-2" title="Eventos más rentables" delay={0.18}>
          {mejores.length === 0 ? <p className="text-ink-3 text-[14px]">Sin eventos en {year}.</p> : (
            <div className="-mx-2">
              {mejores.map(({ i, r }, idx) => (
                <div key={i.id} className="flex items-center gap-3 px-2 py-2">
                  <span className="num w-5 text-center text-[13px] font-semibold text-ink-3">{idx + 1}</span>
                  <span className="flex-1 min-w-0"><b className="block text-[14.5px] truncate">{i.concepto}</b><small className="text-[12.5px] text-ink-3">{i.fechaEvento}</small></span>
                  <span className="text-right"><b className="num text-[14.5px] text-[#1f9d55]">{fmt(r.beneficio)}</b><small className="block text-[12px] text-ink-3 num">{r.margen == null ? '' : `${Math.round(r.margen)} %`}</small></span>
                </div>
              ))}
            </div>
          )}
        </Widget>
      </div>
    </div>
  );
};
