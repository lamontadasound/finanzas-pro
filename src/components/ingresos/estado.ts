import type { PaymentStatus } from '../../types';
import type { Tone } from '../kit';

export const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const ESTADO_LABEL: Record<PaymentStatus, string> = {
  presupuesto: 'Presupuesto', pendiente: 'Pendiente', parcial: 'Parcial', pagado: 'Cobrado', cancelado: 'Cancelado',
};
export const ESTADO_TONE: Record<PaymentStatus, Tone> = {
  presupuesto: 'neutral', pendiente: 'negative', parcial: 'warning', pagado: 'positive', cancelado: 'neutral',
};

