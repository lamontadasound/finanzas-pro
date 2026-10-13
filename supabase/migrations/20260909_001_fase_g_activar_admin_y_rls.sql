-- ============================================================================
-- FASE G — Activación: perfil administrador + cierre real de RLS.
-- PREPARADA, NO EJECUTADA. Para ejecutar en el SQL Editor de Supabase.
--
-- Administradora: juliacentenodj@gmail.com
-- UUID (auth.users.id) indicado por Julia: f700fe77-98f4-4cda-8c75-2524e782afcd
--
-- Este script NO usa el email como regla de autorización en ningún sitio —
-- el UUID literal de abajo es el ÚNICO dato que concede el rol de admin.
-- El email solo se usa en el paso 0 para verificar, una vez, que ese UUID
-- concreto pertenece de verdad a esa cuenta — es una comprobación de
-- integridad de un solo uso, no una regla de autorización que la app vaya
-- a evaluar en cada petición.
--
-- ORDEN CRÍTICO DE ESTE SCRIPT (por diseño, para no dejar a nadie sin
-- acceso a mitad de la migración):
--   0. Verifica el UUID contra auth.users — aborta toda la transacción si
--      no coincide exactamente con el email indicado.
--   1. Completa `linea_negocio` en las tablas financieras.
--   2. Crea `profiles`, `user_line_permissions`, `user_module_permissions`
--      (si no existen ya).
--   3. Crea las funciones auxiliares `is_admin`/`has_line_perm`/
--      `has_module_perm` (SECURITY DEFINER, `search_path` fijado).
--   4. Inserta el perfil administrador Y sus permisos completos — TODAVÍA
--      con las políticas antiguas `acceso_total` activas, así que este
--      paso siempre tiene éxito sin ninguna dependencia circular.
--   5. Solo AHORA se activa RLS en profiles/permisos y se sustituyen las
--      políticas abiertas `acceso_total` de las tablas financieras por las
--      restrictivas — el perfil admin ya existe, así que `is_admin(auth.uid())`
--      ya puede resolver a `true` para la cuenta de Julia en el mismo
--      instante en que las políticas nuevas entran en vigor.
--   6. Trigger de protección del último administrador.
--   7. Protección de la tabla `usuarios` (retirada del login antiguo).
--   8. Verificación posterior (DO block) — confirma perfil, rol, permisos y
--      que ninguna política abierta sigue viva; aborta si algo falla.
--
-- Idempotente: cada CREATE usa IF NOT EXISTS / OR REPLACE, cada INSERT usa
-- ON CONFLICT DO UPDATE, cada DROP POLICY usa IF EXISTS. Ejecutar este
-- script dos veces produce el mismo estado final, no duplica nada.
--
-- No borra ni renombra ninguna columna ni tabla existente. No modifica
-- importes, fechas, clientes, estados de cobro ni facturas. Conserva todos
-- los IDs actuales tal cual.
-- ============================================================================

BEGIN;

-- ── 0. Verificación previa del UUID — aborta si no coincide ────────────────
DO $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = 'f700fe77-98f4-4cda-8c75-2524e782afcd'::uuid;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: no existe ningún usuario en auth.users con el UUID f700fe77-98f4-4cda-8c75-2524e782afcd.';
  END IF;
  IF lower(v_email) IS DISTINCT FROM lower('juliacentenodj@gmail.com') THEN
    RAISE EXCEPTION 'ABORTADO: el UUID f700fe77-98f4-4cda-8c75-2524e782afcd corresponde a "%", no a "juliacentenodj@gmail.com". Revisa el UUID antes de continuar.', v_email;
  END IF;
  RAISE NOTICE 'Verificación OK: el UUID f700fe77-98f4-4cda-8c75-2524e782afcd corresponde a %.', v_email;
END $$;


-- ── 1. Completar linea_negocio en las tablas financieras ────────────────────
-- (idéntico al backfill ya auditado en 20260906_001 / 20260908_001 — no se
-- reclasifica nada distinto de lo ya confirmado por Julia).
ALTER TABLE ingresos      ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE gastos        ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE gastos_evento ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE pagos_evento  ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE suplidos      ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE facturas      ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE documentos    ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE impuestos     ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE equipo        ADD COLUMN IF NOT EXISTS linea_negocio TEXT;

UPDATE ingresos      SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE gastos         SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE gastos_evento  SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE pagos_evento   SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE suplidos       SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE facturas       SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE documentos     SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE equipo         SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';

-- Los 2 partidos de Real Madrid confirmados por Julia el 2026-09-06, por ID exacto.
UPDATE ingresos SET tipo_evento = 'Partido'
  WHERE id IN ('tavsmkotyqfms30yxr1', 'gsdi12lqqoms30zk7x') AND tipo_evento = 'Boda';

