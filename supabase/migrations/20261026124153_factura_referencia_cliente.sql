-- Preserve a per-invoice external reference in the existing customer snapshot.
-- Replace only the snapshot whitelist; retain numbering, locks, grants and guards.
DO $migration$
DECLARE
 fn regprocedure := 'public.emitir_factura_independiente(text,text,text,text,text,numeric,numeric,numeric,numeric,text,text,numeric,text,jsonb,bigint,text)'::regprocedure;
 definition text;
 original text := $old$'telefono',left(coalesce(p_datos_cliente->>'telefono',''),50));$old$;
 replacement text := $new$'telefono',left(coalesce(p_datos_cliente->>'telefono',''),50),
    'referenciaFactura',trim(coalesce(p_datos_cliente->>'referenciaFactura','')));$new$;
BEGIN
 SELECT pg_get_functiondef(fn) INTO definition;
 IF position(original in definition)=0 THEN
  RAISE EXCEPTION 'Unexpected invoice snapshot definition; review before applying.';
 END IF;
 EXECUTE replace(definition,original,replacement);
END;
$migration$;
