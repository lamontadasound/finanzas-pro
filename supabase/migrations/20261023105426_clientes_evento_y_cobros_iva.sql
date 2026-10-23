-- Additive metadata: existing invoices, amounts and permissions remain unchanged.
alter table public.ingresos add column if not exists reserva_incluye_iva boolean, add column if not exists restante_incluye_iva boolean;
alter table public.crm_sound_clientes add column if not exists fecha_evento date, add column if not exists ubicacion_evento text check (length(ubicacion_evento)<=500);
create or replace function public.guardar_carpeta_sound(p_id text,p_datos jsonb,p_etapa text,p_accion text,p_fecha date,p_notas text) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.has_line_perm(auth.uid(),'montada_sound','edit') then raise exception 'Sin permiso';end if;
 if length(trim(coalesce(p_datos->>'nombre',''))) not between 1 and 200 then raise exception 'Nombre no válido';end if;
 update public.crm_sound_clientes set fecha_evento=nullif(p_datos->>'fecha_evento','')::date,ubicacion_evento=nullif(trim(p_datos->>'ubicacion_evento'),''),notas=p_notas,tipo_servicio=p_datos->>'tipo_servicio',contacto_nombre=coalesce(p_datos->>'contacto_nombre','') where cliente_id=p_id and carpeta_cliente and eliminado_en is null;
 if not found then raise exception 'Cliente no disponible';end if;
 update public.clientes set nombre=trim(p_datos->>'nombre'),nif_cif=p_datos->>'nifCif',direccion=p_datos->>'direccion',email=p_datos->>'email',telefono=p_datos->>'telefono' where id=p_id;
 if not found then raise exception 'No se pudo guardar';end if;
end$$;
revoke all on function public.guardar_carpeta_sound(text,jsonb,text,text,date,text) from public,anon;
grant execute on function public.guardar_carpeta_sound(text,jsonb,text,text,date,text) to authenticated;
