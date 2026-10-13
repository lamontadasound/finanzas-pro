-- Independent prospect register; one-time snapshot preserves existing history.
create table public.sound_leads (
 id uuid primary key default gen_random_uuid(), nombre text not null check(length(trim(nombre)) between 1 and 200),
 email text not null default '', telefono text not null default '', contacto text not null default '',
 nif text not null default '', direccion text not null default '', canal text not null default '',
 servicio text not null default 'otro', estado text not null default 'pendiente' check(estado in ('pendiente','convertido','no_convertido')),
 motivo text not null default '', notas text not null default '', fecha date not null default current_date,
 cierre date, eliminado boolean not null default false, created_at timestamptz not null default now(),
 check(estado<>'no_convertido' or length(trim(motivo))>0)
);
insert into public.sound_leads(nombre,email,telefono,contacto,nif,direccion,canal,servicio,estado,motivo,notas,fecha,cierre)
 select c.nombre,coalesce(c.email,''),coalesce(c.telefono,''),s.contacto_nombre,coalesce(c.nif_cif,''),coalesce(c.direccion,''),s.origen,s.tipo_servicio,
 case s.etapa when 'ganado' then 'convertido' when 'perdido' then 'no_convertido' else 'pendiente' end,
 case when s.etapa='perdido' and trim(s.motivo_perdida)='' then 'Pendiente de completar (registro anterior)' else s.motivo_perdida end,
 concat_ws(E'\n',s.notas,s.proxima_accion),s.created_at::date,s.fecha_cierre
 from public.crm_sound_clientes s join public.clientes c on c.id=s.cliente_id where s.eliminado_en is null;
alter table public.crm_sound_clientes add column carpeta_cliente boolean not null default false;
update public.crm_sound_clientes s set carpeta_cliente=true where etapa='ganado' or exists(select 1 from public.crm_sound_documentos d where d.cliente_id=s.cliente_id);
create function public.crear_carpeta_sound(p_nombre text) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare cid text:=gen_random_uuid()::text;
begin
 if auth.uid() is null or not public.has_line_perm(auth.uid(),'montada_sound','create') then raise exception 'Sin permiso';end if;
 if length(trim(coalesce(p_nombre,''))) not between 1 and 200 then raise exception 'Indica el nombre';end if;
 insert into public.clientes(id,nombre) values(cid,trim(p_nombre));
 insert into public.crm_sound_clientes(cliente_id,carpeta_cliente) values(cid,true);
 return cid;
