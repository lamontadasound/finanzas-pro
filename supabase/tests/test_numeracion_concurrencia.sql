-- ============================================================================
-- PRUEBAS DE INTEGRACIÓN — numeración transaccional (Fase H)
-- NO EJECUTADO todavía en ningún entorno. Preparado para correr contra un
-- Postgres/Supabase LOCAL o de PRUEBAS (nunca contra producción) DESPUÉS de
-- aplicar 20260910_001_fase_h_facturacion.sql y ANTES de aprobar esa
-- migración para producción — ver el orden corregido del plan de activación
-- en el informe de esta fase.
--
-- Cómo ejecutar (cuando haya un Postgres/Supabase local disponible):
--   supabase start                     # o: docker run postgres local
--   psql "$DATABASE_URL" -f supabase/migrations/20260910_001_fase_h_facturacion.sql
--   psql "$DATABASE_URL" -f supabase/tests/test_numeracion_concurrencia.sql
--
-- Cada bloque usa RAISE EXCEPTION si el resultado no es el esperado — un
-- `psql -f` que termina sin error significa que TODAS las aserciones
-- pasaron. Los escenarios de concurrencia real (dos sesiones a la vez) se
-- simulan con dos transacciones en la MISMA sesión usando `pg_sleep` y
-- `dblink`/dos conexiones reales — aquí se deja el caso más simple
-- (secuencial, determinista) más una NOTA de cómo probar la concurrencia
-- real con dos terminales `psql` en paralelo, que es lo único que puede
-- demostrar el bloqueo de fila de verdad (un solo proceso no puede probar
-- una espera entre dos transacciones concurrentes consigo mismo).
-- ============================================================================

-- ── SETUP OBLIGATORIO ANTES DE ESTE SCRIPT (no se puede hacer solo con SQL
-- contra `auth.users` de forma fiable — Supabase Auth exige columnas y
-- disparadores internos que cambian entre versiones) ────────────────────────
--   1. En el proyecto de Supabase LOCAL/de pruebas, crear un usuario real:
--        supabase.auth.admin.createUser({ id: '00000000-0000-0000-0000-000000000001',
--          email: 'admin-pruebas@ejemplo.com', email_confirm: true })
--      (o desde Supabase Studio → Authentication → Add user, fijando ese UUID).
--   2. Ejecutar como ese usuario o como service_role:
--        INSERT INTO public.profiles (id, email, nombre, rol, activo)
--        VALUES ('00000000-0000-0000-0000-000000000001', 'admin-pruebas@ejemplo.com', 'Admin de pruebas', 'admin', true)
--        ON CONFLICT (id) DO UPDATE SET rol = 'admin', activo = true;
--      (rol='admin' hace que is_admin() baste para todas las comprobaciones
--      de esta prueba, sin tener que dar de alta permisos de línea uno a uno).
-- ============================================================================

BEGIN;

-- 1) Sesión del admin de pruebas ya creado en el paso de setup de arriba.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);

INSERT INTO public.configuracion_fiscal (id, razon_social, nif_cif)
VALUES ('test', 'Empresa de Pruebas SL', 'B99999999')
ON CONFLICT (id) DO UPDATE SET razon_social = EXCLUDED.razon_social, nif_cif = EXCLUDED.nif_cif;

-- ── Escenario 1: dos "emisiones simultáneas" (secuencial en esta sesión;
-- ver nota de concurrencia real más abajo) — deben salir números distintos.
DO $$
DECLARE v_id1 UUID := gen_random_uuid(); v_id2 UUID := gen_random_uuid();
        v_n1 BIGINT; v_n2 BIGINT;
