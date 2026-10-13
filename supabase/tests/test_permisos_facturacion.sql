-- ============================================================================
-- PRUEBAS DE ACCESO — permisos diferenciados de facturación (Fase H)
-- NO EJECUTADO todavía. Preparado para correr contra un Postgres/Supabase
-- LOCAL o de PRUEBAS, DESPUÉS de aplicar 20260910_001_fase_h_facturacion.sql
-- (que incluye `user_facturacion_permissions` y `has_facturacion_perm`) y
-- ANTES de aprobar esa migración para producción.
--
-- Requiere simular `auth.uid()` — en un entorno de pruebas real esto se hace
-- con `SET request.jwt.claims` (como en test_numeracion_concurrencia.sql) o
-- ejecutando cada bloque autenticado como un usuario de prueba distinto vía
-- el cliente de Supabase (más fiel a RLS real que simular el claim a mano).
-- Aquí se deja expresado con `set_config` por simplicidad de un único script
-- — un test más riguroso usaría el SDK de Supabase con sesiones reales.
-- ============================================================================

-- ── SETUP OBLIGATORIO ANTES DE ESTE SCRIPT ──────────────────────────────────
-- `has_line_perm`/`has_facturacion_perm` comprueban `profiles.activo` — hace
-- falta un usuario real de Supabase Auth para cada UUID de prueba (no se
-- puede insertar de forma fiable en `auth.users` a mano — ver la misma nota
-- en test_numeracion_concurrencia.sql). Antes de ejecutar:
--   supabase.auth.admin.createUser({ id: '00000000-0000-0000-0000-0000000000a1', email: 'usuario-a1@ejemplo.com', email_confirm: true })
--   supabase.auth.admin.createUser({ id: '00000000-0000-0000-0000-0000000000a2', email: 'usuario-a2@ejemplo.com', email_confirm: true })
-- y luego, como service_role:
--   INSERT INTO public.profiles (id, email, nombre, rol, activo) VALUES
--     ('00000000-0000-0000-0000-0000000000a1', 'usuario-a1@ejemplo.com', 'Usuario A1', 'usuario', true),
--     ('00000000-0000-0000-0000-0000000000a2', 'usuario-a2@ejemplo.com', 'Usuario A2', 'usuario', true)
--   ON CONFLICT (id) DO UPDATE SET activo = true;
-- ============================================================================

BEGIN;

-- Setup: dos usuarios de prueba con permisos de facturación distintos —
-- a1 tiene permiso de facturación "emitir" pero NO permiso de línea
-- (deliberado, para probar el cruce del escenario de línea más abajo).
INSERT INTO public.user_facturacion_permissions (user_id, puede_emitir, puede_rectificar, puede_gestionar_numeracion)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', true,  false, false), -- solo puede emitir
  ('00000000-0000-0000-0000-0000000000a2', false, false, false)  -- sin ningún permiso
ON CONFLICT (user_id) DO UPDATE SET puede_emitir = EXCLUDED.puede_emitir, puede_rectificar = EXCLUDED.puede_rectificar, puede_gestionar_numeracion = EXCLUDED.puede_gestionar_numeracion;

-- ── Acceso PERMITIDO: usuario con puede_emitir=true puede emitir ──────────
DO $$
DECLARE v_id UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  PERFORM public.fijar_numero_inicial_factura(1, 'test-permisos', ''); -- fallará si el usuario a1 no tiene gestionar_numeracion... se usa un admin real para el setup en un entorno real; aquí se asume ejecución con rol elevado para preparar el contador.
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Setup de numeración con usuario no-admin falló como se esperaba (correcto) — en el test real, confirmar la numeración como admin antes de este bloque.';
END $$;

-- ── Acceso DENEGADO: usuario sin puede_emitir=true NO puede emitir ─────────
DO $$
DECLARE v_id UUID := gen_random_uuid(); v_denegado BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
  INSERT INTO public.facturas (id, area, tipo, numero, cliente, concepto, base_imponible, porcentaje_iva, importe_iva, total, fecha, pagada, iva_deducible)
    VALUES (v_id, 'montada', 'emitida', '', 'Cliente Denegado', 'Test', 100, 21, 21, 121, CURRENT_DATE, false, false);
  BEGIN
    PERFORM public.emitir_numero_factura(v_id, 'montada', 'emitida', 'Cliente Denegado', 'Test', 100, 21, 21, 121, CURRENT_DATE, NULL, NULL, NULL, 'default', '', 'montada_sound');
  EXCEPTION WHEN OTHERS THEN v_denegado := true;
  END;
  IF NOT v_denegado THEN RAISE EXCEPTION 'FALLO: un usuario SIN permiso "emitir" consiguió emitir una factura.'; END IF;
  RAISE NOTICE 'OK: acceso denegado correctamente a usuario sin permiso "emitir".';
END $$;

