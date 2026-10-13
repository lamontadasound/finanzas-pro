create or replace function public.editar_numero_factura(p_id text,p_numero bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.facturas;
begin
 select * into f from public.facturas where id=p_id for update;
 if not found or auth.uid() is null or f.linea_negocio is null
 or not public.has_line_perm(auth.uid(),f.linea_negocio,'edit')
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
end $$;
revoke all on function public.editar_numero_factura(text,bigint) from public,anon;
grant execute on function public.editar_numero_factura(text,bigint) to authenticated;
