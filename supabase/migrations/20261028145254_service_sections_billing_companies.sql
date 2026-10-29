-- Optional section allow-list; NULL preserves existing explicitly granted line access.
alter table public.user_line_permissions add column secciones text[];
alter table public.user_line_permissions add constraint valid_sections check (secciones is null or secciones <@ array['resumen','ingresos','gastos_eventos','gastos','inversiones','informes','reparto_socios','pagos','crm','clientes','contratos','calendario','presupuestos','facturas','resultados']::text[]);
create or replace function public.has_section_perm(p_user_id uuid,p_linea text,p_section text,p_action text) returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
 select public.has_line_perm(p_user_id,p_linea,p_action) and (public.is_admin(p_user_id) or exists(select 1 from public.user_line_permissions p where p.user_id=p_user_id and p.linea_negocio=p_linea and (p.secciones is null or p_section=any(p.secciones))));
$$;
revoke all on function public.has_section_perm(uuid,text,text,text) from public,anon;
grant execute on function public.has_section_perm(uuid,text,text,text) to authenticated,service_role;
CREATE OR REPLACE FUNCTION public.admin_save_user(p_user_id uuid, p_nombre text, p_rol text, p_activo boolean, p_lineas jsonb, p_modulos jsonb, p_facturacion jsonb, p_email text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE k text; v jsonb; action text;
BEGIN
 IF NOT public.is_admin(auth.uid()) OR p_user_id=auth.uid() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Acción administrativa no autorizada.'; END IF;
 IF p_rol NOT IN ('admin','usuario') OR p_activo IS NULL OR NULLIF(trim(p_nombre),'') IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Perfil inválido.'; END IF;
 IF jsonb_typeof(p_lineas)<>'object' OR jsonb_typeof(p_modulos)<>'object' OR jsonb_typeof(p_facturacion)<>'object'
   OR p_lineas IS NULL OR p_modulos IS NULL OR p_facturacion IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Matriz de permisos inválida.'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(p_lineas||p_modulos) LOOP
  IF k NOT IN ('montada_sound','dj','real_madrid','montada_installations','contabilidad','impuestos','informes','administracion') OR jsonb_typeof(v)<>'object'
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Permiso desconocido.'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(v) field WHERE field NOT IN ('ver','crear','editar','eliminar','secciones')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Capacidad desconocida.'; END IF;
  FOREACH action IN ARRAY ARRAY['ver','crear','editar','eliminar'] LOOP
   IF jsonb_typeof(v->action) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Las capacidades deben ser booleanas.'; END IF;
  END LOOP;
  IF NOT (v->>'ver')::boolean AND ((v->>'crear')::boolean OR (v->>'editar')::boolean OR (v->>'eliminar')::boolean) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Concede lectura antes de escritura.'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_lineas) AS keys(name) WHERE keys.name NOT IN ('montada_sound','dj','real_madrid','montada_installations')) OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_modulos) AS keys(name) WHERE keys.name NOT IN ('contabilidad','impuestos','informes','administracion')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Matriz incorrecta.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_facturacion) AS keys(name) WHERE keys.name NOT IN ('emitir','rectificar','gestionarNumeracion')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Permiso de facturación desconocido.'; END IF;
 FOREACH action IN ARRAY ARRAY['emitir','rectificar','gestionarNumeracion'] LOOP
  IF jsonb_typeof(p_facturacion->action) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Permiso de facturación inválido.'; END IF;
 END LOOP;
 -- Auth user must already exist; this never creates Auth identities.
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Cuenta Auth inexistente.'; END IF;
 INSERT INTO public.profiles(id,email,nombre,rol,activo)
 SELECT p_user_id,u.email,trim(p_nombre),p_rol,p_activo FROM auth.users u WHERE u.id=p_user_id
 ON CONFLICT(id) DO UPDATE SET nombre=EXCLUDED.nombre,rol=EXCLUDED.rol,activo=EXCLUDED.activo;
 DELETE FROM public.user_line_permissions WHERE user_id=p_user_id;
 DELETE FROM public.user_module_permissions WHERE user_id=p_user_id;
 INSERT INTO public.user_line_permissions(user_id,linea_negocio,can_view,can_create,can_edit,can_delete,secciones)
 SELECT p_user_id,key,(value->>'ver')::boolean,(value->>'crear')::boolean,(value->>'editar')::boolean,(value->>'eliminar')::boolean,case when value->'secciones' is null or value->'secciones'='null'::jsonb then null else array(select jsonb_array_elements_text(value->'secciones')) end FROM jsonb_each(p_lineas);
 INSERT INTO public.user_module_permissions(user_id,modulo,can_view,can_create,can_edit,can_delete)
 SELECT p_user_id,key,(value->>'ver')::boolean,(value->>'crear')::boolean,(value->>'editar')::boolean,(value->>'eliminar')::boolean FROM jsonb_each(p_modulos);
 INSERT INTO public.user_facturacion_permissions(user_id,puede_emitir,puede_rectificar,puede_gestionar_numeracion)
 VALUES(p_user_id,(p_facturacion->>'emitir')::boolean,(p_facturacion->>'rectificar')::boolean,(p_facturacion->>'gestionarNumeracion')::boolean)
 ON CONFLICT(user_id) DO UPDATE SET puede_emitir=EXCLUDED.puede_emitir,puede_rectificar=EXCLUDED.puede_rectificar,puede_gestionar_numeracion=EXCLUDED.puede_gestionar_numeracion;
END $function$
;
create policy section_select on public.ingresos as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'ingresos','view') or public.has_section_perm(auth.uid(),linea_negocio,'resumen','view') or public.has_section_perm(auth.uid(),linea_negocio,'informes','view') or public.has_section_perm(auth.uid(),linea_negocio,'resultados','view') or public.has_section_perm(auth.uid(),linea_negocio,'pagos','view') or public.has_section_perm(auth.uid(),linea_negocio,'facturas','view'))) ;
create policy section_insert on public.ingresos as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),linea_negocio,'ingresos','create')));
create policy section_update on public.ingresos as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'ingresos','edit'))) with check ((public.has_section_perm(auth.uid(),linea_negocio,'ingresos','edit')));
create policy section_delete on public.ingresos as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'ingresos','delete'))) ;
create policy section_select on public.gastos as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'gastos','view') or public.has_section_perm(auth.uid(),linea_negocio,'resumen','view') or public.has_section_perm(auth.uid(),linea_negocio,'informes','view') or public.has_section_perm(auth.uid(),linea_negocio,'resultados','view'))) ;
create policy section_insert on public.gastos as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),linea_negocio,'gastos','create')));
create policy section_update on public.gastos as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'gastos','edit'))) with check ((public.has_section_perm(auth.uid(),linea_negocio,'gastos','edit')));
create policy section_delete on public.gastos as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'gastos','delete'))) ;
create policy section_select on public.gastos_evento as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'gastos_eventos','view') or public.has_section_perm(auth.uid(),linea_negocio,'resumen','view') or public.has_section_perm(auth.uid(),linea_negocio,'informes','view') or public.has_section_perm(auth.uid(),linea_negocio,'resultados','view') or public.has_section_perm(auth.uid(),linea_negocio,'ingresos','view'))) ;
create policy section_insert on public.gastos_evento as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),linea_negocio,'gastos_eventos','create')));
create policy section_update on public.gastos_evento as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'gastos_eventos','edit'))) with check ((public.has_section_perm(auth.uid(),linea_negocio,'gastos_eventos','edit')));
create policy section_delete on public.gastos_evento as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'gastos_eventos','delete'))) ;
create policy section_select on public.pagos_evento as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'pagos','view') or public.has_section_perm(auth.uid(),linea_negocio,'resumen','view') or public.has_section_perm(auth.uid(),linea_negocio,'informes','view') or public.has_section_perm(auth.uid(),linea_negocio,'resultados','view') or public.has_section_perm(auth.uid(),linea_negocio,'ingresos','view'))) ;
create policy section_insert on public.pagos_evento as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),linea_negocio,'pagos','create')));
create policy section_update on public.pagos_evento as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'pagos','edit'))) with check ((public.has_section_perm(auth.uid(),linea_negocio,'pagos','edit')));
create policy section_delete on public.pagos_evento as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'pagos','delete'))) ;
create policy section_select on public.suplidos as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'ingresos','view') or public.has_section_perm(auth.uid(),linea_negocio,'resumen','view') or public.has_section_perm(auth.uid(),linea_negocio,'informes','view') or public.has_section_perm(auth.uid(),linea_negocio,'resultados','view'))) ;
create policy section_insert on public.suplidos as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),linea_negocio,'ingresos','create')));
create policy section_update on public.suplidos as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'ingresos','edit'))) with check ((public.has_section_perm(auth.uid(),linea_negocio,'ingresos','edit')));
create policy section_delete on public.suplidos as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'ingresos','delete'))) ;
create policy section_select on public.facturas as restrictive for select to authenticated using (((public.has_section_perm(auth.uid(),linea_negocio,'facturas','view') or public.has_section_perm(auth.uid(),linea_negocio,'resumen','view') or public.has_section_perm(auth.uid(),linea_negocio,'informes','view') or public.has_section_perm(auth.uid(),linea_negocio,'resultados','view')) or public.has_module_perm(auth.uid(),'contabilidad','view'))) ;
create policy section_insert on public.facturas as restrictive for insert to authenticated with check (((public.has_section_perm(auth.uid(),linea_negocio,'facturas','create')) or public.has_module_perm(auth.uid(),'contabilidad','create')));
create policy section_update on public.facturas as restrictive for update to authenticated using (((public.has_section_perm(auth.uid(),linea_negocio,'facturas','edit')) or public.has_module_perm(auth.uid(),'contabilidad','edit'))) with check (((public.has_section_perm(auth.uid(),linea_negocio,'facturas','edit')) or public.has_module_perm(auth.uid(),'contabilidad','edit')));
create policy section_delete on public.facturas as restrictive for delete to authenticated using (((public.has_section_perm(auth.uid(),linea_negocio,'facturas','delete')) or public.has_module_perm(auth.uid(),'contabilidad','delete'))) ;
create policy section_select on public.equipo as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'inversiones','view') or public.has_section_perm(auth.uid(),linea_negocio,'resumen','view') or public.has_section_perm(auth.uid(),linea_negocio,'informes','view') or public.has_section_perm(auth.uid(),linea_negocio,'resultados','view'))) ;
create policy section_insert on public.equipo as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),linea_negocio,'inversiones','create')));
create policy section_update on public.equipo as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'inversiones','edit'))) with check ((public.has_section_perm(auth.uid(),linea_negocio,'inversiones','edit')));
create policy section_delete on public.equipo as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'inversiones','delete'))) ;
create policy section_select on public.socios as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'reparto_socios','view') or public.has_section_perm(auth.uid(),linea_negocio,'resumen','view') or public.has_section_perm(auth.uid(),linea_negocio,'informes','view') or public.has_section_perm(auth.uid(),linea_negocio,'resultados','view'))) ;
create policy section_insert on public.socios as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),linea_negocio,'reparto_socios','create')));
create policy section_update on public.socios as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'reparto_socios','edit'))) with check ((public.has_section_perm(auth.uid(),linea_negocio,'reparto_socios','edit')));
create policy section_delete on public.socios as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'reparto_socios','delete'))) ;
create policy section_select on public.presupuestos as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'presupuestos','view'))) ;
create policy section_insert on public.presupuestos as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),linea_negocio,'presupuestos','create')));
create policy section_update on public.presupuestos as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'presupuestos','edit'))) with check ((public.has_section_perm(auth.uid(),linea_negocio,'presupuestos','edit')));
create policy section_delete on public.presupuestos as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),linea_negocio,'presupuestos','delete'))) ;
create policy section_select on public.crm_sound_clientes as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','clientes','view'))) ;
create policy section_insert on public.crm_sound_clientes as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),'montada_sound','clientes','create')));
create policy section_update on public.crm_sound_clientes as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','clientes','edit'))) with check ((public.has_section_perm(auth.uid(),'montada_sound','clientes','edit')));
create policy section_delete on public.crm_sound_clientes as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','clientes','delete'))) ;
create policy section_select on public.crm_sound_documentos as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','clientes','view'))) ;
create policy section_insert on public.crm_sound_documentos as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),'montada_sound','clientes','create')));
create policy section_update on public.crm_sound_documentos as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','clientes','edit'))) with check ((public.has_section_perm(auth.uid(),'montada_sound','clientes','edit')));
create policy section_delete on public.crm_sound_documentos as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','clientes','delete'))) ;
create policy section_select on public.sound_leads as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','crm','view'))) ;
create policy section_insert on public.sound_leads as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),'montada_sound','crm','create')));
create policy section_update on public.sound_leads as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','crm','edit'))) with check ((public.has_section_perm(auth.uid(),'montada_sound','crm','edit')));
create policy section_delete on public.sound_leads as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','crm','delete'))) ;
create policy section_select on public.sound_contracts as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','contratos','view'))) ;
create policy section_insert on public.sound_contracts as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),'montada_sound','contratos','create')));
create policy section_update on public.sound_contracts as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','contratos','edit'))) with check ((public.has_section_perm(auth.uid(),'montada_sound','contratos','edit')));
create policy section_delete on public.sound_contracts as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),'montada_sound','contratos','delete'))) ;
create policy section_select on public.eventos as restrictive for select to authenticated using ((public.has_section_perm(auth.uid(),case when area='montada' then 'montada_sound' else 'dj' end,'ingresos','view') or public.has_section_perm(auth.uid(),case when area='montada' then 'montada_sound' else 'dj' end,'resumen','view') or public.has_section_perm(auth.uid(),case when area='montada' then 'montada_sound' else 'dj' end,'informes','view') or public.has_section_perm(auth.uid(),case when area='montada' then 'montada_sound' else 'dj' end,'resultados','view'))) ;
create policy section_insert on public.eventos as restrictive for insert to authenticated with check ((public.has_section_perm(auth.uid(),case when area='montada' then 'montada_sound' else 'dj' end,'ingresos','create')));
create policy section_update on public.eventos as restrictive for update to authenticated using ((public.has_section_perm(auth.uid(),case when area='montada' then 'montada_sound' else 'dj' end,'ingresos','edit'))) with check ((public.has_section_perm(auth.uid(),case when area='montada' then 'montada_sound' else 'dj' end,'ingresos','edit')));
create policy section_delete on public.eventos as restrictive for delete to authenticated using ((public.has_section_perm(auth.uid(),case when area='montada' then 'montada_sound' else 'dj' end,'ingresos','delete'))) ;
CREATE OR REPLACE FUNCTION public.borrar_cliente_sound(p_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if auth.uid() is null or not public.has_section_perm(auth.uid(),'montada_sound','clientes','delete') or not public.has_section_perm(auth.uid(),'montada_sound','clientes','view') then
  raise exception 'No tienes permiso para borrar clientes de Sound';
 end if;
 update public.crm_sound_clientes set eliminado_en=now() where cliente_id=p_id and eliminado_en is null;
 if not found then raise exception 'Cliente no disponible o ya borrado';end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.complete_drive_upload(p_factura_id text, p_actor uuid, p_file_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE u public.drive_uploads;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.facturas f WHERE id=p_factura_id AND public.has_section_perm(p_actor,f.linea_negocio,'facturas','edit')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Factura no autorizada.'; END IF;
 SELECT * INTO u FROM public.drive_uploads WHERE factura_id=p_factura_id AND file_id=p_file_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subida no reservada.'; END IF;
 UPDATE public.drive_uploads SET completed=true WHERE factura_id=p_factura_id;
 UPDATE public.facturas SET drive_file_id=u.file_id,drive_folder_id=u.folder_id,drive_nombre_archivo=u.nombre,
 drive_link='https://drive.google.com/file/d/'||u.file_id||'/view',drive_fecha_subida=now(),drive_subido_por=p_actor,sync_estado='sincronizada',sync_ultimo_error=NULL WHERE id=p_factura_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.crear_carpeta_sound(p_nombre text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid text:=gen_random_uuid()::text;
begin
 if auth.uid() is null or not public.has_section_perm(auth.uid(),'montada_sound','clientes','create') then raise exception 'Sin permiso';end if;
 if length(trim(coalesce(p_nombre,''))) not between 1 and 200 then raise exception 'Indica el nombre';end if;
 insert into public.clientes(id,nombre) values(cid,trim(p_nombre));
 insert into public.crm_sound_clientes(cliente_id,carpeta_cliente) values(cid,true);
 return cid;
end$function$
;
CREATE OR REPLACE FUNCTION public.crear_cliente_sound(p_nombre text, p_cliente_id text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid text;
begin
 if auth.uid() is null or not public.has_section_perm(auth.uid(),'montada_sound','clientes','create') then raise exception 'No tienes permiso para crear clientes de Sound';end if;
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
end $function$
;
CREATE OR REPLACE FUNCTION public.crear_factura_rectificativa(p_original_id text, p_motivo text, p_nueva_factura_id text, p_base_imponible numeric, p_porcentaje_iva numeric, p_importe_iva numeric, p_total numeric, p_porcentaje_facturado numeric)
 RETURNS TABLE(numero_emitido bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_orig   RECORD;
  v_linea  TEXT;
  v_serie  TEXT;
  v_numero BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado.'; END IF;
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'El motivo de la rectificación es obligatorio.';
  END IF;
  IF NOT public.has_facturacion_perm(auth.uid(), 'rectificar') THEN
    RAISE EXCEPTION 'No tienes permiso para rectificar facturas.';
  END IF;

  -- Bloqueo de la original: dos rectificaciones simultáneas se serializan y
  -- la segunda ve `estado='anulada'` y sale.
  SELECT * INTO v_orig FROM public.facturas WHERE id = p_original_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura original no encontrada.'; END IF;
  v_linea := v_orig.linea_negocio;
  IF v_linea IS NULL OR NOT public.has_section_perm(auth.uid(),v_linea,'facturas','edit') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='No tienes permiso sobre esta factura.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.facturas WHERE id=p_nueva_factura_id AND factura_rectifica_id=p_original_id) THEN
    RETURN QUERY SELECT numero_secuencial FROM public.facturas WHERE id=p_nueva_factura_id;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_orig.ingreso_id,0));
  IF p_total IS NULL OR p_total < 0 OR p_total > v_orig.total OR p_total::text IN ('NaN','Infinity','-Infinity')
     OR p_base_imponible IS NULL OR p_importe_iva IS NULL OR p_porcentaje_facturado IS NULL
     OR p_porcentaje_iva IS DISTINCT FROM v_orig.porcentaje_iva
     OR p_base_imponible <> round(p_total/(1+p_porcentaje_iva/100),2)
     OR p_importe_iva <> p_total-p_base_imponible
     OR (v_orig.ingreso_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ingresos WHERE id=v_orig.ingreso_id AND total>0 AND p_porcentaje_facturado=round(p_total/total*100,2))) OR (v_orig.ingreso_id IS NULL AND p_porcentaje_facturado<>0) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Importes de rectificación no válidos.';
  END IF;
  IF v_orig.estado = 'anulada' THEN RAISE EXCEPTION 'Esta factura ya está anulada.'; END IF;
  IF v_orig.numero_secuencial IS NULL THEN
    RAISE EXCEPTION 'Solo se rectifican facturas ya emitidas (esta no tiene número).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.facturas WHERE id = p_nueva_factura_id) THEN
    RAISE EXCEPTION 'Ya existe una factura con el id %.', p_nueva_factura_id;
  END IF;

  -- [FIX-4] Permiso de línea, derivado del ingreso real de la original.
  v_linea := coalesce(public.linea_de_ingreso(v_orig.ingreso_id),v_orig.linea_negocio);
  IF v_linea IS NOT NULL AND NOT public.has_section_perm(auth.uid(),v_linea,'facturas','edit') THEN
    RAISE EXCEPTION 'No tienes permiso para rectificar facturas de la línea %.', v_linea;
  END IF;

  -- [FIX-8] Emisor y serie: los de la ORIGINAL, leídos del registro.
  IF v_orig.emisor_id IS NULL THEN
    RAISE EXCEPTION 'La factura original no tiene emisor registrado — no se puede rectificar con seguridad.';
  END IF;
  v_serie := COALESCE(v_orig.serie, '');

  PERFORM 1 FROM public.numeracion_contador
   WHERE emisor_id = v_orig.emisor_id AND serie = v_serie FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe contador para el emisor % (serie "%").', v_orig.emisor_id, v_serie;
  END IF;

  UPDATE public.numeracion_contador SET ultimo_numero = ultimo_numero + 1
   WHERE emisor_id = v_orig.emisor_id AND serie = v_serie
   RETURNING ultimo_numero INTO v_numero;

  INSERT INTO public.numeracion_log (numero, emisor_id, serie, factura_id, user_id)
  VALUES (v_numero, v_orig.emisor_id, v_serie, p_nueva_factura_id, auth.uid());

  PERFORM set_config('app.facturacion_privilegiada', 'on', true);

  -- La original conserva TODOS sus importes y su número. Solo se anula.
  UPDATE public.facturas SET
    estado = 'anulada', anulada_por = auth.uid(), fecha_anulacion = now(),
    motivo_anulacion = p_motivo,
    historial = COALESCE(historial, '[]'::jsonb) || jsonb_build_object(
      'fecha', now(), 'usuarioId', auth.uid(), 'accion', 'anulada', 'detalle', p_motivo)
  WHERE id = p_original_id;

  INSERT INTO public.facturas (
    id, area, tipo, numero, numero_secuencial, serie, emisor_id, cliente, concepto,
    base_imponible, porcentaje_iva, importe_iva, total, fecha, pagada, iva_deducible,
    ingreso_id, linea_negocio, estado, porcentaje_facturado, fecha_emision, emitida_por,
    emisor_snapshot, cliente_snapshot, factura_rectifica_id, notas
  ) VALUES (
    p_nueva_factura_id, v_orig.area, v_orig.tipo, v_numero::text, v_numero, v_serie, v_orig.emisor_id,
    v_orig.cliente, 'Rectificación de la factura ' || v_orig.numero || ': ' || p_motivo,
    p_base_imponible, p_porcentaje_iva, p_importe_iva, p_total,
    to_char(CURRENT_DATE, 'YYYY-MM-DD'),          -- [FIX-1] `fecha` es TEXT
    false, v_orig.iva_deducible,
    v_orig.ingreso_id, v_orig.linea_negocio, 'emitida', p_porcentaje_facturado, now(), auth.uid(),
    v_orig.emisor_snapshot, v_orig.cliente_snapshot, p_original_id, p_motivo
  );

  PERFORM set_config('app.facturacion_privilegiada', 'off', true);

  RETURN QUERY SELECT v_numero;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.document_entity_permission(p_type text, p_id text, p_action text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE l text;
BEGIN
 CASE p_type
 WHEN 'ingreso' THEN SELECT linea_negocio INTO l FROM public.ingresos WHERE id=p_id;
 WHEN 'gasto' THEN SELECT linea_negocio INTO l FROM public.gastos WHERE id=p_id;
 WHEN 'factura' THEN SELECT linea_negocio INTO l FROM public.facturas WHERE id=p_id;
 WHEN 'equipo' THEN SELECT linea_negocio INTO l FROM public.equipo WHERE id=p_id;
 WHEN 'evento' THEN SELECT 'montada_sound' INTO l FROM public.eventos WHERE id=p_id;
 ELSE RETURN false;
 END CASE;
 RETURN l IS NOT NULL AND public.has_section_perm(auth.uid(),l,case p_type when 'ingreso' then 'ingresos' when 'gasto' then 'gastos' when 'factura' then 'facturas' when 'equipo' then 'inversiones' when 'evento' then 'calendario' end,p_action);
END $function$
;
CREATE OR REPLACE FUNCTION public.editar_factura_emitida(p_id text, p_numero bigint, p_fecha date, p_fecha_evento date, p_cliente text, p_concepto text, p_base_imponible numeric, p_porcentaje_iva numeric, p_importe_iva numeric, p_total numeric, p_notas text, p_datos_cliente jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare f public.facturas; part text[]; base numeric:=0; suplidos numeric:=0; rows_count integer:=0; client jsonb;
begin
 select * into f from public.facturas where id=p_id for update;
 if not found or auth.uid() is null or f.linea_negocio is null
 or not coalesce(public.has_section_perm(auth.uid(),f.linea_negocio,'facturas','edit'),false)
 or not coalesce(public.has_facturacion_perm(auth.uid(),'emitir'),false) then
  raise exception using errcode='42501',message='Sin permiso para editar esta factura.';
 end if;
 if f.tipo<>'emitida' or f.numero_secuencial is null or f.oculta_en is not null then raise exception 'Esta factura no admite edición.';end if;
 if p_numero is null or p_numero<1 or p_numero>9007199254740991 then raise exception 'Indica un número entero positivo.';end if;
 if p_numero<>f.numero_secuencial and not coalesce(public.has_facturacion_perm(auth.uid(),'gestionar_numeracion'),false) then
  raise exception using errcode='42501',message='Sin permiso para cambiar la numeración.';
 end if;
 if p_fecha is null or nullif(trim(p_cliente),'') is null or jsonb_typeof(p_datos_cliente) is distinct from 'object'
 or length(trim(coalesce(p_datos_cliente->>'nombre',''))) not between 1 and 200
 or length(trim(coalesce(p_datos_cliente->>'nifCif',''))) not between 1 and 40
 or length(trim(coalesce(p_datos_cliente->>'direccion',''))) not between 1 and 1000
 or trim(p_cliente) is distinct from trim(p_datos_cliente->>'nombre') then raise exception 'Completa los datos fiscales del cliente y la fecha.';end if;
 -- Verify every serialized line and compute the same rounded amounts as invoiceAmounts().
 if p_concepto is null or length(p_concepto)>100000 or p_concepto !~ E'^.+\\n\\[' then raise exception 'Conceptos no válidos.';end if;
 for part in select regexp_matches(p_concepto,E'([^\\x01]+?)\\n\\[([0-9]+(?:\\.[0-9]+)?) x ([0-9]+(?:\\.[0-9]+)?) EUR; descuento/u ([0-9]+(?:\\.[0-9]+)?) EUR; total ([0-9]+(?:\\.[0-9]+)?) EUR(; suplido)?\\](?:\\n\\n|$)','g') loop
  rows_count:=rows_count+1;
  if trim(part[1])='' or part[2]::numeric<=0 or part[4]::numeric>part[3]::numeric
   or part[3]::numeric<>round(part[3]::numeric,2) or part[4]::numeric<>round(part[4]::numeric,2)
   or part[5]::numeric<>round(part[2]::numeric*(part[3]::numeric-part[4]::numeric),2) then raise exception 'Importes de concepto no válidos.';end if;
  if part[6] is not null then suplidos:=suplidos+part[5]::numeric;else base:=base+part[5]::numeric;end if;
 end loop;
 if rows_count not between 1 and 100 or right(p_concepto,1)<>']'
 or p_base_imponible is distinct from base or p_porcentaje_iva is null or p_porcentaje_iva not in (0,4,10,21)
 or p_importe_iva is distinct from round(base*p_porcentaje_iva/100,2)
 or p_total is distinct from base+p_importe_iva+suplidos or p_total<=0 then raise exception 'Los conceptos y los importes no coinciden.';end if;
 if p_numero<>f.numero_secuencial then
  perform 1 from public.numeracion_contador where emisor_id=f.emisor_id and serie=coalesce(f.serie,'') for update;
  if not found then raise exception 'No se encontró el contador de este emisor.';end if;
  if exists(select 1 from public.facturas where emisor_id=f.emisor_id and coalesce(serie,'')=coalesce(f.serie,'') and numero_secuencial=p_numero and id<>p_id)
   or exists(select 1 from public.numeracion_log where emisor_id=f.emisor_id and coalesce(serie,'')=coalesce(f.serie,'') and numero=p_numero and factura_id is distinct from p_id)
   or (f.emisor_id='default' and coalesce(f.serie,'')='' and exists(select 1 from public.drive_invoice_files where tipo='emitida' and numero=p_numero and id is distinct from f.drive_file_id)) then
   raise exception using errcode='23505',message='Ese número ya está utilizado, aunque la factura se haya eliminado del listado.';
  end if;
  insert into public.numeracion_log(numero,emisor_id,serie,factura_id,user_id) values(f.numero_secuencial,f.emisor_id,coalesce(f.serie,''),p_id,auth.uid()) on conflict(emisor_id,serie,numero) do nothing;
  insert into public.numeracion_log(numero,emisor_id,serie,factura_id,user_id) values(p_numero,f.emisor_id,coalesce(f.serie,''),p_id,auth.uid()) on conflict(emisor_id,serie,numero) do nothing;
  update public.numeracion_contador set ultimo_numero=greatest(ultimo_numero,p_numero) where emisor_id=f.emisor_id and serie=coalesce(f.serie,'');
 end if;
 client:=coalesce(f.cliente_snapshot,'{}'::jsonb)||p_datos_cliente||jsonb_build_object('nombre',trim(p_cliente),'nif_cif',trim(p_datos_cliente->>'nifCif'));
 -- Remove the reservation for the old PDF so a corrected document can be uploaded.
 -- No remote Drive file is deleted. A stale completion cannot reuse this reservation.
 delete from public.drive_uploads where factura_id=p_id;
 update public.facturas set numero=p_numero::text,numero_secuencial=p_numero,numero_solicitado=p_numero,
 fecha=p_fecha,fecha_evento=p_fecha_evento,cliente=trim(p_cliente),concepto=p_concepto,
 base_imponible=p_base_imponible,porcentaje_iva=p_porcentaje_iva,importe_iva=p_importe_iva,total=p_total,notas=p_notas,
 cliente_snapshot=client,drive_file_id=null,drive_folder_id=null,drive_link=null,drive_nombre_archivo=null,drive_fecha_subida=null,drive_subido_por=null,
 sync_estado='sin_sincronizar',sync_ultimo_error=null,
 historial=coalesce(historial,'[]'::jsonb)||jsonb_build_object('fecha',now(),'usuarioId',auth.uid(),'accion','factura_editada','detalle',format('Factura %s → %s; total %s → %s. Archivo Drive anterior: %s',f.numero,p_numero,f.total,p_total,coalesce(f.drive_file_id,'ninguno')))
 where id=p_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.editar_numero_factura(p_id text, p_numero bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare f public.facturas;
begin
 select * into f from public.facturas where id=p_id for update;
 if not found or auth.uid() is null or f.linea_negocio is null
 or not public.has_section_perm(auth.uid(),f.linea_negocio,'facturas','edit')
 or not public.has_facturacion_perm(auth.uid(),'gestionar_numeracion') then
  raise exception using errcode='42501',message='Sin permiso para editar la numeración.';
 end if;
 if f.tipo<>'emitida' or f.numero_secuencial is null or f.estado='anulada' or f.oculta_en is not null then raise exception 'Esta factura no admite cambios de numeración.'; end if;
 if p_numero is null or p_numero<1 or p_numero>9007199254740991 then raise exception 'Indica un número entero positivo.'; end if;
 if p_numero=f.numero_secuencial then return; end if;
 if f.drive_file_id is not null or coalesce(f.enviada,false) then raise exception 'La factura ya está enviada o en Drive. Debe corregirse mediante rectificación para no dejar documentos distintos con la misma identidad.'; end if;
 perform 1 from public.numeracion_contador where emisor_id=f.emisor_id and serie=coalesce(f.serie,'') for update;
 if not found then raise exception 'No se encontró el contador de este emisor.'; end if;
 if exists(select 1 from public.facturas where emisor_id=f.emisor_id and coalesce(serie,'')=coalesce(f.serie,'') and numero_secuencial=p_numero and id<>p_id)
 or exists(select 1 from public.numeracion_log where emisor_id=f.emisor_id and coalesce(serie,'')=coalesce(f.serie,'') and numero=p_numero and factura_id<>p_id)
 or (f.emisor_id='default' and coalesce(f.serie,'')='' and exists(select 1 from public.drive_invoice_files where tipo='emitida' and numero=p_numero)) then
  raise exception using errcode='23505',message='Ese número ya está utilizado, aunque la factura se haya eliminado del listado.';
 end if;
 insert into public.numeracion_log(numero,emisor_id,serie,factura_id,user_id) values(p_numero,f.emisor_id,coalesce(f.serie,''),p_id,auth.uid()) on conflict(emisor_id,serie,numero) do nothing;
 update public.numeracion_contador set ultimo_numero=greatest(ultimo_numero,p_numero) where emisor_id=f.emisor_id and serie=coalesce(f.serie,'');
 update public.facturas set numero=p_numero::text,numero_secuencial=p_numero,numero_solicitado=p_numero,
 historial=coalesce(historial,'[]'::jsonb)||jsonb_build_object('fecha',now(),'usuarioId',auth.uid(),'accion','numero_editado','detalle',format('Número %s cambiado a %s',f.numero,p_numero)) where id=p_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.emitir_factura_con_datos_fiscales(p_factura_id text, p_area text, p_tipo text, p_cliente text, p_concepto text, p_base_imponible numeric, p_porcentaje_iva numeric, p_importe_iva numeric, p_total numeric, p_fecha text, p_ingreso_id text, p_porcentaje_facturado numeric, p_notas text, p_datos_cliente jsonb)
 RETURNS TABLE(numero_emitido bigint, emisor_asignado text, serie_asignada text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_factura   RECORD;
  v_linea     TEXT;
  v_emisor_id TEXT;
  v_serie     TEXT;
  v_numero    BIGINT;
  v_emisor    JSONB;
  v_cliente   JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  -- [FIX-3] Bloqueo de la fila de la factura ANTES de nada. Una segunda
  -- llamada concurrente con el mismo id espera aquí; cuando entra, ya ve el
  -- `numero_secuencial` escrito por la primera y sale por idempotencia.
  SELECT * INTO v_factura FROM public.facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura % no existe — créala como borrador antes de emitir.', p_factura_id;
  END IF;

  v_linea := public.linea_de_ingreso(v_factura.ingreso_id);
  IF NOT public.has_facturacion_perm(auth.uid(),'emitir') OR v_linea IS NULL
     OR NOT public.has_section_perm(auth.uid(),v_linea,'facturas','create')
     OR p_ingreso_id IS DISTINCT FROM v_factura.ingreso_id THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='No tienes permiso sobre esta factura o su ingreso.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_factura.ingreso_id,0));
  PERFORM 1 FROM public.ingresos WHERE id=v_factura.ingreso_id FOR SHARE;
  IF v_factura.numero_secuencial IS NOT NULL THEN
    RETURN QUERY SELECT v_factura.numero_secuencial, v_factura.emisor_id, COALESCE(v_factura.serie, '');
    RETURN;
  END IF;

  IF v_factura.tipo <> 'emitida' THEN
    RAISE EXCEPTION 'Solo se numeran facturas emitidas (esta es de tipo %).', v_factura.tipo;
  END IF;

  IF NOT public.has_facturacion_perm(auth.uid(), 'emitir') THEN
    RAISE EXCEPTION 'No tienes permiso para emitir facturas.';
  END IF;

  -- [FIX-4] Línea DERIVADA del ingreso real, no enviada por el navegador.
  v_linea := public.linea_de_ingreso(v_factura.ingreso_id);
  IF v_linea IS NULL THEN
    RAISE EXCEPTION 'No se puede determinar la línea de negocio: la factura debe estar vinculada a un ingreso existente.';
  END IF;
  IF NOT public.has_section_perm(auth.uid(),v_linea,'facturas','create') THEN
    RAISE EXCEPTION 'No tienes permiso para emitir facturas en la línea %.', v_linea;
  END IF;

  -- [FIX-4] Emisor DERIVADO de la asignación del proyecto, no del cliente.
  v_emisor_id := public.emisor_de_linea(v_linea);
  IF v_emisor_id IS NULL THEN
    RAISE EXCEPTION 'La línea % no tiene ningún emisor fiscal activo asignado. Asígnalo en Administración antes de emitir.', v_linea;
  END IF;

  SELECT to_jsonb(cf) INTO v_emisor FROM public.configuracion_fiscal cf WHERE cf.id = v_emisor_id;
  IF NULLIF(trim(COALESCE(v_emisor->>'razon_social','')), '') IS NULL
     OR NULLIF(trim(COALESCE(v_emisor->>'nif_cif','')), '') IS NULL THEN
    RAISE EXCEPTION 'Faltan datos fiscales obligatorios del emisor % (razón social / NIF-CIF).', v_emisor_id;
  END IF;
  v_serie := COALESCE(v_factura.serie, '');

  IF jsonb_typeof(p_datos_cliente) IS DISTINCT FROM 'object'
     OR length(trim(coalesce(p_datos_cliente->>'nombre',''))) NOT BETWEEN 1 AND 200
     OR length(trim(coalesce(p_datos_cliente->>'nifCif',''))) NOT BETWEEN 1 AND 40
     OR length(trim(coalesce(p_datos_cliente->>'direccion',''))) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Completa nombre o razón social, NIF/CIF y dirección fiscal del cliente en la factura.';
  END IF;
  v_cliente := jsonb_build_object('nombre',trim(p_datos_cliente->>'nombre'),
    'nif_cif',trim(p_datos_cliente->>'nifCif'),'direccion',trim(p_datos_cliente->>'direccion'),
    'email',left(coalesce(p_datos_cliente->>'email',''),250),'telefono',left(coalesce(p_datos_cliente->>'telefono',''),50));


  IF p_porcentaje_facturado IS NULL OR p_porcentaje_facturado <= 0 OR p_porcentaje_facturado > 100
     OR p_porcentaje_facturado::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Porcentaje no válido.';
  END IF;
  IF p_tipo <> 'emitida' OR p_area IS DISTINCT FROM v_factura.area OR trim(COALESCE(p_concepto,''))='' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Datos de factura no válidos.';
  END IF;
  IF v_cliente IS NULL OR NULLIF(trim(v_cliente->>'nif_cif'),'') IS NULL OR NULLIF(trim(v_cliente->>'direccion'),'') IS NULL
     OR NULLIF(trim(v_emisor->>'direccion_fiscal'),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Completa los datos fiscales de emisor y cliente (NIF y dirección).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ingresos i WHERE i.id=v_factura.ingreso_id
     AND i.cliente=p_cliente AND i.area=p_area AND i.base_imponible>0
     AND p_base_imponible=round(i.base_imponible*p_porcentaje_facturado/100,2)
     AND p_porcentaje_iva=i.porcentaje_iva
     AND p_importe_iva=round(p_base_imponible*i.porcentaje_iva/100,2)
     AND p_total=p_base_imponible+p_importe_iva) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Los importes no coinciden con el ingreso y el porcentaje.';
  END IF;
  PERFORM p_fecha::date;
  -- [FIX-7] Alta atómica de la fila del contador y luego bloqueo.
  INSERT INTO public.numeracion_contador (emisor_id, serie, ultimo_numero, confirmado)
  VALUES (v_emisor_id, v_serie, 0, false)
  ON CONFLICT (emisor_id, serie) DO NOTHING;

  PERFORM 1 FROM public.numeracion_contador
   WHERE emisor_id = v_emisor_id AND serie = v_serie FOR UPDATE;

  IF NOT (SELECT confirmado FROM public.numeracion_contador
           WHERE emisor_id = v_emisor_id AND serie = v_serie) THEN
    RAISE EXCEPTION 'La numeración del emisor % (serie "%") no ha sido confirmada por un administrador.', v_emisor_id, v_serie;
  END IF;

  UPDATE public.numeracion_contador
     SET ultimo_numero = greatest(ultimo_numero,coalesce((select max(numero_secuencial) from public.facturas where emisor_id=v_emisor_id and coalesce(serie,'')=v_serie),0),case when v_emisor_id='default' and v_serie='' then coalesce((select max(numero) from public.drive_invoice_files where tipo='emitida'),0) else 0 end) + 1
   WHERE emisor_id = v_emisor_id AND serie = v_serie
   RETURNING ultimo_numero INTO v_numero;

  INSERT INTO public.numeracion_log (numero, emisor_id, serie, factura_id, user_id)
  VALUES (v_numero, v_emisor_id, v_serie, p_factura_id, auth.uid());

  -- [FIX-6] Marca de operación privilegiada: deja pasar ESTE update ante el
  -- trigger de inmutabilidad, y solo este.
  PERFORM set_config('app.facturacion_privilegiada', 'on', true);

  UPDATE public.facturas SET
    numero = v_numero::text, numero_secuencial = v_numero,
    emisor_id = v_emisor_id, serie = v_serie,
    area = p_area, tipo = p_tipo, cliente = p_cliente, concepto = p_concepto,
    base_imponible = p_base_imponible, porcentaje_iva = p_porcentaje_iva,
    importe_iva = p_importe_iva, total = p_total, fecha = p_fecha,
    ingreso_id = COALESCE(p_ingreso_id, ingreso_id),
    porcentaje_facturado = p_porcentaje_facturado,
    notas = p_notas, linea_negocio = v_linea, estado = 'emitida',
    fecha_emision = now(), emitida_por = auth.uid(),
    emisor_snapshot = v_emisor, cliente_snapshot = v_cliente,
    historial = COALESCE(historial, '[]'::jsonb) || jsonb_build_object(
      'fecha', now(), 'usuarioId', auth.uid(), 'accion', 'emitida',
      'detalle', format('Nº %s · emisor %s · línea %s', v_numero, v_emisor_id, v_linea))
  WHERE id = p_factura_id;

  PERFORM set_config('app.facturacion_privilegiada', 'off', true);

  RETURN QUERY SELECT v_numero, v_emisor_id, v_serie;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.emitir_factura_independiente(p_factura_id text, p_area text, p_tipo text, p_cliente text, p_concepto text, p_base_imponible numeric, p_porcentaje_iva numeric, p_importe_iva numeric, p_total numeric, p_fecha text, p_ingreso_id text, p_porcentaje_facturado numeric, p_notas text, p_datos_cliente jsonb, p_numero_solicitado bigint DEFAULT NULL::bigint, p_fecha_evento text DEFAULT NULL::text)
 RETURNS TABLE(numero_emitido bigint, emisor_asignado text, serie_asignada text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_factura   RECORD;
  v_linea     TEXT;
  v_emisor_id TEXT;
  v_serie     TEXT;
  v_numero    BIGINT;
  v_ultimo BIGINT;
  v_emisor    JSONB;
  v_cliente   JSONB;
  v_suplidos numeric := 0;
  v_part text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  -- [FIX-3] Bloqueo de la fila de la factura ANTES de nada. Una segunda
  -- llamada concurrente con el mismo id espera aquí; cuando entra, ya ve el
  -- `numero_secuencial` escrito por la primera y sale por idempotencia.
  SELECT * INTO v_factura FROM public.facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura % no existe — créala como borrador antes de emitir.', p_factura_id;
  END IF;

  v_linea := v_factura.linea_negocio;
  IF NOT public.has_facturacion_perm(auth.uid(),'emitir') OR v_linea IS NULL
     OR NOT public.has_section_perm(auth.uid(),v_linea,'facturas','create')
     OR p_ingreso_id IS DISTINCT FROM v_factura.ingreso_id
     OR (v_factura.ingreso_id IS NOT NULL AND public.linea_de_ingreso(v_factura.ingreso_id) IS DISTINCT FROM v_linea) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='No tienes permiso sobre esta factura o su ingreso.';
  END IF;

  IF v_factura.numero_secuencial IS NOT NULL THEN
    RETURN QUERY SELECT v_factura.numero_secuencial, v_factura.emisor_id, COALESCE(v_factura.serie, '');
    RETURN;
  END IF;

  IF v_factura.ingreso_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_factura.ingreso_id,0));
    PERFORM 1 FROM public.ingresos WHERE id=v_factura.ingreso_id FOR SHARE;
    IF EXISTS (SELECT 1 FROM public.facturas other WHERE other.ingreso_id=v_factura.ingreso_id
      AND other.id<>p_factura_id AND other.tipo='emitida' AND other.numero_secuencial IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Este ingreso ya tiene una factura emitida. Abre la factura existente para editarla.';
    END IF;
  END IF;
  IF v_factura.tipo <> 'emitida' THEN
    RAISE EXCEPTION 'Solo se numeran facturas emitidas (esta es de tipo %).', v_factura.tipo;
  END IF;

  IF NOT public.has_facturacion_perm(auth.uid(), 'emitir') THEN
    RAISE EXCEPTION 'No tienes permiso para emitir facturas.';
  END IF;

  -- [FIX-4] Línea DERIVADA del ingreso real, no enviada por el navegador.
  v_linea := v_factura.linea_negocio;
  IF v_linea IS NULL THEN
    RAISE EXCEPTION 'No se puede determinar la línea de negocio: la factura debe estar vinculada a un ingreso existente.';
  END IF;
  IF NOT public.has_section_perm(auth.uid(),v_linea,'facturas','create') THEN
    RAISE EXCEPTION 'No tienes permiso para emitir facturas en la línea %.', v_linea;
  END IF;

  -- [FIX-4] Emisor DERIVADO de la asignación del proyecto, no del cliente.
  v_emisor_id := public.emisor_de_linea(v_linea);
  IF v_emisor_id IS NULL THEN
    RAISE EXCEPTION 'La línea % no tiene ningún emisor fiscal activo asignado. Asígnalo en Administración antes de emitir.', v_linea;
  END IF;

  SELECT to_jsonb(cf) INTO v_emisor FROM public.configuracion_fiscal cf WHERE cf.id = v_emisor_id;
  IF NULLIF(trim(COALESCE(v_emisor->>'razon_social','')), '') IS NULL
     OR NULLIF(trim(COALESCE(v_emisor->>'nif_cif','')), '') IS NULL THEN
    RAISE EXCEPTION 'Faltan datos fiscales obligatorios del emisor % (razón social / NIF-CIF).', v_emisor_id;
  END IF;
  v_serie := COALESCE(v_emisor->>'serie_formato','');

  IF jsonb_typeof(p_datos_cliente) IS DISTINCT FROM 'object'
     OR length(trim(coalesce(p_datos_cliente->>'nombre',''))) NOT BETWEEN 1 AND 200
     OR length(trim(coalesce(p_datos_cliente->>'nifCif',''))) NOT BETWEEN 1 AND 40
     OR length(trim(coalesce(p_datos_cliente->>'direccion',''))) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Completa nombre o razón social, NIF/CIF y dirección fiscal del cliente en la factura.';
  END IF;
  v_cliente := jsonb_build_object('nombre',trim(p_datos_cliente->>'nombre'),
    'nif_cif',trim(p_datos_cliente->>'nifCif'),'direccion',trim(p_datos_cliente->>'direccion'),
    'email',left(coalesce(p_datos_cliente->>'email',''),250),'telefono',left(coalesce(p_datos_cliente->>'telefono',''),50),
    'referenciaFactura',trim(coalesce(p_datos_cliente->>'referenciaFactura','')));


  IF p_porcentaje_facturado IS NULL OR p_porcentaje_facturado <= 0 OR p_porcentaje_facturado > 100
     OR p_porcentaje_facturado::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Porcentaje no válido.';
  END IF;
  IF p_tipo <> 'emitida' OR p_area IS DISTINCT FROM v_factura.area OR trim(COALESCE(p_concepto,''))='' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Datos de factura no válidos.';
  END IF;
  IF v_cliente IS NULL OR NULLIF(trim(v_cliente->>'nif_cif'),'') IS NULL OR NULLIF(trim(v_cliente->>'direccion'),'') IS NULL
     OR NULLIF(trim(v_emisor->>'direccion_fiscal'),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Completa los datos fiscales de emisor y cliente (NIF y dirección).';
  END IF;
  -- Suplidos are preserved with each concept; derive their amount server-side.
  FOR v_part IN SELECT regexp_matches(p_concepto, E'\\n\\[([0-9.]+) x ([0-9.]+) EUR; descuento/u ([0-9.]+) EUR; total ([0-9.]+) EUR; suplido\\]', 'g') LOOP
    IF v_part[1]::numeric<=0 OR v_part[2]::numeric<0 OR v_part[3]::numeric<0
       OR v_part[3]::numeric>v_part[2]::numeric
       OR v_part[4]::numeric<>round(v_part[1]::numeric*(v_part[2]::numeric-v_part[3]::numeric),2) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Importe de suplido no válido';
    END IF;
    v_suplidos:=v_suplidos+v_part[4]::numeric;
  END LOOP;
  IF p_porcentaje_facturado<>100 OR p_base_imponible IS NULL OR p_base_imponible<0 OR p_total<=0
     OR p_base_imponible::text IN ('NaN','Infinity','-Infinity') OR p_base_imponible<>round(p_base_imponible,2)
     OR p_porcentaje_iva IS NULL OR p_porcentaje_iva NOT IN (0,4,10,21)
     OR p_importe_iva IS DISTINCT FROM round(p_base_imponible*p_porcentaje_iva/100,2)
     OR p_total IS DISTINCT FROM p_base_imponible+p_importe_iva+v_suplidos OR length(trim(coalesce(p_cliente,'')))=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Importes o datos de factura no válidos';
  END IF;
  PERFORM p_fecha::date;
  -- [FIX-7] Alta atómica de la fila del contador y luego bloqueo.
  INSERT INTO public.numeracion_contador (emisor_id, serie, ultimo_numero, confirmado)
  VALUES (v_emisor_id, v_serie, 0, false)
  ON CONFLICT (emisor_id, serie) DO NOTHING;

  PERFORM 1 FROM public.numeracion_contador
   WHERE emisor_id = v_emisor_id AND serie = v_serie FOR UPDATE;

  IF NOT (SELECT confirmado FROM public.numeracion_contador
           WHERE emisor_id = v_emisor_id AND serie = v_serie) THEN
    RAISE EXCEPTION 'La numeración del emisor % (serie "%") no ha sido confirmada por un administrador.', v_emisor_id, v_serie;
  END IF;

  SELECT greatest(ultimo_numero,
    coalesce((select max(numero_secuencial) from public.facturas where emisor_id=v_emisor_id and coalesce(serie,'')=v_serie),0),
    coalesce((select max(numero) from public.numeracion_log where emisor_id=v_emisor_id and coalesce(serie,'')=v_serie),0),
    case when v_emisor_id='default' and v_serie='' then coalesce((select max(numero) from public.drive_invoice_files where tipo='emitida'),0) else 0 end)
    INTO v_ultimo FROM public.numeracion_contador WHERE emisor_id=v_emisor_id AND serie=v_serie;
  IF p_numero_solicitado IS NOT NULL THEN
    IF NOT public.has_facturacion_perm(auth.uid(),'gestionar_numeracion') THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='No tienes permiso para elegir la numeración.';
    END IF;
    IF p_numero_solicitado<=v_ultimo OR p_numero_solicitado>9007199254740991 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE=format('El número debe ser superior al último utilizado (%s), incluidas las facturas eliminadas. La siguiente automática es %s.',v_ultimo,v_ultimo+1);
    END IF;
  END IF;
  IF nullif(trim(p_fecha_evento),'') IS NOT NULL THEN PERFORM p_fecha_evento::date; END IF;
  v_numero:=coalesce(p_numero_solicitado,v_ultimo+1);
  UPDATE public.numeracion_contador SET ultimo_numero=v_numero WHERE emisor_id=v_emisor_id AND serie=v_serie;

  INSERT INTO public.numeracion_log (numero, emisor_id, serie, factura_id, user_id)
  VALUES (v_numero, v_emisor_id, v_serie, p_factura_id, auth.uid());

  -- [FIX-6] Marca de operación privilegiada: deja pasar ESTE update ante el
  -- trigger de inmutabilidad, y solo este.
  PERFORM set_config('app.facturacion_privilegiada', 'on', true);

  UPDATE public.facturas SET
    numero = v_numero::text, numero_secuencial = v_numero,
    numero_solicitado=p_numero_solicitado, fecha_evento=nullif(trim(p_fecha_evento),'')::date,
    emisor_id = v_emisor_id, serie = v_serie,
    area = p_area, tipo = p_tipo, cliente = p_cliente, concepto = p_concepto,
    base_imponible = p_base_imponible, porcentaje_iva = p_porcentaje_iva,
    importe_iva = p_importe_iva, total = p_total, fecha = p_fecha,
    ingreso_id = COALESCE(p_ingreso_id, ingreso_id),
    porcentaje_facturado = p_porcentaje_facturado,
    notas = p_notas, linea_negocio = v_linea, estado = 'emitida',
    fecha_emision = now(), emitida_por = auth.uid(),
    emisor_snapshot = v_emisor, cliente_snapshot = v_cliente,
    historial = COALESCE(historial, '[]'::jsonb) || jsonb_build_object(
      'fecha', now(), 'usuarioId', auth.uid(), 'accion', 'emitida',
      'detalle', format('Nº %s · emisor %s · línea %s', v_numero, v_emisor_id, v_linea))
  WHERE id = p_factura_id;

  PERFORM set_config('app.facturacion_privilegiada', 'off', true);

  RETURN QUERY SELECT v_numero, v_emisor_id, v_serie;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.emitir_numero_factura(p_factura_id text, p_area text, p_tipo text, p_cliente text, p_concepto text, p_base_imponible numeric, p_porcentaje_iva numeric, p_importe_iva numeric, p_total numeric, p_fecha text, p_ingreso_id text, p_porcentaje_facturado numeric, p_notas text DEFAULT NULL::text)
 RETURNS TABLE(numero_emitido bigint, emisor_asignado text, serie_asignada text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_factura   RECORD;
  v_linea     TEXT;
  v_emisor_id TEXT;
  v_serie     TEXT;
  v_numero    BIGINT;
  v_emisor    JSONB;
  v_cliente   JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  -- [FIX-3] Bloqueo de la fila de la factura ANTES de nada. Una segunda
  -- llamada concurrente con el mismo id espera aquí; cuando entra, ya ve el
  -- `numero_secuencial` escrito por la primera y sale por idempotencia.
  SELECT * INTO v_factura FROM public.facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura % no existe — créala como borrador antes de emitir.', p_factura_id;
  END IF;

  v_linea := public.linea_de_ingreso(v_factura.ingreso_id);
  IF NOT public.has_facturacion_perm(auth.uid(),'emitir') OR v_linea IS NULL
     OR NOT public.has_section_perm(auth.uid(),v_linea,'facturas','create')
     OR p_ingreso_id IS DISTINCT FROM v_factura.ingreso_id THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='No tienes permiso sobre esta factura o su ingreso.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_factura.ingreso_id,0));
  PERFORM 1 FROM public.ingresos WHERE id=v_factura.ingreso_id FOR SHARE;
  IF v_factura.numero_secuencial IS NOT NULL THEN
    RETURN QUERY SELECT v_factura.numero_secuencial, v_factura.emisor_id, COALESCE(v_factura.serie, '');
    RETURN;
  END IF;

  IF v_factura.tipo <> 'emitida' THEN
    RAISE EXCEPTION 'Solo se numeran facturas emitidas (esta es de tipo %).', v_factura.tipo;
  END IF;

  IF NOT public.has_facturacion_perm(auth.uid(), 'emitir') THEN
    RAISE EXCEPTION 'No tienes permiso para emitir facturas.';
  END IF;

  -- [FIX-4] Línea DERIVADA del ingreso real, no enviada por el navegador.
  v_linea := public.linea_de_ingreso(v_factura.ingreso_id);
  IF v_linea IS NULL THEN
    RAISE EXCEPTION 'No se puede determinar la línea de negocio: la factura debe estar vinculada a un ingreso existente.';
  END IF;
  IF NOT public.has_section_perm(auth.uid(),v_linea,'facturas','create') THEN
    RAISE EXCEPTION 'No tienes permiso para emitir facturas en la línea %.', v_linea;
  END IF;

  -- [FIX-4] Emisor DERIVADO de la asignación del proyecto, no del cliente.
  v_emisor_id := public.emisor_de_linea(v_linea);
  IF v_emisor_id IS NULL THEN
    RAISE EXCEPTION 'La línea % no tiene ningún emisor fiscal activo asignado. Asígnalo en Administración antes de emitir.', v_linea;
  END IF;

  SELECT to_jsonb(cf) INTO v_emisor FROM public.configuracion_fiscal cf WHERE cf.id = v_emisor_id;
  IF NULLIF(trim(COALESCE(v_emisor->>'razon_social','')), '') IS NULL
     OR NULLIF(trim(COALESCE(v_emisor->>'nif_cif','')), '') IS NULL THEN
    RAISE EXCEPTION 'Faltan datos fiscales obligatorios del emisor % (razón social / NIF-CIF).', v_emisor_id;
  END IF;
  v_serie := COALESCE(v_factura.serie, '');

  SELECT to_jsonb(c) INTO v_cliente FROM public.clientes c
   WHERE lower(trim(c.nombre)) = lower(trim(p_cliente)) LIMIT 1;

  IF p_porcentaje_facturado IS NULL OR p_porcentaje_facturado <= 0 OR p_porcentaje_facturado > 100
     OR p_porcentaje_facturado::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Porcentaje no válido.';
  END IF;
  IF p_tipo <> 'emitida' OR p_area IS DISTINCT FROM v_factura.area OR trim(COALESCE(p_concepto,''))='' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Datos de factura no válidos.';
  END IF;
  IF v_cliente IS NULL OR NULLIF(trim(v_cliente->>'nif_cif'),'') IS NULL OR NULLIF(trim(v_cliente->>'direccion'),'') IS NULL
     OR NULLIF(trim(v_emisor->>'direccion_fiscal'),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Completa los datos fiscales de emisor y cliente (NIF y dirección).';
  END IF;
  IF (SELECT count(*) FROM public.clientes WHERE lower(trim(nombre))=lower(trim(p_cliente))) <> 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='La ficha fiscal del cliente es ambigua.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ingresos i WHERE i.id=v_factura.ingreso_id
     AND i.cliente=p_cliente AND i.area=p_area AND i.base_imponible>0
     AND p_base_imponible=round(i.base_imponible*p_porcentaje_facturado/100,2)
     AND p_porcentaje_iva=i.porcentaje_iva
     AND p_importe_iva=round(p_base_imponible*i.porcentaje_iva/100,2)
     AND p_total=p_base_imponible+p_importe_iva) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Los importes no coinciden con el ingreso y el porcentaje.';
  END IF;
  PERFORM p_fecha::date;
  -- [FIX-7] Alta atómica de la fila del contador y luego bloqueo.
  INSERT INTO public.numeracion_contador (emisor_id, serie, ultimo_numero, confirmado)
  VALUES (v_emisor_id, v_serie, 0, false)
  ON CONFLICT (emisor_id, serie) DO NOTHING;

  PERFORM 1 FROM public.numeracion_contador
   WHERE emisor_id = v_emisor_id AND serie = v_serie FOR UPDATE;

  IF NOT (SELECT confirmado FROM public.numeracion_contador
           WHERE emisor_id = v_emisor_id AND serie = v_serie) THEN
    RAISE EXCEPTION 'La numeración del emisor % (serie "%") no ha sido confirmada por un administrador.', v_emisor_id, v_serie;
  END IF;

  UPDATE public.numeracion_contador
     SET ultimo_numero = greatest(ultimo_numero,coalesce((select max(numero_secuencial) from public.facturas where emisor_id=v_emisor_id and coalesce(serie,'')=v_serie),0),case when v_emisor_id='default' and v_serie='' then coalesce((select max(numero) from public.drive_invoice_files where tipo='emitida'),0) else 0 end) + 1
   WHERE emisor_id = v_emisor_id AND serie = v_serie
   RETURNING ultimo_numero INTO v_numero;

  INSERT INTO public.numeracion_log (numero, emisor_id, serie, factura_id, user_id)
  VALUES (v_numero, v_emisor_id, v_serie, p_factura_id, auth.uid());

  -- [FIX-6] Marca de operación privilegiada: deja pasar ESTE update ante el
  -- trigger de inmutabilidad, y solo este.
  PERFORM set_config('app.facturacion_privilegiada', 'on', true);

  UPDATE public.facturas SET
    numero = v_numero::text, numero_secuencial = v_numero,
    emisor_id = v_emisor_id, serie = v_serie,
    area = p_area, tipo = p_tipo, cliente = p_cliente, concepto = p_concepto,
    base_imponible = p_base_imponible, porcentaje_iva = p_porcentaje_iva,
    importe_iva = p_importe_iva, total = p_total, fecha = p_fecha,
    ingreso_id = COALESCE(p_ingreso_id, ingreso_id),
    porcentaje_facturado = p_porcentaje_facturado,
    notas = p_notas, linea_negocio = v_linea, estado = 'emitida',
    fecha_emision = now(), emitida_por = auth.uid(),
    emisor_snapshot = v_emisor, cliente_snapshot = v_cliente,
    historial = COALESCE(historial, '[]'::jsonb) || jsonb_build_object(
      'fecha', now(), 'usuarioId', auth.uid(), 'accion', 'emitida',
      'detalle', format('Nº %s · emisor %s · línea %s', v_numero, v_emisor_id, v_linea))
  WHERE id = p_factura_id;

  PERFORM set_config('app.facturacion_privilegiada', 'off', true);

  RETURN QUERY SELECT v_numero, v_emisor_id, v_serie;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.guardar_carpeta_sound(p_id text, p_datos jsonb, p_etapa text, p_accion text, p_fecha date, p_notas text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if auth.uid() is null or not public.has_section_perm(auth.uid(),'montada_sound','clientes','edit') then raise exception 'Sin permiso';end if;
 if length(trim(coalesce(p_datos->>'nombre',''))) not between 1 and 200 then raise exception 'Nombre no válido';end if;
 update public.crm_sound_clientes set fecha_evento=nullif(p_datos->>'fecha_evento','')::date,ubicacion_evento=nullif(trim(p_datos->>'ubicacion_evento'),''),notas=p_notas,tipo_servicio=p_datos->>'tipo_servicio',contacto_nombre=coalesce(p_datos->>'contacto_nombre','') where cliente_id=p_id and carpeta_cliente and eliminado_en is null;
 if not found then raise exception 'Cliente no disponible';end if;
 update public.clientes set nombre=trim(p_datos->>'nombre'),nif_cif=p_datos->>'nifCif',direccion=p_datos->>'direccion',email=p_datos->>'email',telefono=p_datos->>'telefono' where id=p_id;
 if not found then raise exception 'No se pudo guardar';end if;
end$function$
;
CREATE OR REPLACE FUNCTION public.guardar_cliente_sound(p_id text, p_datos jsonb, p_etapa text, p_accion text, p_fecha date, p_notas text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if auth.uid() is null or not public.has_section_perm(auth.uid(),'montada_sound','clientes','edit') then raise exception 'Sin permiso para editar clientes de Sound';end if;
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
end $function$
;
CREATE OR REPLACE FUNCTION public.ocultar_factura_generada(p_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ declare f public.facturas; begin select * into f from public.facturas where id=p_id for update; if not found or auth.uid() is null or f.linea_negocio is null or not public.has_section_perm(auth.uid(),f.linea_negocio,'facturas','delete') then raise exception using errcode='42501',message='Sin permiso para eliminar esta factura.'; end if; if f.tipo<>'emitida' or f.numero_secuencial is null then raise exception 'Solo se eliminan del listado facturas generadas; los borradores se borran desde su editor.'; end if; update public.facturas set oculta_en=coalesce(oculta_en,now()) where id=p_id; end $function$
;
CREATE OR REPLACE FUNCTION public.puede_sincronizar_factura(p_factura_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_f RECORD; v_linea TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_f FROM public.facturas WHERE id = p_factura_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF public.is_admin(auth.uid()) THEN RETURN true; END IF;
  v_linea := v_f.linea_negocio;
  IF v_linea IS NULL THEN
    -- Facturas de gasto sin ingreso vinculado: permiso del módulo.
    RETURN false;
  END IF;
  RETURN public.has_section_perm(auth.uid(),v_linea,'facturas','edit');
END;
$function$
;
CREATE OR REPLACE FUNCTION public.reserve_drive_upload(p_factura_id text, p_actor uuid, p_file_id text, p_folder text, p_hash text, p_nombre text)
 RETURNS SETOF drive_uploads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE f public.facturas;
BEGIN
 SELECT * INTO f FROM public.facturas WHERE id=p_factura_id FOR UPDATE;
 IF NOT FOUND OR NOT public.has_section_perm(p_actor,f.linea_negocio,'facturas','edit') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Factura no autorizada.'; END IF;
 IF f.tipo='emitida' AND f.numero_secuencial IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Emite la factura antes de sincronizarla.'; END IF;
 INSERT INTO public.drive_uploads(factura_id,file_id,folder_id,contenido_hash,nombre,created_by)
 VALUES(p_factura_id,p_file_id,p_folder,p_hash,p_nombre,p_actor) ON CONFLICT(factura_id) DO NOTHING;
 IF EXISTS(SELECT 1 FROM public.drive_uploads WHERE factura_id=p_factura_id AND contenido_hash<>p_hash) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ya existe un intento con otro archivo. Conserva el documento original.';
 END IF;
 RETURN QUERY SELECT * FROM public.drive_uploads WHERE factura_id=p_factura_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.restaurar_factura_generada(p_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare f public.facturas;
begin
 select * into f from public.facturas where id=p_id for update;
 if not found or auth.uid() is null or f.linea_negocio is null
  or not coalesce(public.has_section_perm(auth.uid(),f.linea_negocio,'facturas','edit'),false)
  or not coalesce(public.has_facturacion_perm(auth.uid(),'emitir'),false) then
  raise exception using errcode='42501',message='Sin permiso para restaurar esta factura.';
 end if;
 if f.tipo<>'emitida' or f.numero_secuencial is null then
  raise exception 'Solo se pueden restaurar facturas emitidas archivadas.';
 end if;
 if f.oculta_en is null then return; end if;
 update public.facturas set oculta_en=null,
 historial=coalesce(historial,'[]'::jsonb)||jsonb_build_object('fecha',now(),'usuarioId',auth.uid(),'accion','factura_restaurada','detalle','Factura recuperada del archivo; conserva su número y sus importes.')
 where id=p_id;
end $function$
;

-- Saved customer billing details, scoped to the chosen service.
create table public.billing_companies (
 id uuid primary key default gen_random_uuid(), linea_negocio text not null check(linea_negocio in ('montada_sound','dj','real_madrid','montada_installations')),
 nombre text not null check(length(trim(nombre)) between 1 and 250), nif_cif text not null check(length(trim(nif_cif)) between 1 and 40),
 direccion text not null check(length(trim(direccion))>0), email text not null default '', telefono text not null default '',
 created_at timestamptz not null default now(), unique(linea_negocio,nif_cif)
);
alter table public.billing_companies enable row level security;
revoke all on public.billing_companies from anon,authenticated;
grant select,insert,update on public.billing_companies to authenticated;
grant all on public.billing_companies to service_role;
create policy company_read on public.billing_companies for select to authenticated using(public.has_section_perm(auth.uid(),linea_negocio,'facturas','view'));
create policy company_create on public.billing_companies for insert to authenticated with check(public.has_section_perm(auth.uid(),linea_negocio,'facturas','create'));
create policy company_edit on public.billing_companies for update to authenticated using(public.has_section_perm(auth.uid(),linea_negocio,'facturas','edit')) with check(public.has_section_perm(auth.uid(),linea_negocio,'facturas','edit'));
-- An authorized calendar-only reader gets a projection with no financial columns/notes.
create schema if not exists private;
grant usage on schema private to authenticated;
create function private.sound_calendar_projection() returns table(id text,date text,title text,client text,type text,total numeric,status text,notes text)
language sql stable security definer set search_path=public,pg_temp as $$
 select 'income:'||i.id,i.fecha_evento,i.concepto,i.cliente,i.tipo_evento,
 case when public.has_section_perm(auth.uid(),'montada_sound','ingresos','view') then i.total end,
 case when public.has_section_perm(auth.uid(),'montada_sound','ingresos','view') then i.estado_pago else '' end,
 case when public.has_section_perm(auth.uid(),'montada_sound','ingresos','view') then i.notas end
 from public.ingresos i where i.linea_negocio='montada_sound' and auth.uid() is not null and public.has_section_perm(auth.uid(),'montada_sound','calendario','view')
 union all
 select 'event:'||e.id,e.fecha,e.nombre,e.cliente,e.tipo,
 case when public.has_section_perm(auth.uid(),'montada_sound','ingresos','view') then e.presupuesto end,e.estado,
 case when public.has_section_perm(auth.uid(),'montada_sound','ingresos','view') then e.notas end
 from public.eventos e where e.area='montada' and auth.uid() is not null and public.has_section_perm(auth.uid(),'montada_sound','calendario','view')
 and not exists(select 1 from public.ingresos i where i.linea_negocio='montada_sound' and i.evento_id=e.id);
$$;
revoke all on function private.sound_calendar_projection() from public,anon;
grant execute on function private.sound_calendar_projection() to authenticated;
create function public.get_sound_calendar() returns table(id text,date text,title text,client text,type text,total numeric,status text,notes text)
language sql stable security invoker set search_path=public,pg_temp as $$select * from private.sound_calendar_projection()$$;
revoke all on function public.get_sound_calendar() from public,anon;
grant execute on function public.get_sound_calendar() to authenticated;
-- Preserve the production hotfix in version control.
grant update(fecha_evento,ubicacion_evento) on public.crm_sound_clientes to authenticated;
-- Prevent document and partner paths from bypassing section restrictions.
create policy section_documents on public.documentos as restrictive for all to authenticated using(public.document_entity_permission(entity_type,entity_id,'view')) with check(public.document_entity_permission(entity_type,entity_id,'create') or public.document_entity_permission(entity_type,entity_id,'edit'));
create policy section_partner_movements on public.movimientos_socios as restrictive for all to authenticated using(exists(select 1 from public.socios s where s.id=socio_id)) with check(exists(select 1 from public.socios s where s.id=socio_id));
create policy section_crm_files on storage.objects as restrictive for all to authenticated using(bucket_id<>'crm-sound' or public.has_section_perm(auth.uid(),'montada_sound','clientes','view')) with check(bucket_id<>'crm-sound' or public.has_section_perm(auth.uid(),'montada_sound','clientes','create'));

create policy section_client_document_category on public.crm_sound_documentos as restrictive for all to authenticated using(public.has_section_perm(auth.uid(),'montada_sound',case categoria when 'contrato' then 'contratos' when 'presupuesto' then 'presupuestos' when 'factura' then 'facturas' else 'clientes' end,'view')) with check(public.has_section_perm(auth.uid(),'montada_sound',case categoria when 'contrato' then 'contratos' when 'presupuesto' then 'presupuestos' when 'factura' then 'facturas' else 'clientes' end,'create'));
create policy section_crm_download on storage.objects as restrictive for select to authenticated using(bucket_id<>'crm-sound' or exists(select 1 from public.crm_sound_documentos d where d.storage_path=name));
create policy section_taxes on public.impuestos as restrictive for all to authenticated using(public.has_module_perm(auth.uid(),'impuestos','view') or public.has_section_perm(auth.uid(),linea_negocio,'resumen','view') or public.has_section_perm(auth.uid(),linea_negocio,'informes','view') or public.has_section_perm(auth.uid(),linea_negocio,'resultados','view')) with check(public.has_module_perm(auth.uid(),'impuestos','create') or public.has_module_perm(auth.uid(),'impuestos','edit'));