UPDATE ingresos SET linea_negocio = 'real_madrid'
  WHERE id IN ('tavsmkotyqfms30yxr1', 'gsdi12lqqoms30zk7x') AND linea_negocio IS DISTINCT FROM 'real_madrid';

UPDATE ingresos SET linea_negocio = 'real_madrid'
  WHERE linea_negocio IS NULL AND area = 'dj' AND tipo_evento IN ('real_madrid', 'Partido');

UPDATE gastos_evento ge SET linea_negocio = i.linea_negocio
  FROM ingresos i WHERE ge.ingreso_id = i.id AND ge.linea_negocio IS NULL AND i.linea_negocio = 'real_madrid';
UPDATE pagos_evento pe SET linea_negocio = i.linea_negocio
  FROM ingresos i WHERE pe.ingreso_id = i.id AND pe.linea_negocio IS NULL AND i.linea_negocio = 'real_madrid';
UPDATE suplidos su SET linea_negocio = i.linea_negocio
  FROM ingresos i WHERE su.ingreso_id = i.id AND su.linea_negocio IS NULL AND i.linea_negocio = 'real_madrid';

UPDATE equipo SET linea_negocio = 'real_madrid' WHERE linea_negocio IS NULL AND area = 'real_madrid';

UPDATE ingresos      SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE gastos         SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE gastos_evento  SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE pagos_evento   SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE suplidos       SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE facturas       SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE documentos     SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
-- Installations: sin backfill (0 filas todavía) — preparada para datos nuevos.


-- ── 2. Tablas del modelo de permisos ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  nombre        TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario')),
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sign_in_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.user_line_permissions (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  linea_negocio TEXT NOT NULL CHECK (linea_negocio IN ('montada_sound','dj','real_madrid','montada_installations')),
  can_view      BOOLEAN NOT NULL DEFAULT false,
  can_create    BOOLEAN NOT NULL DEFAULT false,
  can_edit      BOOLEAN NOT NULL DEFAULT false,
  can_delete    BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, linea_negocio)
);

CREATE TABLE IF NOT EXISTS public.user_module_permissions (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  modulo        TEXT NOT NULL CHECK (modulo IN ('contabilidad','informes','impuestos','administracion')),
  can_view      BOOLEAN NOT NULL DEFAULT false,
  can_create    BOOLEAN NOT NULL DEFAULT false,
  can_edit      BOOLEAN NOT NULL DEFAULT false,
  can_delete    BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, modulo)
);

CREATE INDEX IF NOT EXISTS idx_user_line_permissions_user ON public.user_line_permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_permissions_user ON public.user_module_permissions (user_id);


