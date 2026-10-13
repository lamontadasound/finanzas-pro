create table public.crm_sound_clientes (
 cliente_id text primary key references public.clientes(id) on delete restrict,
 etapa text not null default 'contacto' check (etapa in ('contacto','propuesta','negociacion','ganado','perdido')),
 proxima_accion text not null default '', fecha_seguimiento date, notas text not null default '',
 created_at timestamptz not null default now()
);
create table public.crm_sound_documentos (
 id uuid primary key default gen_random_uuid(), cliente_id text not null references public.crm_sound_clientes(cliente_id) on delete restrict,
 categoria text not null check(categoria in ('informacion','contrato','presupuesto','factura')),
 nombre text not null check(length(nombre) between 1 and 250), storage_path text not null unique,
 created_at timestamptz not null default now(),
 check (split_part(storage_path,'/',1)=cliente_id and split_part(storage_path,'/',2)=id::text)
);
create index crm_sound_documentos_cliente_idx on public.crm_sound_documentos(cliente_id);
alter table public.crm_sound_clientes enable row level security;
alter table public.crm_sound_documentos enable row level security;
revoke all on public.crm_sound_clientes,public.crm_sound_documentos from anon,authenticated;
grant select on public.crm_sound_clientes to authenticated;
grant update(etapa,proxima_accion,fecha_seguimiento,notas) on public.crm_sound_clientes to authenticated;
grant select,insert,delete on public.crm_sound_documentos to authenticated;
grant all on public.crm_sound_clientes,public.crm_sound_documentos to service_role;
create policy crm_sound_read on public.crm_sound_clientes for select to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','view'));
create policy crm_sound_edit on public.crm_sound_clientes for update to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','edit')) with check(public.has_line_perm(auth.uid(),'montada_sound','edit'));
create policy crm_docs_read on public.crm_sound_documentos for select to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','view'));
create policy crm_docs_insert on public.crm_sound_documentos for insert to authenticated with check(public.has_line_perm(auth.uid(),'montada_sound','create'));
create policy crm_docs_delete on public.crm_sound_documentos for delete to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','delete'));
create policy client_sound_read on public.clientes for select to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','view') and exists(select 1 from public.crm_sound_clientes c where c.cliente_id=clientes.id));
create policy client_sound_edit on public.clientes for update to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','edit') and exists(select 1 from public.crm_sound_clientes c where c.cliente_id=clientes.id)) with check(public.has_line_perm(auth.uid(),'montada_sound','edit') and exists(select 1 from public.crm_sound_clientes c where c.cliente_id=clientes.id));

create function public.crear_cliente_sound(p_nombre text, p_cliente_id text default null) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare cid text;
begin
 if auth.uid() is null or not public.has_line_perm(auth.uid(),'montada_sound','create') then raise exception 'No tienes permiso para crear clientes de Sound';end if;
 if p_cliente_id is not null then
  if not public.has_module_perm(auth.uid(),'contabilidad','view') then raise exception 'Necesitas acceso a Contabilidad para vincular una ficha existente';end if;
  select id into cid from public.clientes where id=p_cliente_id;
  if cid is null then raise exception 'Cliente no disponible';end if;
 else
  if p_nombre is null or length(trim(p_nombre)) not between 1 and 200 then raise exception 'Escribe un nombre de cliente válido';end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_nombre)),0));
  if exists(select 1 from public.clientes where lower(trim(nombre))=lower(trim(p_nombre))) then raise exception 'Ya existe una ficha con ese nombre. Vincúlala desde Clientes existentes o pide ayuda a un administrador.';end if;
  cid:=gen_random_uuid()::text;
  insert into public.clientes(id,nombre) values(cid,trim(p_nombre));
 end if;
 insert into public.crm_sound_clientes(cliente_id) values(cid) on conflict do nothing;
 return cid;
end $$;
revoke all on function public.crear_cliente_sound(text,text) from public,anon;
grant execute on function public.crear_cliente_sound(text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('crm-sound','crm-sound',false,20971520,array['application/pdf','image/jpeg','image/png','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) on conflict(id) do nothing;
create policy crm_storage_read on storage.objects for select to authenticated using(bucket_id='crm-sound' and public.has_line_perm(auth.uid(),'montada_sound','view') and exists(select 1 from public.crm_sound_clientes c where c.cliente_id=split_part(name,'/',1)));
create policy crm_storage_insert on storage.objects for insert to authenticated with check(bucket_id='crm-sound' and public.has_line_perm(auth.uid(),'montada_sound','create') and exists(select 1 from public.crm_sound_clientes c where c.cliente_id=split_part(name,'/',1)));
create policy crm_storage_delete on storage.objects for delete to authenticated using(bucket_id='crm-sound' and (public.has_line_perm(auth.uid(),'montada_sound','delete') or (owner_id=auth.uid()::text and public.has_line_perm(auth.uid(),'montada_sound','create'))));

-- Reúne únicamente clientes identificados en actividad de Sound; sin alterar sus datos.
create temporary table sound_names as
select distinct lower(trim(nombre)) clave, min(trim(nombre)) nombre from (
 select cliente nombre from public.ingresos where linea_negocio='montada_sound' or (linea_negocio is null and area='montada')
 union all select contenido->>'cliente' from public.presupuestos where linea_negocio='montada_sound'
 union all select cliente from public.facturas where linea_negocio='montada_sound' or (linea_negocio is null and area='montada')
) n where length(trim(nombre))>0 group by lower(trim(nombre));
insert into public.clientes(id,nombre) select gen_random_uuid()::text,n.nombre from sound_names n where not exists(select 1 from public.clientes c where lower(trim(c.nombre))=n.clave);
insert into public.crm_sound_clientes(cliente_id) select min(c.id) from public.clientes c join sound_names n on lower(trim(c.nombre))=n.clave group by n.clave having count(*)=1 on conflict do nothing;
drop table sound_names;

create function public.guardar_cliente_sound(p_id text,p_datos jsonb,p_etapa text,p_accion text,p_fecha date,p_notas text) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.has_line_perm(auth.uid(),'montada_sound','edit') then raise exception 'Sin permiso para editar clientes de Sound';end if;
 if length(trim(coalesce(p_datos->>'nombre',''))) not between 1 and 200 then raise exception 'Nombre no válido';end if;
 update public.crm_sound_clientes set etapa=p_etapa,proxima_accion=p_accion,fecha_seguimiento=p_fecha,notas=p_notas where cliente_id=p_id;
 if not found then raise exception 'Cliente no disponible';end if;
 update public.clientes set nombre=trim(p_datos->>'nombre'),nif_cif=p_datos->>'nifCif',direccion=p_datos->>'direccion',email=p_datos->>'email',telefono=p_datos->>'telefono' where id=p_id;
 if not found then raise exception 'No se pudo guardar la ficha';end if;
end $$;
revoke all on function public.guardar_cliente_sound(text,jsonb,text,text,date,text) from public,anon;
grant execute on function public.guardar_cliente_sound(text,jsonb,text,text,date,text) to authenticated;