BEGIN
  PERFORM public.fijar_numero_inicial_factura(1, 'test', '');
  INSERT INTO public.facturas (id, area, tipo, numero, cliente, concepto, base_imponible, porcentaje_iva, importe_iva, total, fecha, pagada, iva_deducible)
    VALUES (v_id1, 'montada', 'emitida', '', 'Cliente 1', 'Test 1', 100, 21, 21, 121, CURRENT_DATE, false, false);
  INSERT INTO public.facturas (id, area, tipo, numero, cliente, concepto, base_imponible, porcentaje_iva, importe_iva, total, fecha, pagada, iva_deducible)
    VALUES (v_id2, 'montada', 'emitida', '', 'Cliente 2', 'Test 2', 100, 21, 21, 121, CURRENT_DATE, false, false);
  SELECT numero INTO v_n1 FROM public.emitir_numero_factura(v_id1, 'montada', 'emitida', 'Cliente 1', 'Test 1', 100, 21, 21, 121, CURRENT_DATE, NULL, NULL, NULL, 'test', '', 'montada_sound');
  SELECT numero INTO v_n2 FROM public.emitir_numero_factura(v_id2, 'montada', 'emitida', 'Cliente 2', 'Test 2', 100, 21, 21, 121, CURRENT_DATE, NULL, NULL, NULL, 'test', '', 'montada_sound');
  IF v_n1 = v_n2 THEN RAISE EXCEPTION 'FALLO escenario 1: números duplicados (% = %)', v_n1, v_n2; END IF;
  IF v_n2 != v_n1 + 1 THEN RAISE EXCEPTION 'FALLO escenario 1: no son consecutivos (% , %)', v_n1, v_n2; END IF;
  RAISE NOTICE 'OK escenario 1: números % y % — distintos y consecutivos', v_n1, v_n2;
END $$;

-- ── Escenario 2: reintento de la misma solicitud (mismo factura_id) debe
-- devolver el MISMO número, no consumir uno nuevo.
DO $$
DECLARE v_id UUID := gen_random_uuid(); v_n1 BIGINT; v_n2 BIGINT;
BEGIN
  INSERT INTO public.facturas (id, area, tipo, numero, cliente, concepto, base_imponible, porcentaje_iva, importe_iva, total, fecha, pagada, iva_deducible)
    VALUES (v_id, 'montada', 'emitida', '', 'Cliente 3', 'Test 3', 100, 21, 21, 121, CURRENT_DATE, false, false);
  SELECT numero INTO v_n1 FROM public.emitir_numero_factura(v_id, 'montada', 'emitida', 'Cliente 3', 'Test 3', 100, 21, 21, 121, CURRENT_DATE, NULL, NULL, NULL, 'test', '', 'montada_sound');
  SELECT numero INTO v_n2 FROM public.emitir_numero_factura(v_id, 'montada', 'emitida', 'Cliente 3', 'Test 3', 100, 21, 21, 121, CURRENT_DATE, NULL, NULL, NULL, 'test', '', 'montada_sound'); -- mismo id: reintento
  IF v_n1 != v_n2 THEN RAISE EXCEPTION 'FALLO escenario 2 (reintento/doble clic): números distintos % vs %', v_n1, v_n2; END IF;
  RAISE NOTICE 'OK escenario 2: reintento devuelve el mismo número (%)', v_n1;
END $$;

-- ── Escenario 3: dos facturas parciales que superarían el 100% — la
-- segunda debe rechazarse.
DO $$
DECLARE v_ingreso UUID := gen_random_uuid(); v_id1 UUID := gen_random_uuid(); v_id2 UUID := gen_random_uuid();
        v_fallo BOOLEAN := false;
BEGIN
  INSERT INTO public.facturas (id, area, tipo, numero, cliente, concepto, base_imponible, porcentaje_iva, importe_iva, total, fecha, pagada, iva_deducible, ingreso_id)
    VALUES (v_id1, 'montada', 'emitida', '', 'Cliente 4', 'Parcial 70%', 700, 21, 147, 847, CURRENT_DATE, false, false, v_ingreso);
  INSERT INTO public.facturas (id, area, tipo, numero, cliente, concepto, base_imponible, porcentaje_iva, importe_iva, total, fecha, pagada, iva_deducible, ingreso_id)
    VALUES (v_id2, 'montada', 'emitida', '', 'Cliente 4', 'Parcial 60%', 600, 21, 126, 726, CURRENT_DATE, false, false, v_ingreso);
  PERFORM public.emitir_numero_factura(v_id1, 'montada', 'emitida', 'Cliente 4', 'Parcial 70%', 700, 21, 147, 847, CURRENT_DATE, v_ingreso, 70, NULL, 'test', '', 'montada_sound');
  BEGIN
    PERFORM public.emitir_numero_factura(v_id2, 'montada', 'emitida', 'Cliente 4', 'Parcial 60%', 600, 21, 126, 726, CURRENT_DATE, v_ingreso, 60, NULL, 'test', '', 'montada_sound');
  EXCEPTION WHEN OTHERS THEN v_fallo := true;
  END;
  IF NOT v_fallo THEN RAISE EXCEPTION 'FALLO escenario 3: se permitió superar el 100%% facturado del ingreso'; END IF;
  RAISE NOTICE 'OK escenario 3: la segunda factura parcial (70%%+60%%=130%%) fue rechazada correctamente';
