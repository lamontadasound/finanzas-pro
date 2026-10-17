import { useMemo, useState } from 'react';

import { useStore } from '../../store/useStore';
import { getAvailableYears } from '../../utils/helpers';
import { resolveLinea } from '../../config/resolveLinea';
import { useLineaFinance } from '../../hooks/useLineaFinance';
import { LineaResumenView } from '../../components/lineas/LineaResumenView';


// Resumen de la línea "DJ" — reutiliza useLineaFinance + LineaResumenView
// (mismos componentes que Real Madrid). area='dj' + resolveLinea==='dj'
// excluye explícitamente los partidos de Real Madrid, que comparten la
// misma tabla hoy.
export const DjResumen = () => {
  const allIngresos = useStore((s) => s.ingresos);
  const allGastos = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);

  const djIngresosTotal = useMemo(
    () => allIngresos.filter((i) => i.area === 'dj' && resolveLinea({ id: i.id, area: i.area, tipoEvento: i.tipoEvento, lineaNegocio: i.lineaNegocio }) === 'dj'),
    [allIngresos],
  );
  const djGastosTotal = useMemo(() => allGastos.filter((g) => g.area === 'dj' && resolveLinea(g) === 'dj'), [allGastos]);

  const allYears = useMemo(() => getAvailableYears([...djIngresosTotal, ...djGastosTotal]), [djIngresosTotal, djGastosTotal]);
  const [year, setYear] = useState(new Date().getFullYear());

  const ingresosAnio = useMemo(() => djIngresosTotal.filter((i) => new Date(i.fechaEvento).getFullYear() === year), [djIngresosTotal, year]);
  const gastosAnio = useMemo(() => djGastosTotal.filter((g) => new Date(g.fecha).getFullYear() === year), [djGastosTotal, year]);
  const ingresoIds = useMemo(() => new Set(ingresosAnio.map((i) => i.id)), [ingresosAnio]);
  const gastosEventoAnio = useMemo(() => allGastosEvento.filter((g) => g.area === 'dj' && ingresoIds.has(g.ingresoId)), [allGastosEvento, ingresoIds]);

  const calc = useLineaFinance(ingresosAnio, gastosAnio, gastosEventoAnio);

  const monthlyData=Array.from({length:12},(_,month)=>{const rows=ingresosAnio.filter(i=>new Date(i.fechaEvento).getMonth()===month);return {cobrado:rows.reduce((n,i)=>n+(i.estadoPago==='pagado'?i.total:i.pagosRecibidos),0),pendiente:rows.reduce((n,i)=>n+(i.estadoPago==='pagado'?0:Math.max(0,i.total-i.pagosRecibidos)),0)};});
  const ivaRecuperado=gastosAnio.reduce((n,g)=>n+(g.importeIVA??0),0)+gastosEventoAnio.reduce((n,g)=>n+(g.importeIVA??0),0);
  return (
    <LineaResumenView
      year={year} allYears={[...allYears,new Date().getFullYear()]} onYearChange={setYear} finance={calc} months={monthlyData} ivaRecuperado={ivaRecuperado} eventLabel="Actuaciones"
    />
  );
};
