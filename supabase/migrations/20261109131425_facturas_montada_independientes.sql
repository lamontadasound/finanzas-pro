-- La Montada gestiona las facturas manualmente, al margen de sus ingresos.
-- Solo se retira el vínculo operativo: no cambia ningún dato fiscal ni documento.
UPDATE public.facturas
SET ingreso_id = NULL, porcentaje_facturado = 0
WHERE linea_negocio = 'montada_sound' AND ingreso_id IS NOT NULL;

-- También impide que una pestaña antigua vuelva a crear la relación.
ALTER TABLE public.facturas ADD CONSTRAINT facturas_montada_independientes
CHECK (linea_negocio IS DISTINCT FROM 'montada_sound' OR ingreso_id IS NULL);
-- El bloqueo de ingresos facturados y las políticas RLS permanecen intactos
-- para las demás líneas (incluido Real Madrid).