-- ── 3. Funciones auxiliares (SECURITY DEFINER, search_path fijado) ─────────
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND rol = 'admin' AND activo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_line_perm(p_user_id UUID, p_linea TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND activo = true)
    AND (
      public.is_admin(p_user_id)
      OR EXISTS (
        SELECT 1 FROM public.user_line_permissions ulp
        WHERE ulp.user_id = p_user_id
          AND ulp.linea_negocio = p_linea
          AND CASE p_action
                WHEN 'view'   THEN ulp.can_view
                WHEN 'create' THEN ulp.can_create
                WHEN 'edit'   THEN ulp.can_edit
                WHEN 'delete' THEN ulp.can_delete
                ELSE false
              END
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.has_module_perm(p_user_id UUID, p_modulo TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND activo = true)
    AND (
      public.is_admin(p_user_id)
      OR EXISTS (
        SELECT 1 FROM public.user_module_permissions ump
        WHERE ump.user_id = p_user_id
          AND ump.modulo = p_modulo
          AND CASE p_action
                WHEN 'view'   THEN ump.can_view
                WHEN 'create' THEN ump.can_create
                WHEN 'edit'   THEN ump.can_edit
                WHEN 'delete' THEN ump.can_delete
                ELSE false
              END
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_line_perm(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_module_perm(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_line_perm(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_module_perm(UUID, TEXT, TEXT) TO authenticated;


-- ── 4. Bootstrap del perfil administrador — ANTES de cerrar RLS ────────────
-- Único punto de todo el script donde se concede el rol admin, y se hace
-- por UUID literal exacto — nunca por email ni por ser "el primer usuario".
-- En este momento las tablas nuevas AÚN NO tienen RLS activada (se activa
-- en el paso 5), así que este INSERT no depende de ninguna política.
INSERT INTO public.profiles (id, email, nombre, rol, activo)
VALUES ('f700fe77-98f4-4cda-8c75-2524e782afcd'::uuid, 'juliacentenodj@gmail.com', 'Julia Centeno', 'admin', true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, nombre = EXCLUDED.nombre, rol = 'admin', activo = true;

INSERT INTO public.user_line_permissions (user_id, linea_negocio, can_view, can_create, can_edit, can_delete)
SELECT 'f700fe77-98f4-4cda-8c75-2524e782afcd'::uuid, linea, true, true, true, true
FROM unnest(ARRAY['montada_sound', 'dj', 'real_madrid', 'montada_installations']) AS linea
ON CONFLICT (user_id, linea_negocio) DO UPDATE SET
  can_view = true, can_create = true, can_edit = true, can_delete = true;

INSERT INTO public.user_module_permissions (user_id, modulo, can_view, can_create, can_edit, can_delete)
SELECT 'f700fe77-98f4-4cda-8c75-2524e782afcd'::uuid, modulo, true, true, true, true
FROM unnest(ARRAY['contabilidad', 'informes', 'impuestos', 'administracion']) AS modulo
ON CONFLICT (user_id, modulo) DO UPDATE SET
  can_view = true, can_create = true, can_edit = true, can_delete = true;

-- Nota: `is_admin()` por sí solo ya concede acceso completo a las 4 líneas y
-- los 4 módulos (ver definición del paso 3) — las filas de permisos de
-- arriba son redundantes para el propio admin, pero se insertan explícitas
-- de todos modos porque Julia las pidió de forma expresa ("acceso completo
-- ... en todas las líneas y módulos") y porque documentan el estado real
-- de la cuenta sin depender implícitamente de que `rol='admin'` siga
-- significando lo mismo para siempre.


-- ── 5a. RLS — profiles / permisos ───────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_line_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_or_admin" ON public.profiles;
CREATE POLICY "select_own_or_admin" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "update_admin_only" ON public.profiles;
CREATE POLICY "update_admin_only" ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()) AND id != auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) AND id != auth.uid());

DROP POLICY IF EXISTS "insert_admin_only" ON public.profiles;
CREATE POLICY "insert_admin_only" ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "select_own_or_admin" ON public.user_line_permissions;
CREATE POLICY "select_own_or_admin" ON public.user_line_permissions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "write_admin_only" ON public.user_line_permissions;
CREATE POLICY "write_admin_only" ON public.user_line_permissions FOR ALL
  USING (public.is_admin(auth.uid()) AND user_id != auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) AND user_id != auth.uid());

DROP POLICY IF EXISTS "select_own_or_admin" ON public.user_module_permissions;
CREATE POLICY "select_own_or_admin" ON public.user_module_permissions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "write_admin_only" ON public.user_module_permissions;
CREATE POLICY "write_admin_only" ON public.user_module_permissions FOR ALL
  USING (public.is_admin(auth.uid()) AND user_id != auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) AND user_id != auth.uid());
-- "user_id != auth.uid()" en las políticas de escritura: ni un admin puede
-- cambiar sus PROPIOS permisos por esta vía (protección contra
-- autoasignación / autobloqueo accidental).


-- ── 5b. RLS — tablas financieras con linea_negocio directa ─────────────────
-- CRÍTICO: se elimina "acceso_total" ANTES de crear las políticas nuevas.
-- Postgres combina políticas PERMISIVAS con OR — dejar "acceso_total"
-- (USING(true)) activa habría anulado por completo las políticas
-- restrictivas de abajo, sin ningún error visible. Auditado y corregido en
-- esta misma revisión.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['ingresos','gastos','facturas','equipo','impuestos','documentos']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "acceso_total" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "select_by_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "select_by_line_perm" ON public.%I FOR SELECT
        USING (
          public.is_admin(auth.uid())
          OR (linea_negocio IS NOT NULL AND public.has_line_perm(auth.uid(), linea_negocio, 'view'))
        )
    $p$, t);

    EXECUTE format('DROP POLICY IF EXISTS "insert_by_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "insert_by_line_perm" ON public.%I FOR INSERT
        WITH CHECK (
          public.is_admin(auth.uid())
          OR (linea_negocio IS NOT NULL AND public.has_line_perm(auth.uid(), linea_negocio, 'create'))
        )
    $p$, t);

    EXECUTE format('DROP POLICY IF EXISTS "update_by_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "update_by_line_perm" ON public.%I FOR UPDATE
        USING (
          public.is_admin(auth.uid())
          OR (linea_negocio IS NOT NULL AND public.has_line_perm(auth.uid(), linea_negocio, 'edit'))
        )
        WITH CHECK (
          public.is_admin(auth.uid())
          OR (linea_negocio IS NOT NULL AND public.has_line_perm(auth.uid(), linea_negocio, 'edit'))
        )
    $p$, t);

    EXECUTE format('DROP POLICY IF EXISTS "delete_by_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "delete_by_line_perm" ON public.%I FOR DELETE
        USING (
          public.is_admin(auth.uid())
          OR (linea_negocio IS NOT NULL AND public.has_line_perm(auth.uid(), linea_negocio, 'delete'))
        )
    $p$, t);
  END LOOP;
END $$;


-- ── 5c. RLS — tablas dependientes sin linea_negocio propia ─────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['gastos_evento','pagos_evento','suplidos']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "acceso_total" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "select_by_parent_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "select_by_parent_line_perm" ON public.%I FOR SELECT
        USING (
          public.is_admin(auth.uid())
          OR EXISTS (SELECT 1 FROM public.ingresos i WHERE i.id = %I.ingreso_id AND i.linea_negocio IS NOT NULL AND public.has_line_perm(auth.uid(), i.linea_negocio, 'view'))
        )
    $p$, t, t);

    EXECUTE format('DROP POLICY IF EXISTS "insert_by_parent_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "insert_by_parent_line_perm" ON public.%I FOR INSERT
        WITH CHECK (
          public.is_admin(auth.uid())
          OR EXISTS (SELECT 1 FROM public.ingresos i WHERE i.id = %I.ingreso_id AND i.linea_negocio IS NOT NULL AND public.has_line_perm(auth.uid(), i.linea_negocio, 'create'))
        )
    $p$, t, t);

    EXECUTE format('DROP POLICY IF EXISTS "update_by_parent_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "update_by_parent_line_perm" ON public.%I FOR UPDATE
        USING (
          public.is_admin(auth.uid())
          OR EXISTS (SELECT 1 FROM public.ingresos i WHERE i.id = %I.ingreso_id AND i.linea_negocio IS NOT NULL AND public.has_line_perm(auth.uid(), i.linea_negocio, 'edit'))
        )
        WITH CHECK (
          public.is_admin(auth.uid())
          OR EXISTS (SELECT 1 FROM public.ingresos i WHERE i.id = %I.ingreso_id AND i.linea_negocio IS NOT NULL AND public.has_line_perm(auth.uid(), i.linea_negocio, 'edit'))
        )
    $p$, t, t, t);

    EXECUTE format('DROP POLICY IF EXISTS "delete_by_parent_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "delete_by_parent_line_perm" ON public.%I FOR DELETE
        USING (
          public.is_admin(auth.uid())
          OR EXISTS (SELECT 1 FROM public.ingresos i WHERE i.id = %I.ingreso_id AND i.linea_negocio IS NOT NULL AND public.has_line_perm(auth.uid(), i.linea_negocio, 'delete'))
        )
    $p$, t, t);
  END LOOP;
END $$;


-- ── 5d. eventos, socios, movimientos_socios (monolínea La Montada Sound) ───
DROP POLICY IF EXISTS "acceso_total" ON public.eventos;
DROP POLICY IF EXISTS "select_montada_only" ON public.eventos;
CREATE POLICY "select_montada_only" ON public.eventos FOR SELECT
  USING (public.is_admin(auth.uid()) OR (area = 'montada' AND public.has_line_perm(auth.uid(), 'montada_sound', 'view')));
DROP POLICY IF EXISTS "insert_montada_only" ON public.eventos;
CREATE POLICY "insert_montada_only" ON public.eventos FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()) OR (area = 'montada' AND public.has_line_perm(auth.uid(), 'montada_sound', 'create')));
DROP POLICY IF EXISTS "update_montada_only" ON public.eventos;
CREATE POLICY "update_montada_only" ON public.eventos FOR UPDATE
  USING (public.is_admin(auth.uid()) OR (area = 'montada' AND public.has_line_perm(auth.uid(), 'montada_sound', 'edit')))
  WITH CHECK (public.is_admin(auth.uid()) OR (area = 'montada' AND public.has_line_perm(auth.uid(), 'montada_sound', 'edit')));
