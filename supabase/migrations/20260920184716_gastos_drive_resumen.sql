create table public.drive_expense_amounts (
 file_id text primary key references public.drive_invoice_files(id) on delete cascade,
 source_modified_at timestamptz,
 estado text not null default 'pendiente' check (estado in ('pendiente','leido','excluido')),
 proveedor text not null default '', numero_factura text not null default '',
 fecha_factura date, base numeric(14,2), iva numeric(14,2), total numeric(14,2),
 retencion numeric(14,2) not null default 0,
 moneda text not null default 'EUR' check (moneda='EUR'),
 nota text not null default '', evidencia text not null default '',
 actualizado_en timestamptz not null default now(),
 check(estado<>'leido' or (base is not null and iva is not null and total is not null and abs(base+iva-retencion-total)<=0.05))
);
alter table public.drive_expense_amounts enable row level security;
create policy drive_amounts_read on public.drive_expense_amounts for select to authenticated using (
 (public.is_admin(auth.uid()) or (public.has_module_perm(auth.uid(),'contabilidad','view')
 and public.has_line_perm(auth.uid(),'montada_sound','view') and public.has_line_perm(auth.uid(),'montada_installations','view')
 and public.has_line_perm(auth.uid(),'real_madrid','view') and public.has_line_perm(auth.uid(),'dj','view')))
 and exists(select 1 from public.drive_invoice_files f where f.id=file_id and f.tipo='recibida'));
create policy drive_amounts_insert on public.drive_expense_amounts for insert to authenticated with check(public.is_admin(auth.uid()));
create policy drive_amounts_update on public.drive_expense_amounts for update to authenticated using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
revoke all on public.drive_expense_amounts from public,anon,authenticated;
grant select,insert,update on public.drive_expense_amounts to authenticated;
grant all on public.drive_expense_amounts to service_role;
create function public.check_drive_expense_source() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare f public.drive_invoice_files;
begin
 select * into f from public.drive_invoice_files where id=new.file_id;
 if not found or f.tipo<>'recibida' then raise exception 'Solo se admiten documentos de gastos de Drive';end if;
 if new.source_modified_at is distinct from f.actualizado_en then raise exception 'El documento ha cambiado. Actualiza antes de guardar';end if;
 new.actualizado_en=now();return new;
end $$;
create trigger check_drive_expense_source before insert or update on public.drive_expense_amounts for each row execute function public.check_drive_expense_source();
-- Changes in Drive leave the old extraction as an audit reference. The client excludes it
-- until source_modified_at matches actualizado_en again. Deletions cascade atomically.
