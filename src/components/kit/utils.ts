/** Año por defecto: el actual si hay datos de él; si no, el más reciente ≤ actual. */
export const defaultYear = (years: number[]) => {
  const now = new Date().getFullYear();
  if (years.includes(now)) return now;
  const past = years.filter((y) => y <= now).sort((a, b) => b - a);
  return past[0] ?? years[0] ?? now;
};
