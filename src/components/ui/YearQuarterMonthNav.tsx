import { Folder, ChevronLeft } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TRIMESTRES = ['T1 (Ene–Mar)', 'T2 (Abr–Jun)', 'T3 (Jul–Sep)', 'T4 (Oct–Dic)'];

export interface DateValued { fecha: string; total: number }

export interface YQMValue { year: number | null; trimestre: number | null; month: number | null }

interface Props {
  items: DateValued[];
  value: YQMValue;
  onChange: (v: YQMValue) => void;
}

const trimestreDeMes = (m: number) => Math.floor(m / 3);
const mesesDelTrimestre = (t: number) => [t * 3, t * 3 + 1, t * 3 + 2];

export const YearQuarterMonthNav = ({ items, value, onChange }: Props) => {
  const { year, trimestre, month } = value;

  const anios = (() => {
    const map = new Map<number, { count: number; total: number }>();
    items.forEach((i) => {
      const y = new Date(i.fecha).getFullYear();
      const cur = map.get(y) ?? { count: 0, total: 0 };
      map.set(y, { count: cur.count + 1, total: cur.total + i.total });
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  })();

  const trimestresDelAnio = (() => {
    if (year == null) return [];
    const map = new Map<number, { count: number; total: number }>();
    items.filter((i) => new Date(i.fecha).getFullYear() === year).forEach((i) => {
      const t = trimestreDeMes(new Date(i.fecha).getMonth());
      const cur = map.get(t) ?? { count: 0, total: 0 };
      map.set(t, { count: cur.count + 1, total: cur.total + i.total });
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  })();

  const mesesDelTrimestreData = (() => {
    if (year == null || trimestre == null) return [];
    const map = new Map<number, { count: number; total: number }>();
    items.filter((i) => {
      const d = new Date(i.fecha);
      return d.getFullYear() === year && trimestreDeMes(d.getMonth()) === trimestre;
    }).forEach((i) => {
      const m = new Date(i.fecha).getMonth();
      const cur = map.get(m) ?? { count: 0, total: 0 };
      map.set(m, { count: cur.count + 1, total: cur.total + i.total });
    });
    return mesesDelTrimestre(trimestre)
      .map((m) => [m, map.get(m) ?? { count: 0, total: 0 }] as const)
      .filter(([, data]) => data.count > 0);
  })();

  const totalAnio = year == null ? 0 : items.filter((i) => new Date(i.fecha).getFullYear() === year).reduce((a, i) => a + i.total, 0);
  const totalTrimestre = (year == null || trimestre == null) ? 0 : items.filter((i) => {
    const d = new Date(i.fecha);
    return d.getFullYear() === year && trimestreDeMes(d.getMonth()) === trimestre;
  }).reduce((a, i) => a + i.total, 0);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => onChange({ year: null, trimestre: null, month: null })} className={`font-medium ${year == null ? 'text-gray-900' : 'text-amber-600 hover:text-amber-500'}`}>Años</button>
        {year != null && (
          <>
            <span className="text-gray-300">/</span>
            <button onClick={() => onChange({ year, trimestre: null, month: null })} className={`font-medium ${trimestre == null ? 'text-gray-900' : 'text-amber-600 hover:text-amber-500'}`}>{year}</button>
          </>
        )}
        {year != null && trimestre != null && (
          <>
            <span className="text-gray-300">/</span>
            <button onClick={() => onChange({ year, trimestre, month: null })} className={`font-medium ${month == null ? 'text-gray-900' : 'text-amber-600 hover:text-amber-500'}`}>{TRIMESTRES[trimestre].slice(0, 2)}</button>
          </>
        )}
        {year != null && trimestre != null && month != null && (
          <>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-900">{MESES_FULL[month]}</span>
          </>
        )}
      </div>

      {/* Nivel 1: Años */}
      {year == null && (
        anios.length === 0 ? (
          <p className="text-center py-10 text-gray-400 text-sm">Sin registros todavía</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {anios.map(([y, data]) => (
              <button key={y} onClick={() => onChange({ year: y, trimestre: null, month: null })} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                <div className="flex items-center gap-2 mb-2"><Folder size={16} className="text-amber-500" /><span className="text-lg font-bold text-gray-900">{y}</span></div>
                <p className="text-xs text-gray-500">{data.count} registros</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
              </button>
            ))}
          </div>
        )
      )}

      {/* Nivel 2: Trimestres */}
      {year != null && trimestre == null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => onChange({ year: null, trimestre: null, month: null })} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a años</button>
            <p className="text-sm text-gray-600">Total {year}: <span className="font-semibold text-gray-900">{fmt(totalAnio)}</span></p>
          </div>
          {trimestresDelAnio.length === 0 ? (
            <p className="text-center py-10 text-gray-400 text-sm">Sin registros en {year}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {trimestresDelAnio.map(([t, data]) => (
                <button key={t} onClick={() => onChange({ year, trimestre: t, month: null })} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-2 mb-2"><Folder size={16} className="text-amber-500" /><span className="font-bold text-gray-900">{TRIMESTRES[t]}</span></div>
                  <p className="text-xs text-gray-500">{data.count} registros</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nivel 3: Meses */}
      {year != null && trimestre != null && month == null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => onChange({ year, trimestre: null, month: null })} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a trimestres</button>
            <p className="text-sm text-gray-600">Total {TRIMESTRES[trimestre]}: <span className="font-semibold text-gray-900">{fmt(totalTrimestre)}</span></p>
          </div>
          {mesesDelTrimestreData.length === 0 ? (
            <p className="text-center py-10 text-gray-400 text-sm">Sin registros en este trimestre</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {mesesDelTrimestreData.map(([m, data]) => (
                <button key={m} onClick={() => onChange({ year, trimestre, month: m })} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-2 mb-2"><Folder size={16} className="text-amber-500" /><span className="font-bold text-gray-900">{MESES_FULL[m]}</span></div>
                  <p className="text-xs text-gray-500">{data.count} registros</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Volver desde nivel 4 (mes seleccionado) */}
      {year != null && trimestre != null && month != null && (
        <button onClick={() => onChange({ year, trimestre, month: null })} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a meses</button>
      )}
    </div>
  );
};

export const matchesYQM = (fecha: string, v: YQMValue) => {
  const d = new Date(fecha);
  if (v.year != null && d.getFullYear() !== v.year) return false;
  if (v.trimestre != null && trimestreDeMes(d.getMonth()) !== v.trimestre) return false;
  if (v.month != null && d.getMonth() !== v.month) return false;
  return true;
};