DROP POLICY IF EXISTS "delete_montada_only" ON public.eventos;
CREATE POLICY "delete_montada_only" ON public.eventos FOR DELETE
  USING (public.is_admin(auth.uid()) OR (area = 'montada' AND public.has_line_perm(auth.uid(), 'montada_sound', 'delete')));

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['socios','movimientos_socios']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "acceso_total" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "select_montada_only" ON public.%I', t);
    EXECUTE format($p$CREATE POLICY "select_montada_only" ON public.%I FOR SELECT
      USING (public.is_admin(auth.uid()) OR public.has_line_perm(auth.uid(), 'montada_sound', 'view'))$p$, t);
    EXECUTE format('DROP POLICY IF EXISTS "write_montada_only" ON public.%I', t);
    EXECUTE format($p$CREATE POLICY "write_montada_only" ON public.%I FOR ALL
      USING (public.is_admin(auth.uid()) OR public.has_line_perm(auth.uid(), 'montada_sound', 'edit'))
      WITH CHECK (public.is_admin(auth.uid()) OR public.has_line_perm(auth.uid(), 'montada_sound', 'edit'))$p$, t);
  END LOOP;
END $$;


-- ── 6. Trigger — protección del último administrador ────────────────────────
CREATE OR REPLACE FUNCTION public.protect_last_admin()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  admins_restantes INT;
BEGIN
  IF OLD.rol = 'admin' AND OLD.activo = true
     AND (NEW.rol != 'admin' OR NEW.activo = false) THEN
    SELECT count(*) INTO admins_restantes FROM public.profiles WHERE rol = 'admin' AND activo = true AND id != OLD.id;
    IF admins_restantes = 0 THEN
      RAISE EXCEPTION 'No se puede quitar el rol de administrador ni desactivar al último administrador activo.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_last_admin ON public.profiles;
