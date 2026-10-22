-- Keep the immutable-invoice trigger and numbering reservations intact.
create or replace function public.restaurar_factura_generada(p_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.facturas;
begin
 select * into f from public.facturas where id=p_id for update;
 if not found or auth.uid() is null or f.linea_negocio is null
  or not coalesce(public.has_line_perm(auth.uid(),f.linea_negocio,'edit'),false)
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
end $$;
alter function public.restaurar_factura_generada(text) owner to postgres;
revoke all on function public.restaurar_factura_generada(text) from public,anon;
grant execute on function public.restaurar_factura_generada(text) to authenticated;
