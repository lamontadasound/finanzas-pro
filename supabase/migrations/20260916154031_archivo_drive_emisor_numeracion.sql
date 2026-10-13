-- Archivo documental: nunca crea apuntes económicos a partir del nombre del PDF.
create table public.drive_invoice_files (
 id text primary key, nombre text not null, tipo text not null check(tipo in ('emitida','recibida')),
 anio integer not null, mes integer not null check(mes between 1 and 12), carpeta_id text not null,
 numero bigint, mime_type text not null, url text not null, actualizado_en timestamptz,
 sincronizado_en timestamptz not null default now()
);
create table public.drive_invoice_folders (
 id text primary key, anio integer not null, mes integer not null check(mes between 1 and 12),
 tipo text not null check(tipo in ('emitida','recibida')), nombre text not null
);
alter table public.drive_invoice_files enable row level security;
alter table public.drive_invoice_folders enable row level security;
-- El archivo reúne todas las líneas: exige acceso contable completo, sin inferir permisos por nombres de PDF.
create policy archivo_read on public.drive_invoice_files for select to authenticated using (
 public.is_admin(auth.uid()) or (public.has_module_perm(auth.uid(),'contabilidad','view')
 and public.has_line_perm(auth.uid(),'montada_sound','view') and public.has_line_perm(auth.uid(),'montada_installations','view')
 and public.has_line_perm(auth.uid(),'real_madrid','view') and public.has_line_perm(auth.uid(),'dj','view')));
create policy carpetas_read on public.drive_invoice_folders for select to authenticated using (
 public.is_admin(auth.uid()) or (public.has_module_perm(auth.uid(),'contabilidad','view')
 and public.has_line_perm(auth.uid(),'montada_sound','view') and public.has_line_perm(auth.uid(),'montada_installations','view')
 and public.has_line_perm(auth.uid(),'real_madrid','view') and public.has_line_perm(auth.uid(),'dj','view')));
revoke all on public.drive_invoice_files, public.drive_invoice_folders from anon,authenticated;
grant select on public.drive_invoice_files, public.drive_invoice_folders to authenticated;
grant all on public.drive_invoice_files, public.drive_invoice_folders to service_role;
create function public.replace_drive_invoice_archive(p_files jsonb,p_folders jsonb) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(872931008);
 insert into drive_invoice_folders select * from jsonb_populate_recordset(null::drive_invoice_folders,p_folders)
 on conflict(id) do update set anio=excluded.anio,mes=excluded.mes,tipo=excluded.tipo,nombre=excluded.nombre;
 insert into drive_invoice_files(id,nombre,tipo,anio,mes,carpeta_id,numero,mime_type,url,actualizado_en)
 select id,nombre,tipo,anio,mes,carpeta_id,numero,mime_type,url,actualizado_en
 from jsonb_populate_recordset(null::drive_invoice_files,p_files)
 on conflict(id) do update set nombre=excluded.nombre,tipo=excluded.tipo,anio=excluded.anio,mes=excluded.mes,
 carpeta_id=excluded.carpeta_id,numero=excluded.numero,mime_type=excluded.mime_type,url=excluded.url,
 actualizado_en=excluded.actualizado_en,sincronizado_en=now();
 delete from drive_invoice_files where id not in(select value->>'id' from jsonb_array_elements(p_files));
 delete from drive_invoice_folders where id not in(select value->>'id' from jsonb_array_elements(p_folders));
 -- Never move the already allocated number backwards, even if a Drive file is removed.
 update numeracion_contador set ultimo_numero=greatest(ultimo_numero,coalesce((select max(numero) from drive_invoice_files where tipo='emitida'),0))
 where emisor_id='default' and serie='';
end $$;
revoke all on function public.replace_drive_invoice_archive(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.replace_drive_invoice_archive(jsonb,jsonb) to service_role;

update public.configuracion_fiscal set razon_social='LA MONTADA SOUND SL', nombre_comercial='LA MONTADA SOUND',
 nombre_interno='LA MONTADA SOUND SL',nif_cif='B21642913',
 direccion_fiscal='CALLE PORTUGALETE 68, 28223, POZUELO DE ALARCÓN, MADRID',serie_formato='',numeracion_confirmada=true,
 numero_inicial=81,logo_url='/brand/la-montada-marron.png',actualizado_en=now() where id='default';
insert into public.proyecto_emisor(linea_id,emisor_id) values
 ('montada_sound','default'),('montada_installations','default'),('real_madrid','default'),('dj','default')
 on conflict(linea_id) do update set emisor_id=excluded.emisor_id;
-- Nº 80 comprobado dentro del PDF de Drive 1tmN6JwYp3hqb7f4VGQZeMMuif4bYQFtA.
insert into public.numeracion_contador(emisor_id,serie,ultimo_numero,confirmado) values('default','',80,true)
 on conflict(emisor_id,serie) do update set ultimo_numero=greatest(numeracion_contador.ultimo_numero,80),confirmado=true;
-- Preserve all existing validations, locks and idempotency of invoice issuance.
do $$
declare definition text;
begin
 select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname='emitir_numero_factura';
 if position('SET ultimo_numero = ultimo_numero + 1' in definition)=0 then raise exception 'Invoice function differs; review before changing';end if;
 definition:=replace(definition,'SET ultimo_numero = ultimo_numero + 1',
 'SET ultimo_numero = greatest(ultimo_numero,coalesce((select max(numero_secuencial) from public.facturas where emisor_id=v_emisor_id and coalesce(serie,'''')=v_serie),0),case when v_emisor_id=''default'' and v_serie='''' then coalesce((select max(numero) from public.drive_invoice_files where tipo=''emitida''),0) else 0 end) + 1');
 execute definition;
end $$;
