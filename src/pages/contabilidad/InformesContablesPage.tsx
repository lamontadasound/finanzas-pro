import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Area } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
type Rango = 'mes' | 'trimestre' | 'año';
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const InformesContablesPage = () => {
  const allFacturas = useStore((s) => s.facturas);
  const allEquipo    = useStore((s) => s.equipo);

  const [rango, setRango] = useState<Rango>('año');
  const [year, setYear] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth());
  const [trimestre, setTrimestre] = useState(Math.floor(new Date().getMonth() / 3));
  const [filterArea, setFilterArea] = useState<Area | 'todos'>('todos');

  const inRange = (fecha: string) => {
    const d = new Date(fecha);
    if (rango === 'mes') return d.getFullYear() === year && d.getMonth() === mes;
    if (rango === 'trimestre') return d.getFullYear() === year && Math.floor(d.getMonth() / 3) === trimestre;
    return d.getFullYear() === year;
  };

  const facturas = useMemo(() => {
    let list = allFacturas.filter((f) => inRange(f.fecha));
    if (filterArea !== 'todos') list = list.filter((f) => f.area === filterArea);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFacturas, rango, year, mes, trimestre, filterArea]);

  const equipo = useMemo(() => filterArea === 'todos' ? allEquipo : allEquipo.filter((e) => e.area === filterArea), [allEquipo, filterArea]);

  const emitidas  = facturas.filter((f) => f.tipo === 'emitida');
  const recibidas = facturas.filter((f) => f.tipo === 'recibida');
  const totalFacturadoIngresos = emitidas.reduce((a, f) => a + f.total, 0);
  const totalFacturadoGastos   = recibidas.reduce((a, f) => a + f.total, 0);
  const ivaRepercutido = emitidas.reduce((a, f) => a + f.importeIVA, 0);
  const ivaSoportado    = recibidas.filter((f) => f.ivaDeducible).reduce((a, f) => a + f.importeIVA, 0);
  const diferenciaIva   = ivaRepercutido - ivaSoportado;
  const facturasPendientes = facturas.filter((f) => !f.pagada).length;
  const facturasCobradas   = emitidas.filter((f) => f.pagada).length;
  const facturasPagadas    = recibidas.filter((f) => f.pagada).length;

  const amortizacionTotal = equipo.reduce((a, e) => a + ((e.vidaUtil && e.vidaUtil > 0) ? e.baseImponible / e.vidaUtil : 0), 0);
  const inversionTotal = equipo.reduce((a, e) => a + e.total, 0);

  const exportCSV = () => {
    const header = 'Concepto;Importe';
    const rows = [
      `Total facturado ingresos;${totalFacturadoIngresos.toFixed(2)}`,
      `Total facturado gastos;${totalFacturadoGastos.toFixed(2)}`,
      `IVA repercutido;${ivaRepercutido.toFixed(2)}`,
      `IVA soportado;${ivaSoportado.toFixed(2)}`,
      `Diferencia IVA;${diferenciaIva.toFixed(2)}`,
      `Facturas pendientes;${facturasPendientes}`,
      `Facturas cobradas;${facturasCobradas}`,
      `Facturas pagadas;${facturasPagadas}`,
      `Inversión total;${inversionTotal.toFixed(2)}`,
      `Amortización anual estimada;${amortizacionTotal.toFixed(2)}`,
    ];
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `informe-contable-${year}.csv` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Informes contables</h1>
          <p className="text-sm text-gray-500">IVA, facturación e inversiones — La Montada Sound + DJs</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors">
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {(['mes', 'trimestre', 'año'] as Rango[]).map((r) => (
          <button key={r} onClick={() => setRango(r)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${rango === r ? 'bg-amber-500 text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>{r}</button>
        ))}
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((v) => v - 1)} className="px-2 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">‹</button>
          <span className="text-sm font-semibold text-gray-700 w-12 text-center">{year}</span>
          <button onClick={() => setYear((v) => v + 1)} className="px-2 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">›</button>
        </div>
        {rango === 'mes' && (
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white">
            {MESES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        )}
        {rango === 'trimestre' && (
          <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))} className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white">
            <option value={0}>Q1</option><option value={1}>Q2</option><option value={2}>Q3</option><option value={3}>Q4</option>
          </select>
        )}
        <select value={filterArea} onChange={(e) => setFilterArea(e.target.value as Area | 'todos')} className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white">
          <option value="todos">Ambas áreas</option>
          <option value="montada">La Montada Sound</option>
          <option value="dj">DJs</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5"><p className="text-xs text-gray-500 uppercase">Facturado ingresos</p><p className="text-xl font-bold text-gray-900">{fmt(totalFacturadoIngresos)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5"><p className="text-xs text-gray-500 uppercase">Facturado gastos</p><p className="text-xl font-bold text-gray-900">{fmt(totalFacturadoGastos)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5"><p className="text-xs text-gray-500 uppercase">IVA repercutido</p><p className="text-xl font-bold text-gray-900">{fmt(ivaRepercutido)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5"><p className="text-xs text-gray-500 uppercase">IVA soportado</p><p className="text-xl font-bold text-gray-900">{fmt(ivaSoportado)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5"><p className="text-xs text-gray-500 uppercase">Diferencia IVA</p><p className={`text-xl font-bold ${diferenciaIva >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(diferenciaIva)}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5"><p className="text-xs text-gray-500 uppercase">Facturas pendientes</p><p className="text-xl font-bold text-gray-900">{facturasPendientes}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5"><p className="text-xs text-gray-500 uppercase">Facturas cobradas</p><p className="text-xl font-bold text-gray-900">{facturasCobradas}</p></div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5"><p className="text-xs text-gray-500 uppercase">Facturas pagadas</p><p className="text-xl font-bold text-gray-900">{facturasPagadas}</p></div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Inversiones y amortización (orientativa)</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-gray-500">Inversión total registrada</p><p className="font-semibold text-gray-800">{fmt(inversionTotal)}</p></div>
          <div><p className="text-xs text-gray-500">Amortización anual estimada</p><p className="font-semibold text-gray-800">{fmt(amortizacionTotal)}</p></div>
        </div>
      </div>
    </div>
  );
};
