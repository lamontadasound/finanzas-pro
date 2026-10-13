begin;
do $$
declare actor uuid:=gen_random_uuid(); plain uuid:=gen_random_uuid(); income text:=gen_random_uuid()::text;
 inv1 text:=gen_random_uuid()::text; inv2 text:=gen_random_uuid()::text; client text:=gen_random_uuid()::text;
 n1 bigint; n2 bigint; before_num bigint;
begin
 select ultimo_numero into before_num from numeracion_contador where emisor_id='default' and serie='';
 insert into auth.users(id) values(actor),(plain);
 insert into profiles(id,email,nombre,rol,activo) values(actor,actor::text||'@example.invalid','Admin test','admin',true),(plain,plain::text||'@example.invalid','No permissions','usuario',true);

 insert into ingresos(id,area,concepto,cliente,tipo_evento,fecha_evento,base_imponible,porcentaje_iva,importe_iva,total,metodo_pago,estado_pago,created_at,linea_negocio)
 values(income,'montada','Prueba rollback',client,'boda','2026-09-16',100,21,21,121,'transferencia','pendiente',now()::text,'montada_sound');
 insert into facturas(id,area,tipo,numero,cliente,concepto,fecha,ingreso_id,estado,linea_negocio)
 values(inv1,'montada','emitida','',client,'Prueba','2026-09-16',income,'borrador','montada_sound'),(inv2,'montada','emitida','',client,'Prueba','2026-09-16',income,'borrador','montada_sound');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',plain,'role','authenticated')::text,true);
 set local role authenticated;
 begin
 perform emitir_factura_con_datos_fiscales(inv1,'montada','emitida',client,'Test',50,21,10.5,60.5,'2026-09-16',income,50,null,'{}'::jsonb);raise exception 'Unauthorized issuance';
 exception when insufficient_privilege then null;end;
 if exists(select 1 from drive_invoice_files) then raise exception 'Archive leaked to unauthorized user';end if;
 begin
 perform replace_drive_invoice_archive('[]','[]');raise exception 'Authenticated can rewrite archive';
 exception when insufficient_privilege then null;end;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 set local role authenticated;
 if not exists(select 1 from drive_invoice_files where numero=80 and tipo='emitida') then raise exception 'Admin cannot read imported invoice';end if;
 begin
 perform emitir_factura_con_datos_fiscales(inv1,'montada','emitida',client,'Test',50,21,10.5,60.5,'2026-09-16',income,50,null,'{}'::jsonb);raise exception 'Empty fiscal fields allowed';
 exception when invalid_parameter_value then null;end;
 select numero_emitido into n1 from emitir_factura_con_datos_fiscales(inv1,'montada','emitida',client,'Test',50,21,10.5,60.5,'2026-09-16',income,50,null,'{"nombre":"Empresa receptora prueba","nifCif":"B12345678","direccion":"Calle fiscal prueba"}'::jsonb);
 if n1<>greatest(before_num,(select coalesce(max(numero),0) from drive_invoice_files where tipo='emitida'))+1 then raise exception 'Wrong next number: %',n1;end if;
 select numero_emitido into n2 from emitir_factura_con_datos_fiscales(inv1,'montada','emitida',client,'Test',50,21,10.5,60.5,'2026-09-16',income,50,null,'{"nombre":"Empresa receptora prueba","nifCif":"B12345678","direccion":"Calle fiscal prueba"}'::jsonb);
 if n1<>n2 then raise exception 'Retry consumes number';end if;
 select numero_emitido into n2 from emitir_factura_con_datos_fiscales(inv2,'montada','emitida',client,'Test',50,21,10.5,60.5,'2026-09-16',income,50,null,'{"nombre":"Empresa receptora prueba","nifCif":"B12345678","direccion":"Calle fiscal prueba"}'::jsonb);
 if n2<>n1+1 then raise exception 'Sequence broken';end if;
 reset role;
 if exists(select 1 from clientes where id=client) then raise exception 'Unexpected CRM client';end if;
 if (select cliente_snapshot->>'nombre' from facturas where id=inv1)<>'Empresa receptora prueba' then raise exception 'Wrong customer snapshot';end if;
 if (select emisor_snapshot->>'razon_social' from facturas where id=inv1)<>'LA MONTADA SOUND SL' then raise exception 'Wrong fiscal snapshot';end if;
end $$;
rollback;
