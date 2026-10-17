import { useMemo, useState } from 'react';

import { useStore } from '../../store/useStore';
import { getAvailableYears } from '../../utils/helpers';
import { resolveLinea, isAmbiguousRealMadrid } from '../../config/resolveLinea';
import { useLineaFinance } from '../../hooks/useLineaFinance';
import { LineaResumenView } from '../../components/lineas/LineaResumenView';

import {Widget as ContentCard2,Metric} from '../../components/kit';
import { AlertTriangle } from 'lucide-react';

// Resumen de la línea "Real Madrid" — misma arquitectura reutilizable que
// DJ (useLineaFinance + LineaResumenView), añadiendo Inversiones y Flujo de
// caja después de inversiones (equipo.area='real_madrid', ya separado a
// nivel de columna desde antes de esta fase).
export const RealMadridResumen = () => {
  const allIngresos = useStore((s) => s.ingresos);
  const allGastos = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const allEquipo = useStore((s) => s.equipo);

  const rmIngresosTotal = useMemo(
    () => allIngresos.filter((i) => resolveLinea({ id: i.id, area: i.area, tipoEvento: i.tipoEvento, lineaNegocio: i.lineaNegocio }) === 'real_madrid'),
    [allIngresos],
  );
  const rmGastosTotal = useMemo(() => allGastos.filter((g) => g.area === 'dj' && resolveLinea(g) === 'real_madrid'), [allGastos]);
  const rmEquipoTotal = useMemo(() => allEquipo.filter((e) => e.area === 'real_madrid'), [allEquipo]);
  const ambiguos = useMemo(() => allIngresos.filter((i) => isAmbiguousRealMadrid(i)), [allIngresos]);

  const allYears = useMemo(() => getAvailableYears([...rmIngresosTotal, ...rmGastosTotal]), [rmIngresosTotal, rmGastosTotal]);
  const [year, setYear] = useState(new Date().getFullYear());

  const ingresosAnio = useMemo(() => rmIngresosTotal.filter((i) => new Date(i.fechaEvento).getFullYear() === year), [rmIngresosTotal, year]);
  const gastosAnio = useMemo(() => rmGastosTotal.filter((g) => new Date(g.fecha).getFullYear() === year), [rmGastosTotal, year]);
  const ingresoIds = useMemo(() => new Set(ingresosAnio.map((i) => i.id)), [ingresosAnio]);
  const gastosEventoAnio = useMemo(() => allGastosEvento.filter((g) => ingresoIds.has(g.ingresoId)), [allGastosEvento, ingresoIds]);
  const equipoAnio = useMemo(() => rmEquipoTotal.filter((e) => new Date(e.fechaCompra).getFullYear() === year), [rmEquipoTotal, year]);

  const calc = useLineaFinance(ingresosAnio, gastosAnio, gastosEventoAnio, equipoAnio);

  const monthlyData=Array.from({length:12},(_,month)=>{const rows=ingresosAnio.filter(i=>new Date(i.fechaEvento).getMonth()===month);return {cobrado:rows.reduce((n,i)=>n+(i.estadoPago==='pagado'?i.total:i.pagosRecibidos),0),pendiente:rows.reduce((n,i)=>n+(i.estadoPago==='pagado'?0:Math.max(0,i.total-i.pagosRecibidos)),0)};});
  const ivaRecuperado=gastosAnio.reduce((n,g)=>n+(g.importeIVA??0),0)+gastosEventoAnio.reduce((n,g)=>n+(g.importeIVA??0),0);
  return (
    <LineaResumenView
      year={year} allYears={[...allYears,new Date().getFullYear()]} onYearChange={setYear} finance={calc} months={monthlyData} ivaRecuperado={ivaRecuperado} eventLabel="Partidos / servicios"
    >
<div className="grid sm:grid-cols-2 gap-3 mt-4"><Metric label="Inversión del año" value={calc.inversiones}/><Metric label="Flujo tras inversión" value={calc.flujoCajaTrasInversiones}/></div>
      {ambiguos.length > 0 && (
        <ContentCard2 title="Casos a revisar">
          <div className="flex items-start gap-3 mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl p-3">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <p>Revisa estos registros y confírmame si pertenecen a Real Madrid.</p>
          </div>
          <ul className="divide-y divide-gray-50">
            {ambiguos.map((i) => (
              <li key={i.id} className="py-2 text-sm text-gray-600">{i.concepto} · {i.cliente} · {i.fechaEvento} <span className="text-gray-400">(tipo: {i.tipoEvento})</span></li>
            ))}
          </ul>
        </ContentCard2>
      )}
    </LineaResumenView>
  );
};
