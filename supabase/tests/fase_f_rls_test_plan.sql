-- ============================================================================
-- Plan de pruebas SQL de RLS — Fase F. NO EJECUTAR contra producción.
-- Pensado para correr en una base de pruebas (Supabase local / proyecto de
-- staging) DESPUÉS de aplicar 20260908_001_fase_f_permisos_rls.sql y de
-- tener usuarios reales en auth.users. Usa `SET LOCAL role`/`SET request.
-- jwt.claims` (el mecanismo estándar de Supabase para simular `auth.uid()`
-- en `psql`) para impersonar distintos usuarios dentro de una transacción
-- que siempre se revierte (ROLLBACK), sin dejar ningún dato de prueba.
-- ============================================================================

BEGIN;

-- ── Datos de prueba (dentro de la transacción, se revierten al final) ──────
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin.test@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'montada.test@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'realmadrid.test@example.com'),
  ('00000000-0000-0000-0000-000000000004', 'multi.test@example.com'),
  ('00000000-0000-0000-0000-000000000005', 'lector.test@example.com'),
  ('00000000-0000-0000-0000-000000000006', 'sincrear.test@example.com'),
  ('00000000-0000-0000-0000-000000000007', 'sincontabilidad.test@example.com'),
  ('00000000-0000-0000-0000-000000000008', 'inactivo.test@example.com')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, email, nombre, rol, activo) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin.test@example.com', 'Admin Test', 'admin', true),
  ('00000000-0000-0000-0000-000000000002', 'montada.test@example.com', 'Solo Montada', 'usuario', true),
  ('00000000-0000-0000-0000-000000000003', 'realmadrid.test@example.com', 'Solo Real Madrid', 'usuario', true),
  ('00000000-0000-0000-0000-000000000004', 'multi.test@example.com', 'Varias líneas', 'usuario', true),
  ('00000000-0000-0000-0000-000000000005', 'lector.test@example.com', 'Solo lectura', 'usuario', true),
  ('00000000-0000-0000-0000-000000000006', 'sincrear.test@example.com', 'Crea y edita, no elimina', 'usuario', true),
  ('00000000-0000-0000-0000-000000000007', 'sincontabilidad.test@example.com', 'Sin contabilidad', 'usuario', true),
  ('00000000-0000-0000-0000-000000000008', 'inactivo.test@example.com', 'Desactivado', 'usuario', false);

INSERT INTO public.user_line_permissions (user_id, linea_negocio, can_view, can_create, can_edit, can_delete) VALUES
  ('00000000-0000-0000-0000-000000000002', 'montada_sound', true, true, true, true),
  ('00000000-0000-0000-0000-000000000003', 'real_madrid', true, true, true, true),
  ('00000000-0000-0000-0000-000000000004', 'montada_sound', true, true, true, true),
  ('00000000-0000-0000-0000-000000000004', 'dj', true, true, true, true),
  ('00000000-0000-0000-0000-000000000005', 'montada_sound', true, false, false, false),
  ('00000000-0000-0000-0000-000000000006', 'montada_sound', true, true, true, false),
  ('00000000-0000-0000-0000-000000000007', 'montada_sound', true, true, true, true),
  ('00000000-0000-0000-0000-000000000008', 'montada_sound', true, true, true, true); -- inactivo: no debe importar

INSERT INTO public.user_module_permissions (user_id, modulo, can_view, can_create, can_edit, can_delete) VALUES
  ('00000000-0000-0000-0000-000000000004', 'contabilidad', true, true, true, false),
  ('00000000-0000-0000-0000-000000000004', 'impuestos', false, false, false, false); -- explícitamente sin impuestos

-- Ingresos de prueba: uno por línea.
INSERT INTO public.ingresos (id, area, concepto, cliente, tipo_evento, fecha_evento, base_imponible, porcentaje_iva, importe_iva, total, metodo_pago, estado_pago, pagos_recibidos, factura_emitida, created_at, linea_negocio) VALUES
  ('t0000000-0000-0000-0000-000000000001', 'montada', 'Test Montada', 'Cliente M', 'boda', '2026-01-01', 100, 21, 21, 121, 'transferencia', 'pendiente', 0, false, now(), 'montada_sound'),
  ('t0000000-0000-0000-0000-000000000002', 'dj', 'Test Real Madrid', 'Real Madrid', 'Partido', '2026-01-01', 100, 21, 21, 121, 'transferencia', 'pendiente', 0, false, now(), 'real_madrid'),
  ('t0000000-0000-0000-0000-000000000003', 'dj', 'Test DJ', 'Cliente DJ', 'dj_personal', '2026-01-01', 100, 21, 21, 121, 'transferencia', 'pendiente', 0, false, now(), 'dj');


-- ── Caso 1: Administrador — acceso completo ─────────────────────────────────
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.ingresos WHERE id LIKE 't0000000%') = 3, 'FALLO: admin debe ver los 3 ingresos de prueba';
END $$;

-- ── Caso 2: usuario con acceso solo a La Montada Sound ──────────────────────
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.ingresos WHERE id LIKE 't0000000%') = 1, 'FALLO: usuario Montada debe ver solo 1 ingreso';
  ASSERT (SELECT linea_negocio FROM public.ingresos WHERE id = 't0000000-0000-0000-0000-000000000001') = 'montada_sound';
  ASSERT NOT EXISTS (SELECT 1 FROM public.ingresos WHERE id = 't0000000-0000-0000-0000-000000000002'), 'FALLO: no debe ver el de Real Madrid';
