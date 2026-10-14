import type { Factura } from '../types';
import { joinDriveExpenses, type DriveExpenseFile, type DriveExpenseAmount } from './driveExpenses';
export type AccountingFile = DriveExpenseFile & { tipo: 'emitida' | 'recibida'; numero: number | string | null };
export type AccountingRow = AccountingFile & { base: number | null; iva: number | null; estado: 'leido' | 'pendiente' | 'excluido' };
/** The Drive catalogue is the inclusion boundary. Never infer amounts from event income. */
export function driveAccounting(files: AccountingFile[], amounts: DriveExpenseAmount[], invoices: Factura[]): AccountingRow[] {
  const expenses = new Map(joinDriveExpenses(files.filter(f => f.tipo === 'recibida'), amounts).map(f => [f.id, f]));
  const seen = new Set<string>();
  return files.map(f => {
    if (f.tipo === 'recibida') {
      const r = expenses.get(f.id)!;
      return { ...f, base: r.estado === 'leido' ? r.amount!.base : null, iva: r.estado === 'leido' ? r.amount!.iva : null, estado: r.estado };
    }
    // Only a direct file association identifies the actual document; number alone is not enough.
    const matches = invoices.filter(i => i.tipo === 'emitida' && i.driveFileId === f.id && i.estado !== 'borrador' && i.estado !== 'anulada' && !i.ocultaEn);
    const i = matches.length === 1 ? matches[0] : undefined;
    if (!i || !Number.isFinite(i.baseImponible) || !Number.isFinite(i.importeIVA)) return { ...f, base: null, iva: null, estado: 'pendiente' };
    if (seen.has(f.id)) return { ...f, base: null, iva: null, estado: 'excluido' };
    seen.add(f.id);
    return { ...f, base: i.baseImponible, iva: i.importeIVA, estado: 'leido' };
  });
}
export function accountingTotals(rows: AccountingRow[]) {
  const sum = (tipo: AccountingFile['tipo'], key: 'base' | 'iva') => rows.filter(r => r.tipo === tipo && r.estado === 'leido').reduce((n,r) => n + Math.round(r[key]! * 100), 0) / 100;
  const income = sum('emitida', 'base'), outputVat = sum('emitida', 'iva');
  const expenses = sum('recibida', 'base'), inputVat = sum('recibida', 'iva');
  return { income, outputVat, expenses, inputVat, incomeTotal: Math.round((income + outputVat)*100)/100, expenseTotal: Math.round((expenses + inputVat)*100)/100, result: Math.round((income-expenses)*100)/100, vat: Math.round((outputVat-inputVat)*100)/100, pending: rows.filter(r => r.estado === 'pendiente').length };
}
