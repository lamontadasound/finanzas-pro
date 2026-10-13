-- Preserve existing records and read permissions; limit new/edited quotes to these two lines.
create policy presupuesto_lineas_insert on public.presupuestos as restrictive
for insert to authenticated
with check (linea_negocio in ('montada_sound','montada_installations'));
create policy presupuesto_lineas_update on public.presupuestos as restrictive
for update to authenticated
using (linea_negocio in ('montada_sound','montada_installations'))
with check (linea_negocio in ('montada_sound','montada_installations'));