CREATE TRIGGER trg_protect_last_admin
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin();


-- ── 7. Retirada segura de `usuarios` (login antiguo) — sin borrar datos ────
DROP POLICY IF EXISTS "acceso_total" ON public.usuarios;
DROP POLICY IF EXISTS "admin_only" ON public.usuarios;
CREATE POLICY "admin_only" ON public.usuarios FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

REVOKE SELECT (password_hash) ON public.usuarios FROM PUBLIC, anon, authenticated;


-- Legacy financial tables: preserve rows, close obsolete public policies.
DO $$ DECLARE t text; p record; BEGIN
 FOR t IN SELECT unnest(ARRAY['gastos_recurrentes','historial_pagos']) LOOP
  IF to_regclass('public.'||t) IS NOT NULL THEN
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
   FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
    EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
   END LOOP;
  END IF;
 END LOOP;
END $$;

-- ── 8. Verificación posterior — aborta si algo no quedó como se esperaba ───
DO $$
DECLARE
  v_rol TEXT;
  v_activo BOOLEAN;
  v_lineas INT;
  v_modulos INT;
  v_policies_abiertas INT;
BEGIN
  SELECT rol, activo INTO v_rol, v_activo FROM public.profiles WHERE id = 'f700fe77-98f4-4cda-8c75-2524e782afcd'::uuid;
  IF v_rol IS DISTINCT FROM 'admin' OR v_activo IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ABORTADO: el perfil administrador no quedó correcto (rol=%, activo=%).', v_rol, v_activo;
  END IF;

  SELECT count(*) INTO v_lineas FROM public.user_line_permissions
    WHERE user_id = 'f700fe77-98f4-4cda-8c75-2524e782afcd'::uuid AND can_view AND can_create AND can_edit AND can_delete;
  IF v_lineas != 4 THEN
    RAISE EXCEPTION 'ABORTADO: se esperaban 4 líneas con acceso completo, hay %.', v_lineas;
  END IF;

  SELECT count(*) INTO v_modulos FROM public.user_module_permissions
    WHERE user_id = 'f700fe77-98f4-4cda-8c75-2524e782afcd'::uuid AND can_view AND can_create AND can_edit AND can_delete;
  IF v_modulos != 4 THEN
    RAISE EXCEPTION 'ABORTADO: se esperaban 4 módulos con acceso completo, hay %.', v_modulos;
  END IF;

  SELECT count(*) INTO v_policies_abiertas
    FROM pg_policies
    WHERE schemaname = 'public' AND policyname = 'acceso_total';
  IF v_policies_abiertas > 0 THEN
    RAISE EXCEPTION 'ABORTADO: todavía quedan % políticas "acceso_total" abiertas.', v_policies_abiertas;
  END IF;

  RAISE NOTICE 'Verificación final OK: perfil admin activo, 4/4 líneas y 4/4 módulos con acceso completo, 0 políticas "acceso_total" abiertas.';
END $$;

COMMIT;

-- ============================================================================
-- Si CUALQUIER paso de arriba lanza una excepción, Postgres revierte TODA la
-- transacción automáticamente — no hace falta un ROLLBACK manual mientras el
-- error ocurra ANTES del COMMIT. La base de datos queda exactamente como
-- estaba antes de ejecutar este script.
-- ============================================================================
