-- Usa únicamente tipos explícitos, coincidencia exacta y única de cliente,
-- y un único servicio histórico. No interpreta nombres ni descripciones.
with known as (
 select lower(trim(cliente)) as nombre,
 case lower(trim(tipo_evento)) when 'alquiler' then 'alquiler' when 'boda' then 'boda' when 'evento corporativo' then 'corporativo' when 'evento privado' then 'privado' else null end as servicio
 from public.ingresos where linea_negocio='montada_sound' or (linea_negocio is null and area='montada')
), unique_type as (
 select nombre,min(servicio) as servicio from known group by nombre having count(distinct servicio)=1 and count(servicio)=count(*)
)
update public.crm_sound_clientes crm set tipo_servicio=k.servicio
from public.clientes c join unique_type k on lower(trim(c.nombre))=k.nombre
where crm.cliente_id=c.id and crm.tipo_servicio='sin_clasificar'
and (select count(*) from public.clientes other where lower(trim(other.nombre))=k.nombre)=1;
