-- Cambio solicitado por Julia: importes de reparto manuales y categoría Gestoría.
-- No modifica ingresos, gastos, facturas ni movimientos existentes.
BEGIN;
ALTER TABLE public.impuestos DROP CONSTRAINT IF EXISTS impuestos_tipo_check;
ALTER TABLE public.impuestos ADD CONSTRAINT impuestos_tipo_check CHECK (tipo IN ('autonomos','nominas_ss','iva','sociedades','gestoria'));
-- Conservar las fichas duplicadas antiguas; archivar solo las cuatro sin movimientos.
UPDATE public.socios s SET activo=false
WHERE s.id IN ('oc2acwmmt6mtu72hs3','2cl8wvq4ov6mtu72hs0','5wf94vt1c5rmtu72hs3','pzpea9ge2vcmtu72hs1')
AND s.linea_negocio='montada_sound' AND s.nombre IN ('Julia','Rodrigo')
AND NOT EXISTS (SELECT 1 FROM public.movimientos_socios m WHERE m.socio_id=s.id);
INSERT INTO public.socios(id,nombre,porcentaje,created_at,activo,linea_negocio)
SELECT gen_random_uuid()::text,v.nombre,0,now(),true,v.linea
FROM (VALUES ('montada_sound','Julia'),('montada_sound','Marco'),('montada_sound','Rodrigo'),('montada_installations','Julia'),('montada_installations','Marco'),('montada_installations','Eduma')) v(linea,nombre)
WHERE NOT EXISTS (SELECT 1 FROM public.socios s WHERE s.linea_negocio=v.linea AND lower(trim(s.nombre))=lower(v.nombre) AND coalesce(s.activo,true));
-- La política RLS existente sigue comprobando la línea del socio.
CREATE OR REPLACE FUNCTION public.validate_installations_partner_movement() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.socios WHERE id=NEW.socio_id AND linea_negocio='montada_installations')
 AND NEW.tipo<>'reparto_beneficio_cobrado'
 AND (TG_OP='INSERT' OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.socio_id IS DISTINCT FROM OLD.socio_id) THEN
  RAISE EXCEPTION 'Installations solo admite repartos de beneficio; no aportaciones de capital.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_installations_partner_movement() FROM PUBLIC;
DROP TRIGGER IF EXISTS validate_installations_partner_movement ON public.movimientos_socios;
CREATE TRIGGER validate_installations_partner_movement BEFORE INSERT OR UPDATE ON public.movimientos_socios
FOR EACH ROW EXECUTE FUNCTION public.validate_installations_partner_movement();
COMMIT;
-- Reversión: volver al frontend anterior no borra movimientos. Conservar gestoria
-- si ya tiene registros. Los IDs originales no se eliminan; activar fichas archivadas
-- solo tras revisión, para no volver a mostrar socios duplicados.
