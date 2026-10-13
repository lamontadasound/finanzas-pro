-- Applied inside activation transaction, after G and H. No business rows deleted.
CREATE OR REPLACE FUNCTION public.canonical_line(v text, a text DEFAULT NULL) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE v WHEN 'La Montada Sound' THEN 'montada_sound' WHEN 'DJs' THEN 'dj'
 WHEN 'Real Madrid' THEN 'real_madrid' WHEN 'La Montada Installations' THEN 'montada_installations'
 WHEN 'montada_sound' THEN v WHEN 'dj' THEN v WHEN 'real_madrid' THEN v WHEN 'montada_installations' THEN v
 ELSE CASE a WHEN 'montada' THEN 'montada_sound' WHEN 'dj' THEN 'dj' WHEN 'real_madrid' THEN 'real_madrid' END END
$$;
CREATE OR REPLACE FUNCTION public.normalize_business_line() RETURNS trigger LANGUAGE plpgsql
SET search_path=public,pg_temp AS $$
DECLARE payload jsonb := to_jsonb(NEW); parent_line text;
BEGIN
 IF NEW.linea_negocio IS NOT NULL AND public.canonical_line(NEW.linea_negocio) IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Línea de negocio desconocida.';
 END IF;
 NEW.linea_negocio := public.canonical_line(NEW.linea_negocio,payload->>'area');
 IF payload->>'ingreso_id' IS NOT NULL THEN
   SELECT linea_negocio INTO parent_line FROM public.ingresos WHERE id=payload->>'ingreso_id';
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Ingreso no encontrado o no autorizado.'; END IF;
   NEW.linea_negocio := parent_line;
 ELSIF payload->>'gasto_id' IS NOT NULL THEN
   SELECT linea_negocio INTO parent_line FROM public.gastos WHERE id=payload->>'gasto_id';
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Gasto no encontrado o no autorizado.'; END IF;
   NEW.linea_negocio := parent_line;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; p record; BEGIN
 FOR t IN SELECT unnest(ARRAY['ingresos','gastos','facturas','equipo','impuestos','documentos','gastos_evento','pagos_evento','suplidos']) LOOP
   EXECUTE format('UPDATE public.%I SET linea_negocio=public.canonical_line(linea_negocio) WHERE linea_negocio IN (''La Montada Sound'',''DJs'',''Real Madrid'',''La Montada Installations'')',t);
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon',t);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
   EXECUTE format('DROP TRIGGER IF EXISTS aa_normalize_line ON public.%I',t);
   EXECUTE format('CREATE TRIGGER aa_normalize_line BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.normalize_business_line()',t);
   FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
     EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
   END LOOP;
   EXECUTE format('CREATE POLICY line_select ON public.%I FOR SELECT TO authenticated USING(public.has_line_perm(auth.uid(),linea_negocio,''view''))',t);
   EXECUTE format('CREATE POLICY line_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(public.has_line_perm(auth.uid(),linea_negocio,''create''))',t);
   EXECUTE format('CREATE POLICY line_update ON public.%I FOR UPDATE TO authenticated USING(public.has_line_perm(auth.uid(),linea_negocio,''edit'')) WITH CHECK(public.has_line_perm(auth.uid(),linea_negocio,''edit''))',t);
   EXECUTE format('CREATE POLICY line_delete ON public.%I FOR DELETE TO authenticated USING(public.has_line_perm(auth.uid(),linea_negocio,''delete''))',t);
 END LOOP;
 -- Explicit module gate for taxes. Permissive line policies still bound rows.
 CREATE POLICY taxes_read ON public.impuestos AS RESTRICTIVE FOR SELECT TO authenticated USING(public.has_module_perm(auth.uid(),'impuestos','view'));
 CREATE POLICY taxes_create ON public.impuestos AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.has_module_perm(auth.uid(),'impuestos','create'));
 CREATE POLICY taxes_edit ON public.impuestos AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.has_module_perm(auth.uid(),'impuestos','edit')) WITH CHECK(public.has_module_perm(auth.uid(),'impuestos','edit'));
 CREATE POLICY taxes_delete ON public.impuestos AS RESTRICTIVE FOR DELETE TO authenticated USING(public.has_module_perm(auth.uid(),'impuestos','delete'));
 FOR t IN SELECT unnest(ARRAY['eventos','socios','movimientos_socios']) LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon',t);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
   FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
     EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
   END LOOP;
   EXECUTE format('CREATE POLICY line_select ON public.%I FOR SELECT TO authenticated USING(public.has_line_perm(auth.uid(),''montada_sound'',''view''))',t);
   EXECUTE format('CREATE POLICY line_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(public.has_line_perm(auth.uid(),''montada_sound'',''create''))',t);
   EXECUTE format('CREATE POLICY line_update ON public.%I FOR UPDATE TO authenticated USING(public.has_line_perm(auth.uid(),''montada_sound'',''edit'')) WITH CHECK(public.has_line_perm(auth.uid(),''montada_sound'',''edit''))',t);
   EXECUTE format('CREATE POLICY line_delete ON public.%I FOR DELETE TO authenticated USING(public.has_line_perm(auth.uid(),''montada_sound'',''delete''))',t);
 END LOOP;
 -- Legacy tables preserved and closed to client roles, including old password hashes.
 FOR t IN SELECT unnest(ARRAY['usuarios','gastos_recurrentes','historial_pagos']) LOOP
   IF to_regclass('public.'||t) IS NOT NULL THEN
     EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
     EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
     FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
       EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
     END LOOP;
   END IF;
 END LOOP;
