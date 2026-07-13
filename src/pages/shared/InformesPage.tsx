import { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Area } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface Props { area: Area }

export const InformesPage = ({ area }: Props) => {
  const allIngresos     = useStore((s) => s.ingresos);
  const allGastos       = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const allEquipo       = useStore((s) => s.equipo);
  const ingresos     = useMemo(() => allIngresos.filter((i) => i.area === area), [allIngresos, area]);
  const gastos       = useMemo(() => allGastos.filter((g) => g.area === area), [allGastos, area]);
  const gastosEvento = useMemo(() => allGastosEvento.filter((g) => g.area === area), [allGastosEvento, area]);
  const equipo       = useMemo(() => allEquipo.filter((e) => e.area === area), [allEquipo, area]);

  const [year, setYear] = useState(new Date().getFullYear());

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

  const totals = monthly.reduce((acc, m) => ({
    totalIng:  acc.totalIng  + m.totalIng,
    baseImp:   acc.baseImp   + m.baseImp,
    totalGas:  acc.totalGas  + m.totalGas,
    costesEv:  acc.costesEv  + m.costesEv,
    beneficio: acc.beneficio + m.beneficio,
    cobrado:   acc.cobrado   + m.cobrado,
    numEv:     acc.numEv     + m.numEv,
  }), { totalIng: 0, baseImp: 0, totalGas: 0, costesEv: 0, beneficio: 0, cobrado: 0, numEv: 0 });

  const exportCSV = () => {
    const header = 'Mes;Ingresos;Base Imp.;Gastos;Costes Evento;Beneficio Real;Cobrado;Nº Eventos';
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

  const exportEquipoCSV = () => {
    const header = 'Nombre;Categoría;Fecha Compra;Proveedor;Base Imp.;IVA;Total';
    const rows = equipo.map((e) =>
      [e.nombre, e.categoria, e.fechaCompra, e.proveedor ?? '',
       e.baseImponible.toFixed(2), e.importeIVA.toFixed(2), e.total.toFixed(2)].join(';')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `equipo-${area}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Informes</h1>
          <p className="text-sm text-gray-500">Resumen anual y exportaciones</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors">
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Tabla mensual */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mes</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ingresos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Base imp.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Gastos gen.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Costes evento</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Beneficio real</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cobrado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Eventos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthly.map((m) => (
                <tr key={m.mes} className={`hover:bg-gray-50 ${m.numEv === 0 ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{m.mes}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(m.totalIng)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(m.baseImp)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{fmt(m.totalGas)}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-600">{fmt(m.costesEv)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${m.beneficio >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(m.beneficio)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(m.cobrado)}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{m.numEv || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3 text-xs uppercase text-gray-600">Total {year}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(totals.totalIng)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(totals.baseImp)}</td>
                <td className="px-4 py-3 text-right font-mono text-red-700">{fmt(totals.totalGas)}</td>
                <td className="px-4 py-3 text-right font-mono text-orange-700">{fmt(totals.costesEv)}</td>
                <td className={`px-4 py-3 text-right font-mono ${totals.beneficio >= 0 ? 'text-green-800' : 'text-red-700'}`}>{fmt(totals.beneficio)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(totals.cobrado)}</td>
                <td className="px-4 py-3 text-center text-gray-700">{totals.numEv}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Inventario equipo */}
      {equipo.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Inventario de equipo</h2>
            <button onClick={exportEquipoCSV} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <Download size={12} /> Exportar
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Nombre</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Categoría</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Fecha compra</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {equipo.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{e.nombre}</td>
                  <td className="px-4 py-2.5 text-gray-500">{e.categoria}</td>
                  <td className="px-4 py-2.5 text-gray-500">{e.fechaCompra}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(e.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
