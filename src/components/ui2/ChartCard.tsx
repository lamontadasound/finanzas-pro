import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { ContentCard2 } from './ContentCard';

const GRID = '#eef0f2';

interface SeriesPoint { label: string; [key: string]: number | string }

interface AreaChartCardProps {
  title: string;
  description?: string;
  data: SeriesPoint[];
  series: { key: string; color: string; name: string }[];
  formatValue?: (n: number) => string;
}

// Gráfico de área al estilo Bklit/Motoko: grid punteado, ejes discretos,
// degradado sutil bajo la línea, tooltip con tarjeta blanca redondeada.
export const AreaChartCard2 = ({ title, description, data, series, formatValue }: AreaChartCardProps) => (
  <ContentCard2 title={title} description={description} padding="none">
    <div className="px-2 pb-4 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 5" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={44}
            tickFormatter={(v) => formatValue ? formatValue(v).replace(/\s?€/, '') : String(v)} />
          <Tooltip
            formatter={(v, name) => [formatValue && typeof v === 'number' ? formatValue(v) : String(v ?? ''), String(name)]}
            contentStyle={{ borderRadius: 16, border: '1px solid #f0f0f0', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12)', fontSize: 12 }}
          />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2}
              fill={`url(#grad-${s.key})`} activeDot={{ r: 4 }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </ContentCard2>
);

interface RingChartCardProps {
  title: string;
  description?: string;
  data: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerValue: string;
}

// Donut con leyenda de puntos de color — patrón visto en Motoko /analytics.
export const RingChartCard2 = ({ title, description, data, centerLabel, centerValue }: RingChartCardProps) => (
  <ContentCard2 title={title} description={description}>
    <div className="flex items-center gap-6">
      <div className="relative w-36 h-36 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={48} outerRadius={64} paddingAngle={3} stroke="none">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-lg font-bold text-gray-900">{centerValue}</p>
          <p className="text-[10px] text-gray-400">{centerLabel}</p>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 min-w-0">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-gray-600 truncate">{d.label}</span>
            </span>
            <span className="font-semibold text-gray-900 flex-shrink-0">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  </ContentCard2>
);