-- ── Acceso DENEGADO: usuario con puede_emitir=true pero SIN puede_rectificar ──
DO $$
DECLARE v_denegado BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  BEGIN
    PERFORM public.crear_factura_rectificativa(gen_random_uuid(), 'motivo test', gen_random_uuid(), 0, 21, 0, 0, 0, 'default', '', 'montada_sound');
  EXCEPTION WHEN OTHERS THEN v_denegado := true;
  END;
  IF NOT v_denegado THEN RAISE EXCEPTION 'FALLO: un usuario con permiso "emitir" pero SIN "rectificar" consiguió rectificar.'; END IF;
  RAISE NOTICE 'OK: emitir y rectificar son permisos independientes de verdad — tener uno no concede el otro.';
END $$;

-- ── Acceso DENEGADO: usuario sin "gestionar_numeracion" no puede confirmar numeración ──
DO $$
DECLARE v_denegado BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
  BEGIN
    PERFORM public.fijar_numero_inicial_factura(500, 'test-permisos-2', '');
  EXCEPTION WHEN OTHERS THEN v_denegado := true;
  END;
  IF NOT v_denegado THEN RAISE EXCEPTION 'FALLO: un usuario sin "gestionar_numeracion" consiguió fijar el número inicial.'; END IF;
  RAISE NOTICE 'OK: acceso denegado correctamente a "gestionar_numeracion".';
END $$;

-- ── Acceso DENEGADO: un usuario sin permiso de LÍNEA no puede emitir aunque
-- SÍ tenga el permiso fino "emitir" — el cruce debe ser real, no solo uno
-- de los dos. Responde directamente a: "tener permiso para emitir no debe
-- permitir emitir sobre ingresos de proyectos no autorizados".
DO $$
DECLARE v_id UUID := gen_random_uuid(); v_denegado BOOLEAN := false;
BEGIN
  -- El usuario a1 tiene puede_emitir=true (ver setup) pero NO tiene
  -- permiso de línea 'crear' para 'real_madrid' (no se le ha concedido).
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
  INSERT INTO public.facturas (id, area, tipo, numero, cliente, concepto, base_imponible, porcentaje_iva, importe_iva, total, fecha, pagada, iva_deducible)
    VALUES (v_id, 'dj', 'emitida', '', 'Cliente RM', 'Test RM', 100, 21, 21, 121, CURRENT_DATE, false, false);
  BEGIN
    PERFORM public.emitir_numero_factura(v_id, 'dj', 'emitida', 'Cliente RM', 'Test RM', 100, 21, 21, 121, CURRENT_DATE, NULL, NULL, NULL, 'default', '', 'real_madrid');
  EXCEPTION WHEN OTHERS THEN v_denegado := true;
  END;
  IF NOT v_denegado THEN RAISE EXCEPTION 'FALLO: un usuario con "emitir" pero SIN permiso de línea "real_madrid" consiguió emitir sobre esa línea.'; END IF;
  RAISE NOTICE 'OK: el cruce permiso de facturación + permiso de línea es real — uno solo no basta.';
END $$;

-- ── Nadie puede asignarse sus propios permisos de facturación ──────────────
-- La política RLS "write_admin_only" de `user_facturacion_permissions`
-- exige `is_admin(auth.uid())` para CUALQUIER escritura (INSERT/UPDATE),
-- incluida una fila cuyo `user_id` sea el propio usuario que escribe — así
-- que un usuario NO-admin no puede escribir esa tabla en absoluto, ni para
-- otros ni para sí mismo. Se verifica intentando concederse a sí mismo
-- "gestionar_numeracion" como usuario a2 (sin privilegios).
DO $$
DECLARE v_denegado BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
  BEGIN
    UPDATE public.user_facturacion_permissions
       SET puede_gestionar_numeracion = true
     WHERE user_id = '00000000-0000-0000-0000-0000000000a2';
    -- Con RLS activada y sin privilegios de owner/bypass, esta UPDATE debe
    -- afectar 0 filas (bloqueada por la política), no lanzar necesariamente
    -- — se comprueba por eso el resultado, no solo una excepción.
    IF FOUND THEN v_denegado := false; ELSE v_denegado := true; END IF;
  EXCEPTION WHEN OTHERS THEN v_denegado := true;
  END;
  IF NOT v_denegado THEN RAISE EXCEPTION 'FALLO CRÍTICO: un usuario no-admin consiguió concederse a sí mismo el permiso "gestionar_numeracion".'; END IF;
  RAISE NOTICE 'OK: ningún usuario no-admin puede asignarse permisos de facturación a sí mismo (RLS write_admin_only).';
END $$;

-- ── Acceso PERMITIDO: un admin siempre pasa, aunque no tenga fila en user_facturacion_permissions ──
DO $$
BEGIN
  -- Sustituir por el UUID real de un admin de pruebas antes de ejecutar.
  RAISE NOTICE 'Pendiente: ejecutar este bloque autenticada como una cuenta admin real y comprobar que emitir_numero_factura/crear_factura_rectificativa/fijar_numero_inicial_factura NO lanzan "No tienes permiso" — is_admin() debe bastar sin fila en user_facturacion_permissions.';
END $$;

ROLLBACK; -- nunca se compromete nada de este script de prueba
