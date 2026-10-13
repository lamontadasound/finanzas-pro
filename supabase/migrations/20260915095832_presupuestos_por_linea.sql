-- Dedicated quotes; independent of invoices and accounting balances.
create table public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  linea_negocio text not null check (linea_negocio in ('montada_sound','dj','real_madrid','montada_installations')),
  contenido jsonb not null check (jsonb_typeof(contenido) = 'object' and octet_length(contenido::text) <= 500000),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  constraint presupuesto_estado check (coalesce(contenido->>'estado', '') in ('borrador','pendiente','aceptado','rechazado')),
  constraint presupuesto_conceptos check (coalesce(jsonb_typeof(contenido->'conceptos'), '') = 'array' and jsonb_array_length(contenido->'conceptos') between 1 and 100)
);
create index presupuestos_linea_numero on public.presupuestos(linea_negocio, numero desc);
create index presupuestos_created_by on public.presupuestos(created_by);
alter table public.presupuestos enable row level security;
revoke all on public.presupuestos from public, anon, authenticated;
grant select, delete on public.presupuestos to authenticated;
grant insert (linea_negocio, contenido) on public.presupuestos to authenticated;
grant update (contenido, revision) on public.presupuestos to authenticated;
grant usage on sequence public.presupuestos_numero_seq to authenticated;
create policy presupuesto_select on public.presupuestos for select to authenticated
  using (public.has_line_perm((select auth.uid()), linea_negocio, 'view'));
create policy presupuesto_insert on public.presupuestos for insert to authenticated
  with check (created_by = (select auth.uid()) and public.has_line_perm((select auth.uid()), linea_negocio, 'view') and public.has_line_perm((select auth.uid()), linea_negocio, 'create'));
create policy presupuesto_update on public.presupuestos for update to authenticated
  using (public.has_line_perm((select auth.uid()), linea_negocio, 'view') and public.has_line_perm((select auth.uid()), linea_negocio, 'edit'))
  with check (public.has_line_perm((select auth.uid()), linea_negocio, 'view') and public.has_line_perm((select auth.uid()), linea_negocio, 'edit'));
create policy presupuesto_delete on public.presupuestos for delete to authenticated
  using (public.has_line_perm((select auth.uid()), linea_negocio, 'view') and public.has_line_perm((select auth.uid()), linea_negocio, 'delete'));