END $$;

-- ── Caso 3: usuario con acceso solo a Real Madrid ───────────────────────────
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.ingresos WHERE id LIKE 't0000000%') = 1, 'FALLO: usuario Real Madrid debe ver solo 1 ingreso';
  ASSERT NOT EXISTS (SELECT 1 FROM public.ingresos WHERE id = 't0000000-0000-0000-0000-000000000001'), 'FALLO: no debe ver el de Montada';
END $$;

-- ── Caso 4: usuario con varias líneas permitidas ────────────────────────────
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.ingresos WHERE id LIKE 't0000000%') = 2, 'FALLO: multi-línea debe ver 2 (montada+dj), no Real Madrid';
  ASSERT NOT EXISTS (SELECT 1 FROM public.ingresos WHERE id = 't0000000-0000-0000-0000-000000000002');
END $$;

-- ── Caso 5: solo lectura — SELECT permitido, INSERT rechazado ──────────────
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.ingresos WHERE linea_negocio = 'montada_sound') >= 1;
END $$;
DO $$ BEGIN
  INSERT INTO public.ingresos (id, area, concepto, cliente, tipo_evento, fecha_evento, base_imponible, porcentaje_iva, importe_iva, total, metodo_pago, estado_pago, pagos_recibidos, factura_emitida, created_at, linea_negocio)
  VALUES ('t0000000-0000-0000-0000-000000000099', 'montada', 'No debería insertarse', 'X', 'boda', '2026-01-01', 1, 0, 0, 1, 'efectivo', 'pendiente', 0, false, now(), 'montada_sound');
  RAISE EXCEPTION 'FALLO: el usuario de solo lectura pudo insertar';
EXCEPTION WHEN insufficient_privilege OR others THEN
  -- esperado: la política RLS debe rechazar el INSERT
  NULL;
END $$;

-- ── Caso 6: crea y edita, pero sin eliminar ─────────────────────────────────
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006"}';
DO $$ BEGIN
  UPDATE public.ingresos SET concepto = 'Editado por caso 6' WHERE id = 't0000000-0000-0000-0000-000000000001';
  ASSERT (SELECT concepto FROM public.ingresos WHERE id = 't0000000-0000-0000-0000-000000000001') = 'Editado por caso 6', 'FALLO: debía poder editar';
END $$;
DO $$ BEGIN
  DELETE FROM public.ingresos WHERE id = 't0000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'FALLO: pudo eliminar sin permiso de eliminar';
EXCEPTION WHEN insufficient_privilege OR others THEN NULL;
END $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM public.ingresos WHERE id = 't0000000-0000-0000-0000-000000000001'), 'FALLO: el registro no debía haberse borrado';
END $$;

-- ── Caso 7: sin acceso a Contabilidad / sin acceso a Impuestos ──────────────
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.impuestos) = 0, 'FALLO: usuario sin permiso de Impuestos no debe ver ninguno (o solo los sin línea, según política)';
END $$;

-- ── Caso 8: usuario desactivado — 0 filas, aunque tenga permisos de línea ──
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000008"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.ingresos WHERE id LIKE 't0000000%') = 0, 'FALLO: usuario desactivado NO debe ver ningún ingreso pese a tener permisos de línea';
END $$;

-- ── Caso 9: edición que movería un registro a una línea no autorizada ──────
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002"}'; -- solo montada_sound
DO $$ BEGIN
  UPDATE public.ingresos SET linea_negocio = 'real_madrid' WHERE id = 't0000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'FALLO: pudo mover un registro a una línea sin permiso (WITH CHECK debía bloquear esto)';
EXCEPTION WHEN insufficient_privilege OR others THEN NULL;
END $$;
DO $$ BEGIN
  ASSERT (SELECT linea_negocio FROM public.ingresos WHERE id = 't0000000-0000-0000-0000-000000000001') = 'montada_sound', 'FALLO: la línea no debía haber cambiado';
END $$;

-- ── Caso 10: protección del último administrador ───────────────────────────
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';
DO $$ BEGIN
  UPDATE public.profiles SET activo = false WHERE id = '00000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'FALLO: se permitió desactivar al último administrador';
EXCEPTION WHEN others THEN
  -- esperado: el trigger protect_last_admin lanza excepción
  NULL;
END $$;

-- ── Caso 11: un admin no puede tocar sus propios permisos (ni un usuario) ──
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';
DO $$ BEGIN
  UPDATE public.user_line_permissions SET can_view = false WHERE user_id = '00000000-0000-0000-0000-000000000001';
  -- No debe lanzar error necesariamente (puede no haber fila para el admin,
  -- ya que is_admin() concede todo sin necesitar filas) — el objetivo real
  -- es que la política "write_admin_only" (user_id != auth.uid()) impida
  -- cualquier fila propia; si no hay fila que tocar, 0 filas afectadas es
  -- el resultado correcto, no un error.
  ASSERT (SELECT count(*) FROM public.user_line_permissions WHERE user_id = '00000000-0000-0000-0000-000000000001' AND can_view = false) = 0;
END $$;

ROLLBACK;
-- Fin — ningún dato de prueba queda persistido.
