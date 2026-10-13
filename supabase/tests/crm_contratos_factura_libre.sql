begin;
do $$
declare actor uuid:=gen_random_uuid();plain uuid:=gen_random_uuid();lead uuid:=gen_random_uuid();contract uuid:=gen_random_uuid();client text; inv text:=gen_random_uuid()::text; correction text:=gen_random_uuid()::text;n bigint;n2 bigint; before_number bigint; income_count bigint;
begin
 insert into auth.users(id) values(actor),(plain);
 insert into public.profiles(id,email,nombre,rol,activo) values(actor,actor::text||'@example.invalid','Test','admin',true),(plain,plain::text||'@example.invalid','Test','usuario',true);
 select count(*) into income_count from public.ingresos;
 select greatest(ultimo_numero,coalesce((select max(numero) from public.drive_invoice_files where tipo='emitida'),0)) into before_number from public.numeracion_contador where emisor_id='default' and serie='';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 set local role authenticated;
 insert into public.sound_leads(id,nombre,canal) values(lead,'Contacto independiente de prueba','Web');
 client:=public.crear_carpeta_sound('Carpeta independiente de prueba');
 update public.sound_leads set estado='convertido' where id=lead;
 if (select etapa from public.crm_sound_clientes where cliente_id=client)<>'contacto' then raise exception 'CRM changed folder';end if;
 perform public.guardar_carpeta_sound(client,'{"nombre":"Carpeta editada","tipo_servicio":"boda"}',null,null,null,'Notas de carpeta');
 if (select nombre from public.sound_leads where id=lead)<>'Contacto independiente de prueba' then raise exception 'Client changed CRM';end if;
 insert into public.sound_contracts(id,tipo,titulo,contenido) values(contract,'boda','Contrato test','{}');
 insert into public.facturas(id,area,linea_negocio,tipo,numero,cliente,concepto,fecha,estado) values(inv,'montada','montada_sound','emitida','','Destinatario','Test','2026-09-23','borrador');
 select numero_emitido into n from public.emitir_factura_independiente(inv,'montada','emitida','Destinatario','Test',100,21,21,121,'2026-09-23',null,100,null,'{"nombre":"Destinatario","nifCif":"TEST","direccion":"Dirección"}');
 if n<>before_number+1 then raise exception 'Wrong consecutive number';end if;
 select numero_emitido into n2 from public.emitir_factura_independiente(inv,'montada','emitida','Destinatario','Test',100,21,21,121,'2026-09-23',null,100,null,'{"nombre":"Destinatario","nifCif":"TEST","direccion":"Dirección"}');
 if n<>n2 then raise exception 'Retry consumes number';end if;
 if (select ingreso_id from public.facturas where id=inv) is not null then raise exception 'Unexpected income link';end if;
 select numero_emitido into n2 from public.crear_factura_rectificativa(inv,'Prueba rollback',correction,50,21,10.5,60.5,0);
 if n2<>n+1 then raise exception 'Correction numbering error';end if;
 delete from public.sound_leads where id=lead;
 if not exists(select 1 from public.crm_sound_clientes where cliente_id=client) then raise exception 'Deleted client from CRM';end if;
 reset role;
 if (select count(*) from public.ingresos)<>income_count then raise exception 'Created unwanted income';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',plain,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.sound_contracts) or exists(select 1 from public.sound_leads) then raise exception 'Private data leaked';end if;
 begin
 insert into public.sound_leads(nombre) values('No permission');raise exception 'Unexpected create';
 exception when insufficient_privilege then null;end;
 begin
 perform public.emitir_factura_independiente(inv,'montada','emitida','Destinatario','Test',100,21,21,121,'2026-09-23',null,100,null,'{}');raise exception 'Unexpected issuance permission';
 exception when insufficient_privilege then null;end;
 reset role;
end $$;
rollback;
