-- Explicit, audited edit path. The immutable-invoice trigger remains enabled.
create or replace function public.editar_factura_emitida(
 p_id text,p_numero bigint,p_fecha date,p_fecha_evento date,p_cliente text,p_concepto text,
 p_base_imponible numeric,p_porcentaje_iva numeric,p_importe_iva numeric,p_total numeric,
 p_notas text,p_datos_cliente jsonb
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.facturas; part text[]; base numeric:=0; suplidos numeric:=0; rows_count integer:=0; client jsonb;
begin
 select * into f from public.facturas where id=p_id for update;
 if not found or auth.uid() is null or f.linea_negocio is null
 or not coalesce(public.has_line_perm(auth.uid(),f.linea_negocio,'edit'),false)
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
end $$;
alter function public.editar_factura_emitida(text,bigint,date,date,text,text,numeric,numeric,numeric,numeric,text,jsonb) owner to postgres;
revoke all on function public.editar_factura_emitida(text,bigint,date,date,text,text,numeric,numeric,numeric,numeric,text,jsonb) from public,anon;
grant execute on function public.editar_factura_emitida(text,bigint,date,date,text,text,numeric,numeric,numeric,numeric,text,jsonb) to authenticated;