END $$;
-- Repair child line classifications from existing relationships, without touching amounts.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['gastos_evento','pagos_evento','suplidos','facturas']) LOOP
  EXECUTE format('UPDATE public.%I d SET linea_negocio=i.linea_negocio FROM public.ingresos i WHERE d.ingreso_id=i.id AND d.linea_negocio IS DISTINCT FROM i.linea_negocio',t);
 END LOOP;
 UPDATE public.facturas f SET linea_negocio=g.linea_negocio FROM public.gastos g WHERE f.gasto_id=g.id AND f.linea_negocio IS DISTINCT FROM g.linea_negocio;
 UPDATE public.documentos d SET linea_negocio=i.linea_negocio FROM public.ingresos i WHERE d.entity_type='ingreso' AND d.entity_id=i.id AND d.linea_negocio IS DISTINCT FROM i.linea_negocio;
 UPDATE public.documentos d SET linea_negocio=g.linea_negocio FROM public.gastos g WHERE d.entity_type='gasto' AND d.entity_id=g.id AND d.linea_negocio IS DISTINCT FROM g.linea_negocio;
 UPDATE public.documentos d SET linea_negocio=f.linea_negocio FROM public.facturas f WHERE d.entity_type='factura' AND d.entity_id=f.id AND d.linea_negocio IS DISTINCT FROM f.linea_negocio;
 UPDATE public.documentos d SET linea_negocio=e.linea_negocio FROM public.equipo e WHERE d.entity_type='equipo' AND d.entity_id=e.id AND d.linea_negocio IS DISTINCT FROM e.linea_negocio;
END $$;
-- Data access to dependants is derived from their parent on both reads and writes.
DO $$ DECLARE t text; a text; cmd text; pred text; BEGIN
 FOR t IN SELECT unnest(ARRAY['gastos_evento','pagos_evento','suplidos','facturas']) LOOP
  FOREACH a IN ARRAY ARRAY['view','create','edit','delete'] LOOP
   cmd := CASE a WHEN 'view' THEN 'SELECT' WHEN 'create' THEN 'INSERT' WHEN 'edit' THEN 'UPDATE' ELSE 'DELETE' END;
   pred := format('(ingreso_id IS NULL OR EXISTS(SELECT 1 FROM public.ingresos i WHERE i.id=%I.ingreso_id AND public.has_line_perm(auth.uid(),i.linea_negocio,%L)))',t,a);
   IF a = 'view' THEN pred := '(public.is_admin(auth.uid()) OR ' || pred || ')'; END IF;
   EXECUTE format('CREATE POLICY parent_%s ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s',a,t,cmd,
    CASE cmd WHEN 'INSERT' THEN 'WITH CHECK('||pred||')' WHEN 'UPDATE' THEN 'USING('||pred||') WITH CHECK('||pred||')' ELSE 'USING('||pred||')' END);
  END LOOP;
 END LOOP;
