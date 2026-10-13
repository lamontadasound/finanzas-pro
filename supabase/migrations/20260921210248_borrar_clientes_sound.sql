alter table public.crm_sound_clientes add column eliminado_en timestamptz;
-- No direct UPDATE grant: deletion is gated independently from editing.
create function public.borrar_cliente_sound(p_id text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.has_line_perm(auth.uid(),'montada_sound','delete') or not public.has_line_perm(auth.uid(),'montada_sound','view') then
  raise exception 'No tienes permiso para borrar clientes de Sound';
 end if;
 update public.crm_sound_clientes set eliminado_en=now() where cliente_id=p_id and eliminado_en is null;
 if not found then raise exception 'Cliente no disponible o ya borrado';end if;
end $$;
revoke all on function public.borrar_cliente_sound(text) from public,anon;
grant execute on function public.borrar_cliente_sound(text) to authenticated;
