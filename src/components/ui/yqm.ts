// Tipos y helpers puros de navegación Año/Trimestre/Mes — separados del
// componente YearQuarterMonthNav.tsx para no romper Fast Refresh (un
// archivo de componente solo puede exportar componentes).

export interface DateValued { fecha: string; total: number }

export interface YQMValue { year: number | null; trimestre: number | null; month: number | null }

export const trimestreDeMes = (m: number) => Math.floor(m / 3);

export const matchesYQM = (fecha: string, v: YQMValue) => {
  const d = new Date(fecha);
  if (v.year != null && d.getFullYear() !== v.year) return false;
  if (v.trimestre != null && trimestreDeMes(d.getMonth()) !== v.trimestre) return false;
  if (v.month != null && d.getMonth() !== v.month) return false;
  return true;
};
