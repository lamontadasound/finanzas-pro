begin;
do $$
declare admin_id uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); cid text; category text:='Prueba '||gen_random_uuid(); affected integer;
begin
 insert into auth.users(id) values(admin_id),(actor),(outsider);
 insert into public.profiles(id,email,nombre,rol,activo) values(admin_id,admin_id||'@example.invalid','Admin test','admin',true),(actor,actor||'@example.invalid','Sound test','usuario',true),(outsider,outsider||'@example.invalid','Outside test','usuario',true);
 insert into public.user_line_permissions(user_id,linea_negocio,can_view,can_create,can_edit,can_delete) values(actor,'montada_sound',true,true,true,true),(outsider,'dj',true,true,true,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 set local role authenticated;
 insert into public.expense_categories(nombre,color,general,evento) values(category,'#112233',true,true);
 update public.expense_categories set color='#445566' where nombre=category;
 if not exists(select 1 from public.expense_categories where nombre=category and color='#445566') then raise exception 'Admin save failed';end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 set local role authenticated;
 if not exists(select 1 from public.expense_categories where nombre=category) then raise exception 'Reader cannot read config';end if;
 update public.expense_categories set color='#000000' where nombre=category;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Non-admin changed config';end if;
 begin
  insert into public.expense_categories(nombre,color) values(category||' forbidden','#112233');raise exception 'Non-admin inserted config';
 exception when insufficient_privilege then null;end;
 begin delete from public.expense_categories where nombre=category;raise exception 'Delete allowed';exception when insufficient_privilege then null;end;
 cid:=public.crear_cliente_sound('CRM test '||actor);
 perform public.guardar_cliente_sound(cid,jsonb_build_object('nombre','CRM test '||actor,'email','test@example.invalid','origen','Instagram','contacto_nombre','Contacto prueba','tipo_servicio','boda','motivo_perdida','Precio','fecha_cierre','2026-09-20'),'perdido','Llamar',null,'Notas');
 if not exists(select 1 from public.crm_sound_clientes where cliente_id=cid and origen='Instagram' and tipo_servicio='boda' and motivo_perdida='Precio' and fecha_cierre='2026-09-20') then raise exception 'CRM fields failed';end if;
 begin
  perform public.guardar_cliente_sound(cid,jsonb_build_object('nombre','Changed','motivo_perdida','','fecha_cierre','2026-09-20'),'perdido','',null,'');raise exception 'Missing reason accepted';
 exception when raise_exception then if sqlerrm='Missing reason accepted' then raise;end if;end;
 if not exists(select 1 from public.clientes where id=cid and nombre='CRM test '||actor) then raise exception 'Failed save not atomic';end if;
 perform public.guardar_cliente_sound(cid,jsonb_build_object('nombre','CRM test '||actor),'propuesta','Llamar',null,'');
 if not exists(select 1 from public.crm_sound_clientes where cliente_id=cid and fecha_cierre is null and origen='Instagram') then raise exception 'Reopen or backwards compatibility failed';end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.crm_sound_clientes where cliente_id=cid) then raise exception 'Outside read CRM';end if;
 begin
  perform public.guardar_cliente_sound(cid,jsonb_build_object('nombre','Unauthorized'),'ganado','',null,'');raise exception 'Outside edit CRM';
 exception when raise_exception then if sqlerrm='Outside edit CRM' then raise;end if;end;
 reset role;
 set local role anon;
 begin perform count(*) from public.expense_categories;raise exception 'Anonymous config read';exception when insufficient_privilege then null;end;
 begin perform public.guardar_cliente_sound(cid,'{}','ganado','',null,'');raise exception 'Anonymous CRM edit';exception when insufficient_privilege then null;end;
 reset role;
end $$;
rollback;