end$$;
revoke all on function public.crear_carpeta_sound(text) from public,anon;
grant execute on function public.crear_carpeta_sound(text) to authenticated;
create table public.sound_contracts (
 id uuid primary key default gen_random_uuid(), tipo text not null check(tipo in ('boda','corporativo','alquiler')),
 titulo text not null check(length(trim(titulo))>0), contenido jsonb not null check(jsonb_typeof(contenido)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.sound_leads enable row level security;
revoke all on public.sound_leads from anon,authenticated;
grant select,insert,update,delete on public.sound_leads to authenticated;
grant all on public.sound_leads to service_role;
create policy scoped_read on public.sound_leads for select to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','view'));
create policy scoped_create on public.sound_leads for insert to authenticated with check(public.has_line_perm(auth.uid(),'montada_sound','create'));
create policy scoped_edit on public.sound_leads for update to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','edit')) with check(public.has_line_perm(auth.uid(),'montada_sound','edit'));
create policy scoped_delete on public.sound_leads for delete to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','delete'));
alter table public.sound_contracts enable row level security;
revoke all on public.sound_contracts from anon,authenticated;
grant select,insert,update,delete on public.sound_contracts to authenticated;
grant all on public.sound_contracts to service_role;
create policy scoped_read on public.sound_contracts for select to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','view'));
create policy scoped_create on public.sound_contracts for insert to authenticated with check(public.has_line_perm(auth.uid(),'montada_sound','create'));
create policy scoped_edit on public.sound_contracts for update to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','edit')) with check(public.has_line_perm(auth.uid(),'montada_sound','edit'));
create policy scoped_delete on public.sound_contracts for delete to authenticated using(public.has_line_perm(auth.uid(),'montada_sound','delete'));
CREATE OR REPLACE FUNCTION public.emitir_factura_independiente(p_factura_id text, p_area text, p_tipo text, p_cliente text, p_concepto text, p_base_imponible numeric, p_porcentaje_iva numeric, p_importe_iva numeric, p_total numeric, p_fecha text, p_ingreso_id text, p_porcentaje_facturado numeric, p_notas text, p_datos_cliente jsonb)
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

  v_linea := v_factura.linea_negocio;
  IF NOT public.has_facturacion_perm(auth.uid(),'emitir') OR v_linea IS NULL
     OR NOT public.has_line_perm(auth.uid(),v_linea,'create')
     OR p_ingreso_id IS NOT NULL OR v_factura.ingreso_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='No tienes permiso sobre esta factura o su ingreso.';
  END IF;

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
  v_linea := v_factura.linea_negocio;
  IF v_linea IS NULL THEN
    RAISE EXCEPTION 'No se puede determinar la línea de negocio: la factura debe estar vinculada a un ingreso existente.';
  END IF;
  IF NOT public.has_line_perm(auth.uid(), v_linea, 'create') THEN
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
  IF p_porcentaje_facturado<>100 OR p_base_imponible IS NULL OR p_base_imponible<=0
     OR p_base_imponible::text IN ('NaN','Infinity','-Infinity') OR p_base_imponible<>round(p_base_imponible,2)
     OR p_porcentaje_iva IS NULL OR p_porcentaje_iva NOT IN (0,4,10,21)
     OR p_importe_iva IS DISTINCT FROM round(p_base_imponible*p_porcentaje_iva/100,2)
     OR p_total IS DISTINCT FROM p_base_imponible+p_importe_iva OR length(trim(coalesce(p_cliente,'')))=0 THEN
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
$function$;

revoke all on function public.emitir_factura_independiente(text,text,text,text,text,numeric,numeric,numeric,numeric,text,text,numeric,text,jsonb) from public,anon;
grant execute on function public.emitir_factura_independiente(text,text,text,text,text,numeric,numeric,numeric,numeric,text,text,numeric,text,jsonb) to authenticated;

create function public.guardar_carpeta_sound(p_id text,p_datos jsonb,p_etapa text,p_accion text,p_fecha date,p_notas text) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.has_line_perm(auth.uid(),'montada_sound','edit') then raise exception 'Sin permiso';end if;
 if length(trim(coalesce(p_datos->>'nombre',''))) not between 1 and 200 then raise exception 'Nombre no válido';end if;
 update public.crm_sound_clientes set notas=p_notas,tipo_servicio=p_datos->>'tipo_servicio',contacto_nombre=coalesce(p_datos->>'contacto_nombre','') where cliente_id=p_id and carpeta_cliente and eliminado_en is null;
 if not found then raise exception 'Cliente no disponible';end if;
 update public.clientes set nombre=trim(p_datos->>'nombre'),nif_cif=p_datos->>'nifCif',direccion=p_datos->>'direccion',email=p_datos->>'email',telefono=p_datos->>'telefono' where id=p_id;
 if not found then raise exception 'No se pudo guardar';end if;
end$$;
revoke all on function public.guardar_carpeta_sound(text,jsonb,text,text,date,text) from public,anon;
grant execute on function public.guardar_carpeta_sound(text,jsonb,text,text,date,text) to authenticated;
-- Existing correction workflow must also accept a genuinely independent invoice.
do $migration$
declare body text; old_clause text := 'OR NOT EXISTS(SELECT 1 FROM public.ingresos WHERE id=v_orig.ingreso_id AND total>0
                   AND p_porcentaje_facturado=round(p_total/total*100,2))';
begin
 select pg_get_functiondef(oid) into body from pg_proc where pronamespace='public'::regnamespace and proname='crear_factura_rectificativa';
 if position(old_clause in body)=0 then raise exception 'Rectification function differs; inspect before changing';end if;
 body:=replace(body,old_clause,'OR (v_orig.ingreso_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ingresos WHERE id=v_orig.ingreso_id AND total>0 AND p_porcentaje_facturado=round(p_total/total*100,2))) OR (v_orig.ingreso_id IS NULL AND p_porcentaje_facturado<>0)');
 body:=replace(body,'v_linea := public.linea_de_ingreso(v_orig.ingreso_id);','v_linea := coalesce(public.linea_de_ingreso(v_orig.ingreso_id),v_orig.linea_negocio);');
 execute body;
end $migration$;
