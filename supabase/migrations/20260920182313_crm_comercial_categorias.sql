create table public.expense_categories (
 nombre text primary key check(length(trim(nombre)) between 1 and 80),
 color text not null check(color ~ '^#[0-9A-Fa-f]{6}$'),
 general boolean not null default true, evento boolean not null default true,
 check(general or evento)
);
create unique index expense_categories_name_key on public.expense_categories(lower(regexp_replace(trim(nombre),'\s+',' ','g')));
alter table public.expense_categories enable row level security;
revoke all on public.expense_categories from public,anon,authenticated;
grant select,insert,update on public.expense_categories to authenticated;
grant all on public.expense_categories to service_role;
create policy expense_categories_read on public.expense_categories for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and activo));
create policy expense_categories_create on public.expense_categories for insert to authenticated with check(public.is_admin(auth.uid()));
create policy expense_categories_edit on public.expense_categories for update to authenticated using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
insert into public.expense_categories(nombre,color,general,evento) values('Impuestos','#2563eb',true,false);
insert into public.expense_categories(nombre,color,general,evento) values('Gestoría','#7c3aed',true,false);
insert into public.expense_categories(nombre,color,general,evento) values('Marketing','#db2777',true,false);
insert into public.expense_categories(nombre,color,general,evento) values('RRSS','#d97706',true,false);
insert into public.expense_categories(nombre,color,general,evento) values('Software','#0d9488',true,false);
insert into public.expense_categories(nombre,color,general,evento) values('Personal','#4f46e5',true,false);
insert into public.expense_categories(nombre,color,general,evento) values('Material','#dc2626',true,false);
insert into public.expense_categories(nombre,color,general,evento) values('Equipo','#059669',true,false);
insert into public.expense_categories(nombre,color,general,evento) values('Almacén','#9333ea',true,true);
insert into public.expense_categories(nombre,color,general,evento) values('DJ','#0284c7',false,true);
insert into public.expense_categories(nombre,color,general,evento) values('Técnico','#c2410c',false,true);
insert into public.expense_categories(nombre,color,general,evento) values('Montador','#475569',false,true);
insert into public.expense_categories(nombre,color,general,evento) values('Gasolina','#2563eb',false,true);
insert into public.expense_categories(nombre,color,general,evento) values('Furgoneta','#7c3aed',false,true);
insert into public.expense_categories(nombre,color,general,evento) values('Alquiler','#db2777',false,true);
insert into public.expense_categories(nombre,color,general,evento) values('Decoración','#d97706',false,true);

alter table public.crm_sound_clientes
 add column origen text not null default '' check(length(origen)<=200),
 add column contacto_nombre text not null default '' check(length(contacto_nombre)<=200),
 add column tipo_servicio text not null default 'sin_clasificar' check(tipo_servicio in ('sin_clasificar','alquiler','boda','corporativo','privado','otro')),
 add column motivo_perdida text not null default '' check(length(motivo_perdida)<=4000),
 add column fecha_cierre date;
grant update(origen,contacto_nombre,tipo_servicio,motivo_perdida,fecha_cierre) on public.crm_sound_clientes to authenticated;
-- El RPC existente mantiene su firma y sus permisos. Los campos nuevos se
-- conservan cuando una versión antigua de la app guarda una ficha.
create or replace function public.guardar_cliente_sound(p_id text,p_datos jsonb,p_etapa text,p_accion text,p_fecha date,p_notas text) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.has_line_perm(auth.uid(),'montada_sound','edit') then raise exception 'Sin permiso para editar clientes de Sound';end if;
 if length(trim(coalesce(p_datos->>'nombre',''))) not between 1 and 200 then raise exception 'Nombre no válido';end if;
 if p_etapa='perdido' and p_datos ? 'motivo_perdida' and length(trim(coalesce(p_datos->>'motivo_perdida','')))=0 then raise exception 'Indica por qué no se cerró el cliente';end if;
 if p_etapa in ('ganado','perdido') and p_datos ? 'fecha_cierre' and nullif(p_datos->>'fecha_cierre','') is null then raise exception 'Indica la fecha de cierre';end if;
 update public.crm_sound_clientes set etapa=p_etapa,proxima_accion=p_accion,fecha_seguimiento=p_fecha,notas=p_notas,
 origen=case when p_datos ? 'origen' then coalesce(p_datos->>'origen','') else origen end,
 contacto_nombre=case when p_datos ? 'contacto_nombre' then coalesce(p_datos->>'contacto_nombre','') else contacto_nombre end,
 tipo_servicio=case when p_datos ? 'tipo_servicio' then p_datos->>'tipo_servicio' else tipo_servicio end,
 motivo_perdida=case when p_datos ? 'motivo_perdida' then coalesce(p_datos->>'motivo_perdida','') else motivo_perdida end,
 fecha_cierre=case when p_etapa not in ('ganado','perdido') then null when p_datos ? 'fecha_cierre' then nullif(p_datos->>'fecha_cierre','')::date else fecha_cierre end
 where cliente_id=p_id;
 if not found then raise exception 'Cliente no disponible';end if;
 update public.clientes set nombre=trim(p_datos->>'nombre'),nif_cif=p_datos->>'nifCif',direccion=p_datos->>'direccion',email=p_datos->>'email',telefono=p_datos->>'telefono' where id=p_id;
 if not found then raise exception 'No se pudo guardar la ficha';end if;
end $$;
revoke all on function public.guardar_cliente_sound(text,jsonb,text,text,date,text) from public,anon;
grant execute on function public.guardar_cliente_sound(text,jsonb,text,text,date,text) to authenticated;
-- Solo actividad real de ingresos con coincidencia exacta y única confirma
-- un cliente histórico. Los presupuestos, por sí solos, no prueban un cierre.
update public.crm_sound_clientes crm set etapa='ganado'
from public.clientes c where crm.cliente_id=c.id and crm.etapa='contacto'
and (select count(*) from public.clientes other where lower(trim(other.nombre))=lower(trim(c.nombre)))=1
and exists(select 1 from public.ingresos i where lower(trim(i.cliente))=lower(trim(c.nombre)) and (i.linea_negocio='montada_sound' or (i.linea_negocio is null and i.area='montada')));
