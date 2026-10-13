export type DriveExpenseFile = {id:string;nombre:string;anio:number;mes:number;url:string;actualizado_en:string|null;sincronizado_en:string};
export type DriveExpenseAmount = {file_id:string;source_modified_at:string|null;estado:'pendiente'|'leido'|'excluido';proveedor:string;numero_factura:string;fecha_factura:string|null;base:number|null;iva:number|null;total:number|null;retencion:number;nota:string;evidencia?:string};
export type DriveExpense = DriveExpenseFile & {amount?:DriveExpenseAmount;estado:'pendiente'|'leido'|'excluido';duplicate?:boolean};
export function joinDriveExpenses(files:DriveExpenseFile[], amounts:DriveExpenseAmount[]):DriveExpense[]{
 const byId=new Map(amounts.map(a=>[a.file_id,a]));const seen=new Set<string>();
 const rows:DriveExpense[] = [...files].sort((a,b)=>a.id.localeCompare(b.id)).map(f=>{
  const a=byId.get(f.id);const fresh=a&&((!a.source_modified_at&&!f.actualizado_en)||new Date(a.source_modified_at??'').getTime()===new Date(f.actualizado_en??'').getTime());
  const valid=fresh&&a.estado==='leido'&&[a.base,a.iva,a.total,a.retencion].every(n=>typeof n==='number'&&Number.isFinite(n))&&Math.abs(a.base!+a.iva!-a.retencion-a.total!)<=0.05;
  // Match supplier and invoice number, never file name or amount alone.
  const key=valid&&a.proveedor.trim()&&a.numero_factura.trim()?`${a.proveedor.trim().toLocaleUpperCase('es')}|${a.numero_factura.trim().toLocaleUpperCase('es')}`:'';
  const duplicate=!!key&&seen.has(key);if(key)seen.add(key);
  const estado=duplicate?'excluido':fresh&&a.estado==='excluido'?'excluido':valid?'leido':'pendiente';
  return {...f,amount:a,estado,duplicate} as DriveExpense;
 });
 const groups=new Map<string,DriveExpense[]>();
 for(const r of rows){const a=r.amount;if((r.estado==='leido'||r.duplicate)&&a?.proveedor.trim()&&a.numero_factura.trim()){const key=`${a.proveedor.trim().toLocaleUpperCase('es')}|${a.numero_factura.trim().toLocaleUpperCase('es')}`;groups.set(key,[...(groups.get(key)??[]),r]);}}
 for(const group of groups.values()){
  if(group.length<2)continue;const first=group[0].amount!;
  if(group.some(r=>r.amount!.base!==first.base||r.amount!.iva!==first.iva||r.amount!.total!==first.total||r.amount!.retencion!==first.retencion)){
   for(const r of group){r.estado='pendiente';r.duplicate=false;r.amount={...r.amount!,nota:'Mismo proveedor y número con importes distintos: revisar las versiones.'};}
  }
 }
 return rows;
}
export function driveExpenseTotals(rows:DriveExpense[]){
 const read=rows.filter(r=>r.estado==='leido');const cents=(key:'base'|'iva'|'total')=>read.reduce((s,r)=>s+Math.round(Number(r.amount?.[key])*100),0)/100;
 return {base:cents('base'),iva:cents('iva'),total:cents('total'),leidos:read.length,pendientes:rows.filter(r=>r.estado==='pendiente').length,excluidos:rows.filter(r=>r.estado==='excluido').length};
}
