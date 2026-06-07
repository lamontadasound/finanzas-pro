import type { Evento, Ingreso, Gasto, Suplido, Factura, Equipo } from '../types';

/*
 * Base de datos inicial vacía — lista para uso real en producción.
 * Acceso: juliacenteno10@gmail.com / definido en .env.local
 */
export const seedData: {
  eventos: Evento[];
  ingresos: Ingreso[];
  gastos: Gasto[];
  suplidos: Suplido[];
  facturas: Factura[];
  equipo: Equipo[];
} = {
  eventos:  [],
  ingresos: [],
  gastos:   [],
  suplidos: [],
  facturas: [],
  equipo:   [],
};
