import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utilidad estándar exigida por los componentes del registro shadcn/Bklit
// (cn = clsx + tailwind-merge). No sustituye a clsx() usado en el resto de
// la app — convive con él, es solo lo que los componentes de Bklit esperan
// encontrar en "@/lib/utils".
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
