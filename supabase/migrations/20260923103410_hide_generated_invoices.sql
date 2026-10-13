alter table public.facturas add column if not exists oculta_en timestamptz;
create or replace function public.ocultar_factura_generada(p_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.facturas;
begin
 select * into f from public.facturas where id=p_id for update;
 if not found or auth.uid() is null or f.linea_negocio is null
    or not public.has_line_perm(auth.uid(),f.linea_negocio,'delete') then
  raise exception using errcode='42501',message='Sin permiso para eliminar esta factura.';
 end if;
 if f.tipo<>'emitida' or f.numero_secuencial is null then
  raise exception 'Solo se eliminan del listado facturas generadas; los borradores se borran desde su editor.';
 end if;
 update public.facturas set oculta_en=coalesce(oculta_en,now()) where id=p_id;
end $$;
revoke all on function public.ocultar_factura_generada(text) from public,anon;
grant execute on function public.ocultar_factura_generada(text) to authenticated;
