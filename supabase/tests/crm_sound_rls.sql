begin;
do $$
declare actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); cid text; fileid uuid:=gen_random_uuid(); path text;
begin
 insert into auth.users(id) values(actor),(outsider);
 insert into public.profiles(id,email,nombre,rol,activo) values(actor,actor::text||'@example.invalid','CRM test','usuario',true),(outsider,outsider::text||'@example.invalid','Outside','usuario',true);
 insert into public.user_line_permissions(user_id,linea_negocio,can_view,can_create,can_edit,can_delete) values(actor,'montada_sound',true,true,true,true),(outsider,'dj',true,true,true,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 set local role authenticated;
 cid:=public.crear_cliente_sound('CRM rollback '||actor);
 perform public.guardar_cliente_sound(cid,jsonb_build_object('nombre','CRM rollback '||actor,'email','crm@example.invalid'),'propuesta','Llamar','2026-09-20','Prueba');
 if not exists(select 1 from public.clientes where id=cid and email='crm@example.invalid') then raise exception 'Client save/read failed';end if;
 if not exists(select 1 from public.crm_sound_clientes where cliente_id=cid and etapa='propuesta') then raise exception 'CRM state failed';end if;
 begin
  update public.crm_sound_clientes set cliente_id='another' where cliente_id=cid;raise exception 'CRM identity mutable';
 exception when insufficient_privilege then null;end;
 path:=cid||'/'||fileid||'/archivo.pdf';
 insert into public.crm_sound_documentos(id,cliente_id,categoria,nombre,storage_path) values(fileid,cid,'contrato','Contrato prueba.pdf',path);
 insert into storage.objects(bucket_id,name,owner_id) values('crm-sound',path,actor::text);
 if not exists(select 1 from storage.objects where bucket_id='crm-sound' and name=path) then raise exception 'Storage read failed';end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.crm_sound_clientes) or exists(select 1 from public.crm_sound_documentos) or exists(select 1 from storage.objects where bucket_id='crm-sound') then raise exception 'CRM leaked across lines';end if;
 if exists(select 1 from public.clientes where id=cid) then raise exception 'Client leaked';end if;
 begin
  perform public.crear_cliente_sound('Unauthorized');raise exception 'Creation allowed';
 exception when raise_exception then if sqlerrm='Creation allowed' then raise;end if;end;
 reset role;
 update public.user_line_permissions set can_create=false,can_edit=false,can_delete=false where user_id=actor;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 set local role authenticated;
 if not exists(select 1 from public.crm_sound_clientes where cliente_id=cid) then raise exception 'Reader cannot read';end if;
 begin
  insert into public.crm_sound_documentos(cliente_id,categoria,nombre,storage_path) values(cid,'contrato','Unauthorized','invalid');raise exception 'Reader can write';
 exception when insufficient_privilege then null;end;
 reset role;
end $$;
rollback;
