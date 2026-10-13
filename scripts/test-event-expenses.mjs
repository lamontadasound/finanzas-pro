import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const pg=new PGlite();
await pg.exec(`create table gastos_evento(id text primary key,ingreso_id text,area text,fecha text,concepto text,categoria text,importe numeric,observaciones text,created_at text,pagado_por text,linea_negocio text);insert into gastos_evento(id,importe) values('old',350);`);
const sql=await readFile('supabase/event_expense_fields.sql','utf8');await pg.exec(sql);await pg.exec(sql);
await pg.query(`insert into gastos_evento(id,ingreso_id,area,fecha,concepto,categoria,importe,observaciones,created_at,base_imponible,porcentaje_iva,importe_iva,total_con_iva,factura_recibida,numero_factura,estado_pago,proveedor,tipo,pagado_por,metodo_pago) values($1,$2,'montada','2026-09-12','Técnico','Técnico',350,null,'2026-09-12',null,null,null,null,false,null,'pagado',null,null,'La Montada','transferencia')`,['test','event-test']);
assert.equal((await pg.query("select metodo_pago from gastos_evento where ingreso_id='event-test'")).rows[0].metodo_pago,'transferencia');
await pg.exec("update gastos_evento set metodo_pago='bizum' where id='test'");assert.equal((await pg.query("select metodo_pago from gastos_evento where id='test'")).rows[0].metodo_pago,'bizum');
const old=(await pg.query("select importe,metodo_pago,estado_pago from gastos_evento where id='old'")).rows[0];assert.equal(Number(old.importe),350);assert.equal(old.metodo_pago,null);assert.equal(old.estado_pago,null);
console.log('PASS: same payload fields as event expense writer, insert, event link, payment reload, edit, migration twice, historical amount and unknown payment preserved');await pg.close();