END $$;
-- Profile and permission writes are admin-only; an admin cannot modify their own capabilities.
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profiles,public.user_line_permissions,public.user_module_permissions TO authenticated;
REVOKE ALL ON public.profiles,public.user_line_permissions,public.user_module_permissions,public.user_facturacion_permissions,public.clientes,public.configuracion_fiscal,public.proyecto_emisor FROM PUBLIC,anon;
CREATE OR REPLACE FUNCTION public.protect_last_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(872931004);
 IF TG_OP='DELETE' OR NEW.rol IS DISTINCT FROM OLD.rol OR NEW.activo IS DISTINCT FROM OLD.activo THEN
  IF OLD.id=auth.uid() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='No puedes quitarte tu propio acceso.'; END IF;
  IF OLD.rol='admin' AND OLD.activo AND (TG_OP='DELETE' OR NEW.rol<>'admin' OR NOT NEW.activo)
    AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id<>OLD.id AND rol='admin' AND activo) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Debe quedar al menos un administrador activo.';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_protect_last_admin ON public.profiles;
CREATE TRIGGER trg_protect_last_admin BEFORE UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin();
DROP POLICY IF EXISTS write_admin ON public.user_facturacion_permissions;
CREATE POLICY write_admin ON public.user_facturacion_permissions FOR ALL TO authenticated
 USING(public.is_admin(auth.uid()) AND user_id<>auth.uid()) WITH CHECK(public.is_admin(auth.uid()) AND user_id<>auth.uid());
DROP POLICY IF EXISTS write_contabilidad ON public.clientes;
DROP POLICY IF EXISTS client_insert ON public.clientes;
CREATE POLICY client_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK(public.has_module_perm(auth.uid(),'contabilidad','create'));
DROP POLICY IF EXISTS client_update ON public.clientes;
CREATE POLICY client_update ON public.clientes FOR UPDATE TO authenticated USING(public.has_module_perm(auth.uid(),'contabilidad','edit')) WITH CHECK(public.has_module_perm(auth.uid(),'contabilidad','edit'));
DROP POLICY IF EXISTS client_delete ON public.clientes;
CREATE POLICY client_delete ON public.clientes FOR DELETE TO authenticated USING(public.has_module_perm(auth.uid(),'contabilidad','delete'));
DROP POLICY IF EXISTS select_autenticado ON public.configuracion_fiscal;
DROP POLICY IF EXISTS issuer_select ON public.configuracion_fiscal;
CREATE POLICY issuer_select ON public.configuracion_fiscal FOR SELECT TO authenticated
 USING(public.is_admin(auth.uid()) OR EXISTS(SELECT 1 FROM public.proyecto_emisor pe WHERE pe.emisor_id=id AND public.has_line_perm(auth.uid(),pe.linea_id,'view')));
