import assert from 'node:assert/strict';
export async function scenarios(pg){
 const admin='f700fe77-98f4-4cda-8c75-2524e782afcd', restricted='11111111-1111-4111-8111-111111111111',reader='22222222-2222-4222-8222-222222222222';
 let count=0;
 const role=async(uid,dbRole='authenticated')=>{await pg.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${uid}',false); SET ROLE ${dbRole};`);};
 const scalar=async(sql)=>{const v=Object.values((await pg.query(sql)).rows[0])[0];return typeof v==='string'&&/^-?\d+(\.\d+)?$/.test(v)?Number(v):v;};
 const test=async(name,fn)=>{await fn();console.log('PASS',name);count++;};
 const denied=async(sql,code='42501')=>{let failed=false;try{await pg.exec(sql);}catch(e){failed=true;assert.equal(e.code,code,`${e.message} (${e.where??''})`);}assert.ok(failed,'Expected denial, operation succeeded');};
 await pg.exec(`INSERT INTO auth.users VALUES('${restricted}','restricted@example.test'),('${reader}','reader@example.test');
 INSERT INTO public.profiles(id,email,nombre,rol,activo) VALUES('${restricted}','restricted@example.test','Solo DJ','usuario',true),('${reader}','reader@example.test','Lector','usuario',true);
 INSERT INTO public.user_line_permissions VALUES('${restricted}','dj',true,true,true,false),('${reader}','dj',true,false,false,false);
 INSERT INTO public.user_facturacion_permissions(user_id,puede_emitir,puede_rectificar,puede_gestionar_numeracion) VALUES('${restricted}',true,true,true);
 INSERT INTO public.ingresos(id,area,concepto,cliente,tipo_evento,fecha_evento,base_imponible,porcentaje_iva,importe_iva,total,metodo_pago,created_at,linea_negocio)
 VALUES('income-dj','dj','Evento DJ','Cliente Test','Boda','2026-09-09',1000,21,210,1210,'transferencia','2026-09-09','dj'),('income-rm','dj','Partido','Cliente Test','Partido','2026-09-09',1000,21,210,1210,'transferencia','2026-09-09','real_madrid');
 INSERT INTO public.configuracion_fiscal(id,razon_social,nif_cif,direccion_fiscal) VALUES('issuer-dj','Emisor DJ','TEST1','Dirección de prueba'),('issuer-rm','Emisor RM','TEST2','Dirección de prueba');
 INSERT INTO public.proyecto_emisor(linea_id,emisor_id) VALUES('dj','issuer-dj'),('real_madrid','issuer-rm');
 INSERT INTO public.clientes(id,nombre,nif_cif,direccion) VALUES('client','Cliente Test','CLIENT1','Dirección cliente');
 INSERT INTO public.facturas(id,area,tipo,numero,cliente,concepto,fecha,ingreso_id,linea_negocio,estado)
 VALUES('invoice-dj','dj','emitida','','Cliente Test','Evento DJ','2026-09-09','income-dj','dj','borrador'),('invoice-rm','dj','emitida','','Cliente Test','Partido','2026-09-09','income-rm','real_madrid','borrador'),('invoice-dj2','dj','emitida','','Cliente Test','Evento DJ','2026-09-09','income-dj','dj','borrador');`);
 const issue=(id='invoice-dj',income='income-dj',pct=30)=>`SELECT * FROM public.emitir_numero_factura('${id}','dj','emitida','Cliente Test','Servicio',${pct*10},21,${pct*2.1},${pct*12.1},'2026-09-09','${income}',${pct},NULL)`;
 await test('anonymous cannot read finance',async()=>{await role('','anon');await denied('SELECT * FROM public.ingresos');});
 await test('restricted reads own line only',async()=>{await role(restricted);assert.equal(await scalar('SELECT count(*) FROM public.ingresos'),1);});
 await test('restricted cannot read other line',async()=>assert.equal(await scalar("SELECT count(*) FROM public.ingresos WHERE id='income-rm'"),0));
 await test('reader cannot insert',async()=>{await role(reader);await denied("INSERT INTO public.facturas(id,area,tipo,numero,cliente,concepto,fecha,linea_negocio,estado) VALUES('forbidden','dj','emitida','','Cliente Test','x','2026-09-09','dj','borrador')");});
 await test('restricted cannot move row to other line',async()=>{await role(restricted);await denied("UPDATE public.ingresos SET linea_negocio='real_madrid' WHERE id='income-dj'");});
 await test('restricted cannot delete',async()=>{await pg.exec("DELETE FROM public.ingresos WHERE id='income-dj'");assert.equal(await scalar("SELECT count(*) FROM public.ingresos WHERE id='income-dj'"),1);});
 await test('invoice RPC cannot steal parent from another invoice',async()=>await denied(issue('invoice-rm','income-dj')));
 await test('emission blocked until numbering confirmed',async()=>await denied(issue(),'P0001'));
 await role(admin);
 await pg.exec("SELECT public.fijar_numero_inicial_factura(1,'issuer-dj',''); SELECT public.fijar_numero_inicial_factura(1,'issuer-rm','');");
 await test('real emission generates number and snapshots',async()=>{await role(restricted);assert.equal((await pg.query(issue())).rows[0].numero_emitido,1);assert.equal(await scalar("SELECT emisor_snapshot->>'nif_cif' FROM public.facturas WHERE id='invoice-dj'"),'TEST1');});
 await test('retry returns same number and single log',async()=>{assert.equal((await pg.query(issue())).rows[0].numero_emitido,1);await role(admin);assert.equal(await scalar("SELECT count(*) FROM public.numeracion_log WHERE factura_id='invoice-dj'"),1);});
 await test('second issuer may also issue number 1',async()=>assert.equal((await pg.query(issue('invoice-rm','income-rm'))).rows[0].numero_emitido,1));
 await test('unauthorized idempotent lookup denied',async()=>{await role(restricted);await denied(issue('invoice-rm','income-rm'));});
 await test('issued invoice cannot be altered via direct API',async()=>await denied("UPDATE public.facturas SET porcentaje_facturado=0 WHERE id='invoice-dj'"));
 await test('forged session setting does not bypass immutability',async()=>{await pg.exec("SELECT set_config('app.facturacion_privilegiada','on',false)");await denied("UPDATE public.facturas SET estado='anulada' WHERE id='invoice-dj'");});
 await test('cannot issue via direct insert',async()=>await denied("INSERT INTO public.facturas(id,area,tipo,numero,cliente,concepto,fecha,linea_negocio,estado,numero_secuencial) VALUES('fake','dj','emitida','555','Cliente Test','x','2026-09-09','dj','emitida',555)"));
 await test('amount manipulation rejected',async()=>await denied(issue('invoice-dj2').replace(',300,21,63,363,',',1,21,63,363,'),'22023'));
 await test('over 100 percent rejected and number preserved',async()=>{await denied(issue('invoice-dj2','income-dj',80),'P0001');await role(admin);assert.equal(await scalar("SELECT ultimo_numero FROM public.numeracion_contador WHERE emisor_id='issuer-dj'"),1);});
 await test('counter cannot be changed directly',async()=>{await role(restricted);await denied("UPDATE public.numeracion_contador SET ultimo_numero=500");});
 await test('numbering cannot reset after issue',async()=>await denied("SELECT public.fijar_numero_inicial_factura(1,'issuer-dj','')",'P0001'));
 const rectify="SELECT * FROM public.crear_factura_rectificativa('invoice-dj','Importe corregido','correction',200,21,42,242,20)";
 await test('partial rectification preserves original and computes 20 percent',async()=>{assert.equal((await pg.query(rectify)).rows[0].numero_emitido,2);assert.equal(await scalar("SELECT total FROM public.facturas WHERE id='invoice-dj'"),363);assert.equal(await scalar("SELECT sum(porcentaje_facturado) FROM public.facturas WHERE ingreso_id='income-dj' AND estado<>'anulada' AND numero_secuencial IS NOT NULL"),20);});
 await test('rectification retry is idempotent',async()=>assert.equal((await pg.query(rectify)).rows[0].numero_emitido,2));
 await test('invoice original issuer retained',async()=>{await role(admin);await pg.exec("UPDATE public.proyecto_emisor SET emisor_id='issuer-rm' WHERE linea_id='dj'");assert.equal(await scalar("SELECT emisor_id FROM public.facturas WHERE id='correction'"),'issuer-dj');});
 await test('cannot remove last administrator',async()=>{await role('','postgres');await denied(`DELETE FROM public.profiles WHERE id='${admin}'`);});
 await test('non-admin cannot grant own invoice permissions',async()=>{await role(restricted);await pg.exec(`UPDATE public.user_facturacion_permissions SET puede_emitir=false WHERE user_id='${restricted}'`);assert.equal(await scalar(`SELECT puede_emitir FROM public.user_facturacion_permissions WHERE user_id='${restricted}'`),true);});
 await test('failure after allocating a number rolls back counter and invoice together',async()=>{
  await role(admin,'postgres');
  await pg.exec("UPDATE public.proyecto_emisor SET emisor_id='issuer-dj' WHERE linea_id='dj'; CREATE FUNCTION public.fail_test_emission() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='invoice-dj2' AND NEW.numero_secuencial IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER zz_fail_test AFTER UPDATE ON public.facturas FOR EACH ROW EXECUTE FUNCTION public.fail_test_emission();");
  const before=await scalar("SELECT ultimo_numero FROM public.numeracion_contador WHERE emisor_id='issuer-dj'");
  await role(restricted);await denied(issue('invoice-dj2'),'23514');
  await role(admin);assert.equal(await scalar("SELECT ultimo_numero FROM public.numeracion_contador WHERE emisor_id='issuer-dj'"),before);
  assert.equal(await scalar("SELECT numero_secuencial FROM public.facturas WHERE id='invoice-dj2'"),null);
  await role(admin,'postgres');await pg.exec('DROP TRIGGER zz_fail_test ON public.facturas; DROP FUNCTION public.fail_test_emission();');
 });
 await test('fiscal data of an already invoiced income is immutable',async()=>{await role(restricted);await denied("UPDATE public.ingresos SET base_imponible=2000 WHERE id='income-dj'");});
 await test('private Storage reads and writes derive from the parent line',async()=>{
  await role(restricted);
  await pg.exec("INSERT INTO storage.objects VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','investment-invoices','ingreso/income-dj/test.pdf')");
  await denied("INSERT INTO storage.objects VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','investment-invoices','ingreso/income-rm/test.pdf')");
  assert.equal(await scalar('SELECT count(*) FROM storage.objects'),1);
  await role('','anon');assert.equal(await scalar('SELECT count(*) FROM storage.objects'),0);
 });
 await test('malformed admin permissions roll back the profile too',async()=>{
  await role(admin);await denied(`SELECT public.admin_save_user('${restricted}','Wrong name','usuario',true,'{"unknown":{"ver":true,"crear":false,"editar":false,"eliminar":false}}','{}','{"emitir":false,"rectificar":false,"gestionarNumeracion":false}')`,'22023');
  assert.equal(await scalar(`SELECT nombre FROM public.profiles WHERE id='${restricted}'`),'Solo DJ');
 });
 await test('authorized admin atomically saves profile and all permissions',async()=>{
  await pg.exec(`SELECT public.admin_save_user('${reader}','Lector actualizado','usuario',true,'{"dj":{"ver":true,"crear":false,"editar":false,"eliminar":false}}','{}','{"emitir":false,"rectificar":false,"gestionarNumeracion":false}')`);
  assert.equal(await scalar(`SELECT nombre FROM public.profiles WHERE id='${reader}'`),'Lector actualizado');
 });
 await test('Drive upload reservation retries keep the same file ID',async()=>{
  await role(admin,'service_role');
  const reserve=`SELECT file_id FROM public.reserve_drive_upload('invoice-dj','${admin}','drive-file-1','folder','hash1','Ingreso.pdf')`;
  assert.equal(await scalar(reserve),'drive-file-1');assert.equal(await scalar(reserve.replace('drive-file-1','drive-file-2')),'drive-file-1');
 });
 await test('same Drive content cannot create a second receipt',async()=>await denied(`SELECT * FROM public.reserve_drive_upload('invoice-rm','${admin}','other-file','folder','hash1','Other.pdf')`,'23505'));
 await test('Drive completion persists only a reserved file',async()=>{
  await pg.exec(`SELECT public.complete_drive_upload('invoice-dj','${admin}','drive-file-1')`);
  await role(admin);assert.equal(await scalar("SELECT drive_file_id FROM public.facturas WHERE id='invoice-dj'"),'drive-file-1');
 });
 await test('disabled user loses all fine permissions',async()=>{await role(admin);await pg.exec(`UPDATE public.profiles SET activo=false WHERE id='${restricted}'`);await role(restricted);assert.equal(await scalar(`SELECT public.has_facturacion_perm('${restricted}','gestionar_numeracion')`),false);assert.equal(await scalar('SELECT count(*) FROM public.ingresos'),0);});
 await test('legacy password table inaccessible even to browser admin',async()=>{await role(admin);await denied('SELECT password_hash FROM public.usuarios');});
 await test('received invoice cannot fake Drive metadata through normal CRUD',async()=>await denied("INSERT INTO public.facturas(id,area,tipo,numero,cliente,concepto,fecha,linea_negocio,drive_file_id) VALUES('forged-receipt','dj','recibida','Provider-1','Proveedor','Servicio','2026-09-09','dj','fake-drive')"));
 await test('browser cannot fake Drive receipt',async()=>await denied(`SELECT public.complete_drive_upload('invoice-dj','${admin}','fake')`));
 await role(admin);
 await pg.exec("INSERT INTO public.gastos(id,area,fecha,concepto,categoria,created_at,linea_negocio) VALUES('expense','dj','2026-09-09','Compra','Material','2026-09-09','dj')");
 const expenseInvoice={id:'received',area:'dj',tipo:'recibida',numero:'Provider-10',numero_proveedor:'Provider-10',cliente:'Proveedor',concepto:'Material',base_imponible:100,porcentaje_iva:21,importe_iva:21,total:121,fecha:'2026-09-09',pagada:false,pagos_recibidos:0,iva_deducible:true,enviada:false,gasto_id:'expense',linea_negocio:'dj',documento_id:'attachment'};
 const attachment={id:'attachment',entity_type:'gasto',entity_id:'expense',area:'dj',nombre:'Factura.pdf',tipo:'factura',storage_key:'gasto/expense/document.pdf',url:'',fecha_subida:'2026-09-09',subido_por:admin,subido_por_nombre:'Admin',tamano:10,created_at:'2026-09-09'};
 const saveExpense=(f,d)=>pg.query('SELECT public.save_received_invoice($1::jsonb,$2::jsonb)',[JSON.stringify(f),JSON.stringify(d)]);
 await test('expense invoice and attachment persist in one transaction',async()=>{
  await saveExpense(expenseInvoice,attachment);
  assert.equal(await scalar("SELECT gasto_id FROM public.facturas WHERE id='received'"),'expense');
  assert.equal(await scalar("SELECT count(*) FROM public.documentos WHERE id='attachment'"),1);
 });
 await test('expense invoice retry does not duplicate records',async()=>{
  await saveExpense(expenseInvoice,attachment);assert.equal(await scalar("SELECT count(*) FROM public.facturas WHERE gasto_id='expense'"),1);
 });
 await test('a failed expense invoice leaves no orphan document row',async()=>{
  let failed=false;try{await saveExpense({...expenseInvoice,id:'received-duplicate',documento_id:'attachment-duplicate'},{...attachment,id:'attachment-duplicate'});}catch(e){failed=true;assert.equal(e.code,'23505');}
  assert.ok(failed);assert.equal(await scalar("SELECT count(*) FROM public.documentos WHERE id='attachment-duplicate'"),0);
 });
 await role(admin,'postgres');
 return count;
}
