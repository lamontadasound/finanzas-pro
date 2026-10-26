-- Extend the editable invoice path only to incomes belonging to Real Madrid.
-- Keep permissions, idempotency, invoice numbering and immutable triggers intact.
DO $migration$
DECLARE
 fn regprocedure := 'public.emitir_factura_independiente(text,text,text,text,text,numeric,numeric,numeric,numeric,text,text,numeric,text,jsonb,bigint,text)'::regprocedure;
 definition text;
 old_guard text := 'OR p_ingreso_id IS NOT NULL OR v_factura.ingreso_id IS NOT NULL THEN';
 new_guard text := $guard$OR p_ingreso_id IS DISTINCT FROM v_factura.ingreso_id
     OR (v_factura.ingreso_id IS NOT NULL AND (v_linea <> 'real_madrid'
       OR public.linea_de_ingreso(v_factura.ingreso_id) IS DISTINCT FROM 'real_madrid')) THEN$guard$;
 anchor text := $anchor$  IF v_factura.tipo <> 'emitida' THEN$anchor$;
 linked_checks text := $checks$  IF v_factura.ingreso_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_factura.ingreso_id,0));
    PERFORM 1 FROM public.ingresos WHERE id=v_factura.ingreso_id FOR SHARE;
    IF EXISTS (SELECT 1 FROM public.facturas other WHERE other.ingreso_id=v_factura.ingreso_id
      AND other.id<>p_factura_id AND other.tipo='emitida' AND other.numero_secuencial IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Este partido ya tiene una factura emitida. Abre la factura existente para editarla.';
    END IF;
  END IF;
$checks$;
BEGIN
 SELECT pg_get_functiondef(fn) INTO definition;
 IF position(old_guard in definition)=0 OR position(anchor in definition)=0 THEN
   RAISE EXCEPTION 'Unexpected invoice function; review before applying.';
 END IF;
 definition:=replace(definition,old_guard,new_guard);
 definition:=replace(definition,anchor,linked_checks||anchor);
 EXECUTE definition;
END;
$migration$;