END $$;

-- ── Escenario 4: fallo DESPUÉS de asignar el número (dentro de la misma
-- transacción) — el contador NO debe quedar consumido. Se fuerza el fallo
-- violando a propósito el CHECK de `estado` en la propia factura destino
-- (un valor inválido), que solo puede detectarse DESPUÉS de que
-- `emitir_numero_factura` ya haya incrementado `numeracion_contador` — así
-- se prueba que el ROLLBACK de la función revierte también el contador,
-- justo lo que una SEQUENCE de Postgres NO habría hecho.
DO $$
DECLARE v_id UUID := gen_random_uuid(); v_antes BIGINT; v_despues BIGINT;
BEGIN
  SELECT ultimo_numero INTO v_antes FROM public.numeracion_contador WHERE emisor_id = 'test' AND serie = '';
  -- No se inserta la fila borrador a propósito: `emitir_numero_factura` hace
  -- `UPDATE ... WHERE id = p_factura_id` y, al no encontrar la fila, lanza
  -- `IF NOT FOUND THEN RAISE EXCEPTION` — ESTO ocurre DESPUÉS de haber
  -- incrementado ya el contador, que es exactamente el punto crítico a probar.
  BEGIN
    PERFORM public.emitir_numero_factura(v_id, 'montada', 'emitida', 'Cliente 5', 'Test 5', 100, 21, 21, 121, CURRENT_DATE, NULL, NULL, NULL, 'test', '', 'montada_sound');
    RAISE EXCEPTION 'FALLO escenario 4: se esperaba un error (factura inexistente) y no lo hubo';
  EXCEPTION WHEN OTHERS THEN
    -- Sub-transacción (savepoint implícito del bloque BEGIN/EXCEPTION):
    -- el UPDATE del contador dentro de emitir_numero_factura se revierte
    -- aquí — se comprueba que el valor NO avanzó.
    NULL;
  END;
  SELECT ultimo_numero INTO v_despues FROM public.numeracion_contador WHERE emisor_id = 'test' AND serie = '';
  IF v_antes != v_despues THEN
    RAISE EXCEPTION 'FALLO escenario 4: el contador avanzó de % a % pese al fallo posterior — número perdido', v_antes, v_despues;
  END IF;
  RAISE NOTICE 'OK escenario 4: el contador se mantuvo en % tras el fallo — no se perdió ningún número', v_antes;
END $$;

ROLLBACK; -- nunca se compromete nada de este script de prueba

-- ============================================================================
-- ESCENARIO "dos emisiones REALMENTE concurrentes" (con espera de bloqueo
-- real) requiere dos transacciones/conexiones separadas
-- superpuestas en el tiempo — no se pueden expresar en un único script
-- secuencial de psql. Cómo probarlos manualmente con dos terminales:
--
--   Terminal A                          Terminal B
--   ----------                          ----------
--   BEGIN;
--   SELECT 1 FROM numeracion_contador
--     WHERE emisor_id='test' AND serie=''
--     FOR UPDATE;                       BEGIN;
--                                        SELECT 1 FROM numeracion_contador
--                                          WHERE emisor_id='test' AND serie=''
--                                          FOR UPDATE;  -- <- debe QUEDARSE
--                                                            ESPERANDO aquí
--   ROLLBACK;                           -- ahora B debe desbloquearse
--                                        -- y ver el valor SIN el intento de A
--                                        ROLLBACK;
--
-- Si B se desbloquea ANTES del ROLLBACK/COMMIT de A, el bloqueo no está
-- funcionando — replantear el índice/PK de `numeracion_contador`.
-- ============================================================================
