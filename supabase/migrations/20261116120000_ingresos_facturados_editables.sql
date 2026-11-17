-- Permite editar ingresos aunque ya tengan factura emitida (cliente, importes,
-- línea). La factura emitida sigue sin poder modificarse (trigger
-- proteger_factura_emitida) y el ingreso facturado sigue sin poder borrarse.
CREATE OR REPLACE FUNCTION public.protect_invoiced_income() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' AND EXISTS(SELECT 1 FROM public.facturas WHERE ingreso_id=OLD.id AND numero_secuencial IS NOT NULL) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='No se puede borrar un ingreso con facturas emitidas.';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