DROP POLICY IF EXISTS select_autenticado ON public.proyecto_emisor;
DROP POLICY IF EXISTS assignment_select ON public.proyecto_emisor;
CREATE POLICY assignment_select ON public.proyecto_emisor FOR SELECT TO authenticated USING(public.has_line_perm(auth.uid(),linea_id,'view'));
-- Synchronization receipts may only be written by the verified server integration.
REVOKE EXECUTE ON FUNCTION public.registrar_sync_drive(TEXT,TEXT,TEXT,TEXT,TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_sync_drive(TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.puede_sincronizar_factura(TEXT) TO service_role;
-- Existing documents remain private. Their object key must match an authorized document.
DO $$ DECLARE p record; BEGIN
 IF to_regclass('storage.objects') IS NOT NULL THEN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND (policyname IN ('acceso_total','acceso_total_docs') OR COALESCE(qual,'') LIKE '%documentos%') LOOP
   EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname);
  END LOOP;
  CREATE POLICY finance_document_read ON storage.objects FOR SELECT TO authenticated
   USING(bucket_id='documentos' AND EXISTS(SELECT 1 FROM public.documentos d WHERE d.storage_key=name));
 END IF;
END $$;
-- Validate every capability before any change, then persist the whole matrix atomically.
CREATE OR REPLACE FUNCTION public.admin_save_user(p_user_id uuid,p_nombre text,p_rol text,p_activo boolean,p_lineas jsonb,p_modulos jsonb,p_facturacion jsonb,p_email text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k text; v jsonb; action text;
BEGIN
 IF NOT public.is_admin(auth.uid()) OR p_user_id=auth.uid() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Acción administrativa no autorizada.'; END IF;
 IF p_rol NOT IN ('admin','usuario') OR p_activo IS NULL OR NULLIF(trim(p_nombre),'') IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Perfil inválido.'; END IF;
 IF jsonb_typeof(p_lineas)<>'object' OR jsonb_typeof(p_modulos)<>'object' OR jsonb_typeof(p_facturacion)<>'object'
   OR p_lineas IS NULL OR p_modulos IS NULL OR p_facturacion IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Matriz de permisos inválida.'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(p_lineas||p_modulos) LOOP
  IF k NOT IN ('montada_sound','dj','real_madrid','montada_installations','contabilidad','impuestos','informes','administracion') OR jsonb_typeof(v)<>'object'
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Permiso desconocido.'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(v) field WHERE field NOT IN ('ver','crear','editar','eliminar')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Capacidad desconocida.'; END IF;
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
 INSERT INTO public.user_line_permissions(user_id,linea_negocio,can_view,can_create,can_edit,can_delete)
 SELECT p_user_id,key,(value->>'ver')::boolean,(value->>'crear')::boolean,(value->>'editar')::boolean,(value->>'eliminar')::boolean FROM jsonb_each(p_lineas);
 INSERT INTO public.user_module_permissions(user_id,modulo,can_view,can_create,can_edit,can_delete)
 SELECT p_user_id,key,(value->>'ver')::boolean,(value->>'crear')::boolean,(value->>'editar')::boolean,(value->>'eliminar')::boolean FROM jsonb_each(p_modulos);
 INSERT INTO public.user_facturacion_permissions(user_id,puede_emitir,puede_rectificar,puede_gestionar_numeracion)
 VALUES(p_user_id,(p_facturacion->>'emitir')::boolean,(p_facturacion->>'rectificar')::boolean,(p_facturacion->>'gestionarNumeracion')::boolean)
 ON CONFLICT(user_id) DO UPDATE SET puede_emitir=EXCLUDED.puede_emitir,puede_rectificar=EXCLUDED.puede_rectificar,puede_gestionar_numeracion=EXCLUDED.puede_gestionar_numeracion;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_user(uuid,text,text,boolean,jsonb,jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_user(uuid,text,text,boolean,jsonb,jsonb,jsonb,text) TO authenticated;
CREATE TABLE IF NOT EXISTS public.drive_uploads(
 factura_id text PRIMARY KEY REFERENCES public.facturas(id), file_id text NOT NULL UNIQUE,
 folder_id text NOT NULL, contenido_hash text NOT NULL, nombre text NOT NULL,
 completed boolean NOT NULL DEFAULT false, created_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS drive_unique_content ON public.drive_uploads(folder_id,contenido_hash);
ALTER TABLE public.drive_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drive_uploads FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.drive_uploads TO service_role;
CREATE OR REPLACE FUNCTION public.reserve_drive_upload(p_factura_id text,p_actor uuid,p_file_id text,p_folder text,p_hash text,p_nombre text)
RETURNS SETOF public.drive_uploads LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public.facturas;
BEGIN
 SELECT * INTO f FROM public.facturas WHERE id=p_factura_id FOR UPDATE;
 IF NOT FOUND OR NOT public.has_line_perm(p_actor,f.linea_negocio,'edit') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Factura no autorizada.'; END IF;
 IF f.tipo='emitida' AND f.numero_secuencial IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Emite la factura antes de sincronizarla.'; END IF;
 INSERT INTO public.drive_uploads(factura_id,file_id,folder_id,contenido_hash,nombre,created_by)
 VALUES(p_factura_id,p_file_id,p_folder,p_hash,p_nombre,p_actor) ON CONFLICT(factura_id) DO NOTHING;
 IF EXISTS(SELECT 1 FROM public.drive_uploads WHERE factura_id=p_factura_id AND contenido_hash<>p_hash) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ya existe un intento con otro archivo. Conserva el documento original.';
 END IF;
 RETURN QUERY SELECT * FROM public.drive_uploads WHERE factura_id=p_factura_id;
END $$;
CREATE OR REPLACE FUNCTION public.complete_drive_upload(p_factura_id text,p_actor uuid,p_file_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u public.drive_uploads;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.facturas f WHERE id=p_factura_id AND public.has_line_perm(p_actor,f.linea_negocio,'edit')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Factura no autorizada.'; END IF;
 SELECT * INTO u FROM public.drive_uploads WHERE factura_id=p_factura_id AND file_id=p_file_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subida no reservada.'; END IF;
 UPDATE public.drive_uploads SET completed=true WHERE factura_id=p_factura_id;
 UPDATE public.facturas SET drive_file_id=u.file_id,drive_folder_id=u.folder_id,drive_nombre_archivo=u.nombre,
 drive_link='https://drive.google.com/file/d/'||u.file_id||'/view',drive_fecha_subida=now(),drive_subido_por=p_actor,sync_estado='sincronizada',sync_ultimo_error=NULL WHERE id=p_factura_id;
END $$;
REVOKE ALL ON FUNCTION public.reserve_drive_upload(text,uuid,text,text,text,text),public.complete_drive_upload(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_drive_upload(text,uuid,text,text,text,text),public.complete_drive_upload(text,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.document_entity_permission(p_type text,p_id text,p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
 RETURN l IS NOT NULL AND public.has_line_perm(auth.uid(),l,p_action);
END $$;
REVOKE ALL ON FUNCTION public.document_entity_permission(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.document_entity_permission(text,text,text) TO authenticated;
DO $$ DECLARE p record; a text; command text; pred text; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='documentos' LOOP EXECUTE format('DROP POLICY %I ON public.documentos',p.policyname); END LOOP;
 FOREACH a IN ARRAY ARRAY['view','create','edit','delete'] LOOP
  command:=CASE a WHEN 'view' THEN 'SELECT' WHEN 'create' THEN 'INSERT' WHEN 'edit' THEN 'UPDATE' ELSE 'DELETE' END;
  pred:=format('public.document_entity_permission(entity_type,entity_id,%L)',a);
  EXECUTE format('CREATE POLICY doc_%s ON public.documentos FOR %s TO authenticated %s',a,command,CASE command WHEN 'INSERT' THEN 'WITH CHECK('||pred||')' WHEN 'UPDATE' THEN 'USING('||pred||') WITH CHECK('||pred||')' ELSE 'USING('||pred||')' END);
 END LOOP;
 IF to_regclass('storage.objects') IS NOT NULL THEN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND (policyname LIKE 'finance_%' OR COALESCE(qual,'') LIKE '%investment-invoices%' OR COALESCE(with_check,'') LIKE '%investment-invoices%') LOOP EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname); END LOOP;
  CREATE POLICY finance_storage_read ON storage.objects FOR SELECT TO authenticated
   USING(bucket_id IN ('documentos','investment-invoices') AND public.document_entity_permission(split_part(name,'/',1),split_part(name,'/',2),'view'));
  CREATE POLICY finance_storage_upload ON storage.objects FOR INSERT TO authenticated
   WITH CHECK(bucket_id='investment-invoices' AND public.document_entity_permission(split_part(name,'/',1),split_part(name,'/',2),'create'));
  CREATE POLICY finance_storage_delete ON storage.objects FOR DELETE TO authenticated
   USING(bucket_id='investment-invoices' AND public.document_entity_permission(split_part(name,'/',1),split_part(name,'/',2),'delete'));
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS expense_invoice_number ON public.facturas(gasto_id,numero_proveedor) WHERE gasto_id IS NOT NULL AND numero_proveedor IS NOT NULL;
CREATE OR REPLACE FUNCTION public.save_received_invoice(p_factura jsonb,p_documento jsonb DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE f public.facturas; d public.documentos;
BEGIN
 f:=jsonb_populate_record(NULL::public.facturas,p_factura);
 IF f.tipo IS DISTINCT FROM 'recibida' OR f.gasto_id IS NULL OR f.numero_secuencial IS NOT NULL OR NULLIF(trim(f.numero),'') IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.gastos WHERE id=f.gasto_id) OR f.total IS NULL OR f.base_imponible IS NULL OR f.importe_iva IS NULL
 OR f.total<0 OR f.total<>round(f.base_imponible+f.importe_iva,2) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Factura de proveedor inválida.'; END IF;
 IF p_documento IS NOT NULL THEN
  d:=jsonb_populate_record(NULL::public.documentos,p_documento);
  IF d.entity_type<>'gasto' OR d.entity_id<>f.gasto_id OR d.id IS DISTINCT FROM f.documento_id THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Adjunto inválido.'; END IF;
  INSERT INTO public.documentos SELECT d.* ON CONFLICT(id) DO NOTHING;
 END IF;
 INSERT INTO public.facturas SELECT f.* ON CONFLICT(id) DO NOTHING;
 RETURN f.id;
END $$;
REVOKE ALL ON FUNCTION public.save_received_invoice(jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_received_invoice(jsonb,jsonb) TO authenticated;

DROP POLICY IF EXISTS select_contabilidad ON public.clientes;
CREATE POLICY select_contabilidad ON public.clientes FOR SELECT TO authenticated USING(
 public.has_module_perm(auth.uid(),'contabilidad','view') OR
 (public.has_facturacion_perm(auth.uid(),'emitir') AND EXISTS(SELECT 1 FROM public.ingresos i WHERE lower(trim(i.cliente))=lower(trim(nombre))))
);
CREATE OR REPLACE FUNCTION public.protect_invoiced_income() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.facturas WHERE ingreso_id=OLD.id AND numero_secuencial IS NOT NULL) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='No se puede borrar un ingreso con facturas emitidas.'; END IF;
  IF NEW.linea_negocio IS DISTINCT FROM OLD.linea_negocio OR NEW.area IS DISTINCT FROM OLD.area OR NEW.base_imponible IS DISTINCT FROM OLD.base_imponible OR NEW.porcentaje_iva IS DISTINCT FROM OLD.porcentaje_iva OR NEW.total IS DISTINCT FROM OLD.total OR NEW.cliente IS DISTINCT FROM OLD.cliente THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Un ingreso facturado conserva su cliente, importes y línea. Rectifica sus facturas antes de ajustar la operación.';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS protect_invoiced_income ON public.ingresos;
CREATE TRIGGER protect_invoiced_income BEFORE UPDATE OR DELETE ON public.ingresos FOR EACH ROW EXECUTE FUNCTION public.protect_invoiced_income();

-- Counters/logs cannot reveal other issuers or invoice IDs via a generic module grant.
DROP POLICY IF EXISTS select_admin_o_contabilidad ON public.numeracion_contador;
CREATE POLICY select_admin_o_contabilidad ON public.numeracion_contador FOR SELECT TO authenticated USING(public.is_admin(auth.uid()));
DROP POLICY IF EXISTS select_admin_o_contabilidad ON public.numeracion_log;
CREATE POLICY select_admin_o_contabilidad ON public.numeracion_log FOR SELECT TO authenticated USING(public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_facturas_ingreso ON public.facturas(ingreso_id);
CREATE INDEX IF NOT EXISTS idx_facturas_gasto ON public.facturas(gasto_id);
CREATE INDEX IF NOT EXISTS idx_documentos_entity ON public.documentos(entity_type,entity_id);
