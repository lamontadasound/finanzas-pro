-- ACTIVACIÓN ÚNICA. Leer ACTIVACION.md y verificar backup/proyecto antes de ejecutar.
-- No ejecutar F, G y H por separado. No crea usuarios Auth ni emite facturas.

BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
CREATE TEMP TABLE finance_baseline(table_name text,id text,payload jsonb,PRIMARY KEY(table_name,id)) ON COMMIT DROP;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['ingresos','gastos','facturas','equipo','impuestos','documentos','gastos_evento','pagos_evento','suplidos','eventos','socios','movimientos_socios','usuarios'] LOOP
  IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'Falta tabla %. No ejecutar el esquema histórico a ciegas: revisar el proyecto conectado.',t; END IF;
  EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',t);
  EXECUTE format('INSERT INTO finance_baseline SELECT %L,id::text,to_jsonb(x)-''linea_negocio''-CASE WHEN %L=''ingresos'' AND id::text IN (''tavsmkotyqfms30yxr1'',''gsdi12lqqoms30zk7x'') THEN ''tipo_evento'' ELSE ''__no_field__'' END FROM public.%I x',t,t,t);
 END LOOP;
END $$;
-- SOURCE supabase/migrations/20260909_001_fase_g_activar_admin_y_rls.sql
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


-- ============================================================================
-- Si CUALQUIER paso de arriba lanza una excepción, Postgres revierte TODA la
-- transacción automáticamente — no hace falta un ROLLBACK manual mientras el
-- error ocurra ANTES del COMMIT. La base de datos queda exactamente como
-- estaba antes de ejecutar este script.
-- ============================================================================

-- SOURCE supabase/migrations/20260910_001_fase_h_facturacion.sql
-- ============================================================================
-- FASE H — Facturación: numeración transaccional, emisores fiscales,
-- permisos finos, snapshots y sincronización con Drive.
-- PREPARADA, NO EJECUTADA. NO VERIFICADA CONTRA POSTGRES REAL.
--
-- Revisión 2 — corrige nueve defectos reales encontrados auditando la
-- revisión 1. Cada uno está marcado en su sitio con [FIX-n]:
--
--   [FIX-1] TIPOS DE ID. La revisión 1 declaraba `p_factura_id UUID`,
--           `p_ingreso_id UUID`, `p_fecha DATE`, `clientes.id UUID` y una
--           clave ajena `factura_rectifica_id UUID REFERENCES facturas(id)`.
--           El esquema real (20260713_001_schema_completo.sql) usa
--           `facturas.id TEXT`, `ingresos.id TEXT`, `facturas.fecha TEXT`:
--           los ids los genera el cliente con `uid()` (base36, NO UUID).
--           La clave ajena UUID→TEXT hacía FALLAR la migración entera al
--           ejecutarse. Aquí todo es TEXT, coincidiendo con lo existente.
--   [FIX-2] UNICIDAD POR EMISOR Y SERIE. El índice único era global sobre
--           `numero_secuencial`: con dos emisores, cada uno con su contador,
--           el segundo colisionaba contra el primero. Ahora es único por
--           (emisor_id, serie, numero_secuencial), y `facturas` guarda
--           `emisor_id` para poder indexarlo.
--   [FIX-3] REINTENTO CONCURRENTE. La comprobación de idempotencia leía
--           `numero_secuencial` SIN bloquear la fila: dos llamadas
--           simultáneas con el mismo `p_factura_id` (doble clic, reintento)
--           leían NULL las dos y ambas consumían número. Ahora se bloquea la
--           fila de la factura (FOR UPDATE) ANTES de comprobar y asignar.
--   [FIX-4] CONFIANZA EN EL NAVEGADOR. `p_linea_id` y `p_emisor_id` venían
--           del cliente: bastaba enviar una línea permitida para emitir
--           sobre un ingreso de otra. Ahora la línea se DERIVA del registro
--           real de `ingresos` y el emisor de `proyecto_emisor`; el
--           navegador ya no envía ninguno de los dos.
--   [FIX-5] RLS DEL CONTADOR. `numeracion_contador` no tenía RLS: era
--           legible y ESCRIBIBLE directamente vía PostgREST con la anon key.
--   [FIX-6] FACTURAS EMITIDAS SIN PROTECCIÓN. Nada impedía UPDATE/DELETE
--           directo de una factura ya emitida saltándose las funciones.
--   [FIX-7] CARRERA AL CREAR LA FILA DEL CONTADOR. `PERFORM ... FOR UPDATE`
--           + `IF NOT FOUND THEN INSERT` no es atómico: dos transacciones
--           simultáneas insertaban a la vez y una moría por unicidad. Ahora
--           `INSERT ... ON CONFLICT DO NOTHING` y después el FOR UPDATE.
--   [FIX-8] EMISOR DE LA RECTIFICATIVA. Se leía del snapshot JSON o del
--           cliente. Ahora se lee de `facturas.emisor_id` de la ORIGINAL,
--           en el servidor.
--   [FIX-9] REVERSIÓN. El plan anterior hacía DROP de `configuracion_fiscal`
--           y `clientes` (pérdida de datos). Ver el plan del final: conserva
--           datos y NUNCA reabre políticas públicas.
--
-- Aditiva e idempotente. No borra ni renombra ninguna columna existente.
-- Depende de: 20260908 (permisos) y 20260909 (Auth/RLS/admin), que definen
-- `is_admin`, `has_line_perm` y `has_module_perm`.
-- ============================================================================


ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS gasto_id TEXT REFERENCES public.gastos(id);

-- ══ 1. Columnas nuevas en `facturas` — todas opcionales, aditivas ══════════
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS estado TEXT
  CHECK (estado IN ('borrador','emitida','parcialmente_cobrada','cobrada','anulada','pendiente_sincronizar','error_sincronizacion'));
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS porcentaje_facturado NUMERIC;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS numero_secuencial BIGINT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS retencion NUMERIC;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS fecha_emision TIMESTAMPTZ;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS emitida_por UUID;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS anulada_por UUID;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMPTZ;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS historial JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS numero_proveedor TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS proveedor TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS posible_duplicado BOOLEAN DEFAULT false;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS documento_id TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_link TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_nombre_archivo TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_fecha_subida TIMESTAMPTZ;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_subido_por UUID;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS sync_estado TEXT
  CHECK (sync_estado IN ('sin_sincronizar','sincronizada','pendiente','error'));
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS sync_ultimo_error TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS emisor_snapshot JSONB;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS cliente_snapshot JSONB;
-- [FIX-1] TEXT, no UUID: `facturas.id` es TEXT en el esquema real.
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS factura_rectifica_id TEXT REFERENCES public.facturas(id);
-- [FIX-2] Emisor bajo el que se emitió: necesario para la unicidad por
-- (emisor, serie) y para que la rectificativa herede el emisor correcto.
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS emisor_id TEXT;


-- ══ 2. Emisores fiscales y asignación por línea ═══════════════════════════
-- Varias filas: una por emisor real. 'default' es el emisor migrado del
-- modelo antiguo de fila única. `id` es TEXT (lo fija un admin o `uid()`).
CREATE TABLE IF NOT EXISTS public.configuracion_fiscal (
  id                    TEXT PRIMARY KEY DEFAULT 'default',
  nombre_interno        TEXT,
  razon_social          TEXT,
  nombre_comercial      TEXT,
  nif_cif               TEXT,
  direccion_fiscal      TEXT,
  email                 TEXT,
  telefono              TEXT,
  iban                  TEXT,
  logo_url              TEXT,
  condiciones_pago      TEXT,
  texto_legal           TEXT,
  serie_formato         TEXT DEFAULT '{numero}',
  numero_inicial        BIGINT,
  numeracion_confirmada BOOLEAN NOT NULL DEFAULT false,
  activo                BOOLEAN NOT NULL DEFAULT true,
  actualizado_por       UUID,
  actualizado_en        TIMESTAMPTZ
);
-- Idempotencia ante una ejecución parcial previa de esta misma migración.
ALTER TABLE public.configuracion_fiscal ADD COLUMN IF NOT EXISTS nombre_interno TEXT;
ALTER TABLE public.configuracion_fiscal ADD COLUMN IF NOT EXISTS numeracion_confirmada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.configuracion_fiscal ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.configuracion_fiscal DROP CONSTRAINT IF EXISTS solo_fila_default;

CREATE TABLE IF NOT EXISTS public.proyecto_emisor (
  linea_id        TEXT PRIMARY KEY
                  CHECK (linea_id IN ('montada_sound','dj','real_madrid','montada_installations')),
  emisor_id       TEXT NOT NULL REFERENCES public.configuracion_fiscal(id),
  actualizado_por UUID,
  actualizado_en  TIMESTAMPTZ DEFAULT now()
);


-- ══ 3. Clientes ═══════════════════════════════════════════════════════════
-- [FIX-1] `id TEXT`: el cliente lo genera con `uid()` (base36), no con
-- gen_random_uuid(). Con UUID, cada alta desde la app fallaba.
CREATE TABLE IF NOT EXISTS public.clientes (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  nif_cif       TEXT,
  direccion     TEXT,
  email         TEXT,
  telefono      TEXT,
  es_empresa    BOOLEAN NOT NULL DEFAULT true,
  observaciones TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ══ 4. Numeración: contador transaccional por (emisor, serie) ═════════════
-- No es una SEQUENCE: `nextval()` NO es transaccional (un ROLLBACK no
-- devuelve el número consumido). Una fila de tabla normal, bloqueada con
-- FOR UPDATE, sí participa por completo en la transacción y se revierte.
CREATE TABLE IF NOT EXISTS public.numeracion_contador (
  emisor_id     TEXT NOT NULL DEFAULT 'default',
  serie         TEXT NOT NULL DEFAULT '',
  ultimo_numero BIGINT NOT NULL DEFAULT 0,
  confirmado    BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (emisor_id, serie)
);

CREATE TABLE IF NOT EXISTS public.numeracion_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero      BIGINT NOT NULL,
  emisor_id   TEXT NOT NULL DEFAULT 'default',
  serie       TEXT NOT NULL DEFAULT '',
  factura_id  TEXT,                              -- [FIX-1] TEXT, no UUID
  user_id     UUID NOT NULL,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_numeracion_log_numero
  ON public.numeracion_log (emisor_id, serie, numero);


-- ══ 5. Permisos finos de facturación ══════════════════════════════════════
-- Independientes del CRUD genérico del módulo `contabilidad`: se puede
-- poder VER facturas sin poder EMITIRlas, RECTIFICARlas ni GESTIONAR la
-- numeración. Se comprueban DENTRO de las funciones, no solo en la interfaz.
CREATE TABLE IF NOT EXISTS public.user_facturacion_permissions (
  user_id                    UUID PRIMARY KEY,
  puede_emitir               BOOLEAN NOT NULL DEFAULT false,
  puede_rectificar           BOOLEAN NOT NULL DEFAULT false,
  puede_gestionar_numeracion BOOLEAN NOT NULL DEFAULT false,
  actualizado_por            UUID,
  actualizado_en             TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.has_facturacion_perm(p_user_id UUID, p_accion TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.user_facturacion_permissions;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_user_id AND activo) THEN RETURN false; END IF;
  IF public.is_admin(p_user_id) THEN RETURN true; END IF;
  SELECT * INTO v_row FROM public.user_facturacion_permissions WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;   -- deny-by-default
  RETURN CASE p_accion
    WHEN 'emitir'               THEN v_row.puede_emitir
    WHEN 'rectificar'           THEN v_row.puede_rectificar
    WHEN 'gestionar_numeracion' THEN v_row.puede_gestionar_numeracion
    ELSE false
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.has_facturacion_perm(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_facturacion_perm(UUID, TEXT) TO authenticated;


-- ══ 6. [FIX-4] Derivación en el servidor: línea y emisor ══════════════════
-- El navegador ya NO envía la línea ni el emisor. La línea se deriva del
-- registro real de `ingresos`, replicando exactamente la lógica de
-- `resolveLinea` del frontend (src/config/resolveLinea.ts); el emisor sale
-- de `proyecto_emisor`.
CREATE OR REPLACE FUNCTION public.linea_de_ingreso(p_ingreso_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ing RECORD;
BEGIN
  IF p_ingreso_id IS NULL THEN RETURN NULL; END IF;
  SELECT i.id, i.area, i.tipo_evento, i.linea_negocio INTO v_ing
    FROM public.ingresos i WHERE i.id = p_ingreso_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_ing.linea_negocio IN ('montada_sound','dj','real_madrid','montada_installations') THEN RETURN v_ing.linea_negocio; END IF;
  IF v_ing.linea_negocio = 'La Montada Installations' THEN RETURN 'montada_installations'; END IF;
  IF v_ing.linea_negocio = 'Real Madrid' THEN RETURN 'real_madrid'; END IF;
  IF v_ing.linea_negocio = 'La Montada Sound' THEN RETURN 'montada_sound'; END IF;
  IF v_ing.area = 'montada' THEN RETURN 'montada_sound'; END IF;
  IF v_ing.id IN ('tavsmkotyqfms30yxr1','gsdi12lqqoms30zk7x') OR v_ing.tipo_evento IN ('Partido','real_madrid') THEN RETURN 'real_madrid'; END IF;
  RETURN 'dj';
END;
$$;
REVOKE ALL ON FUNCTION public.linea_de_ingreso(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.linea_de_ingreso(TEXT) TO authenticated;

-- Emisor asignado a una línea. Sin asignación explícita cae al emisor
-- 'default' (el migrado) — nunca a "el primero de la lista". Devuelve NULL
-- si no hay ninguno activo: quien llame debe fallar, no inventarse uno.
CREATE OR REPLACE FUNCTION public.emisor_de_linea(p_linea TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pe.emisor_id FROM public.proyecto_emisor pe
  JOIN public.configuracion_fiscal cf ON cf.id=pe.emisor_id AND cf.activo
  WHERE pe.linea_id=p_linea;

$$;
REVOKE ALL ON FUNCTION public.emisor_de_linea(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emisor_de_linea(TEXT) TO authenticated;


-- ══ 7. Emisión: número + guardado en UNA operación atómica ════════════════
-- [FIX-3] Bloquea la fila de la factura ANTES de comprobar idempotencia y de
--         asignar número: cierra la carrera del doble clic / reintento.
-- [FIX-4] Deriva línea y emisor del registro real; el cliente no los envía.
-- [FIX-7] Crea la fila del contador con ON CONFLICT DO NOTHING (atómico).
CREATE OR REPLACE FUNCTION public.emitir_numero_factura(
  p_factura_id TEXT,
  p_area TEXT, p_tipo TEXT, p_cliente TEXT, p_concepto TEXT,
  p_base_imponible NUMERIC, p_porcentaje_iva NUMERIC, p_importe_iva NUMERIC,
  p_total NUMERIC, p_fecha TEXT, p_ingreso_id TEXT,
  p_porcentaje_facturado NUMERIC, p_notas TEXT DEFAULT NULL
)
RETURNS TABLE (numero_emitido BIGINT, emisor_asignado TEXT, serie_asignada TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_factura   RECORD;
  v_linea     TEXT;
  v_emisor_id TEXT;
  v_serie     TEXT;
  v_numero    BIGINT;
  v_emisor    JSONB;
  v_cliente   JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  -- [FIX-3] Bloqueo de la fila de la factura ANTES de nada. Una segunda
  -- llamada concurrente con el mismo id espera aquí; cuando entra, ya ve el
  -- `numero_secuencial` escrito por la primera y sale por idempotencia.
  SELECT * INTO v_factura FROM public.facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura % no existe — créala como borrador antes de emitir.', p_factura_id;
  END IF;

  v_linea := public.linea_de_ingreso(v_factura.ingreso_id);
  IF NOT public.has_facturacion_perm(auth.uid(),'emitir') OR v_linea IS NULL
     OR NOT public.has_line_perm(auth.uid(),v_linea,'create')
     OR p_ingreso_id IS DISTINCT FROM v_factura.ingreso_id THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='No tienes permiso sobre esta factura o su ingreso.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_factura.ingreso_id,0));
  PERFORM 1 FROM public.ingresos WHERE id=v_factura.ingreso_id FOR SHARE;
  IF v_factura.numero_secuencial IS NOT NULL THEN
    RETURN QUERY SELECT v_factura.numero_secuencial, v_factura.emisor_id, COALESCE(v_factura.serie, '');
    RETURN;
  END IF;

  IF v_factura.tipo <> 'emitida' THEN
    RAISE EXCEPTION 'Solo se numeran facturas emitidas (esta es de tipo %).', v_factura.tipo;
  END IF;

  IF NOT public.has_facturacion_perm(auth.uid(), 'emitir') THEN
    RAISE EXCEPTION 'No tienes permiso para emitir facturas.';
  END IF;

  -- [FIX-4] Línea DERIVADA del ingreso real, no enviada por el navegador.
  v_linea := public.linea_de_ingreso(v_factura.ingreso_id);
  IF v_linea IS NULL THEN
    RAISE EXCEPTION 'No se puede determinar la línea de negocio: la factura debe estar vinculada a un ingreso existente.';
  END IF;
  IF NOT public.has_line_perm(auth.uid(), v_linea, 'create') THEN
    RAISE EXCEPTION 'No tienes permiso para emitir facturas en la línea %.', v_linea;
  END IF;

  -- [FIX-4] Emisor DERIVADO de la asignación del proyecto, no del cliente.
  v_emisor_id := public.emisor_de_linea(v_linea);
  IF v_emisor_id IS NULL THEN
    RAISE EXCEPTION 'La línea % no tiene ningún emisor fiscal activo asignado. Asígnalo en Administración antes de emitir.', v_linea;
  END IF;

  SELECT to_jsonb(cf) INTO v_emisor FROM public.configuracion_fiscal cf WHERE cf.id = v_emisor_id;
  IF NULLIF(trim(COALESCE(v_emisor->>'razon_social','')), '') IS NULL
     OR NULLIF(trim(COALESCE(v_emisor->>'nif_cif','')), '') IS NULL THEN
    RAISE EXCEPTION 'Faltan datos fiscales obligatorios del emisor % (razón social / NIF-CIF).', v_emisor_id;
  END IF;
  v_serie := COALESCE(v_factura.serie, '');

  SELECT to_jsonb(c) INTO v_cliente FROM public.clientes c
   WHERE lower(trim(c.nombre)) = lower(trim(p_cliente)) LIMIT 1;

  IF p_porcentaje_facturado IS NULL OR p_porcentaje_facturado <= 0 OR p_porcentaje_facturado > 100
     OR p_porcentaje_facturado::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Porcentaje no válido.';
  END IF;
  IF p_tipo <> 'emitida' OR p_area IS DISTINCT FROM v_factura.area OR trim(COALESCE(p_concepto,''))='' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Datos de factura no válidos.';
  END IF;
  IF v_cliente IS NULL OR NULLIF(trim(v_cliente->>'nif_cif'),'') IS NULL OR NULLIF(trim(v_cliente->>'direccion'),'') IS NULL
     OR NULLIF(trim(v_emisor->>'direccion_fiscal'),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Completa los datos fiscales de emisor y cliente (NIF y dirección).';
  END IF;
  IF (SELECT count(*) FROM public.clientes WHERE lower(trim(nombre))=lower(trim(p_cliente))) <> 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='La ficha fiscal del cliente es ambigua.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ingresos i WHERE i.id=v_factura.ingreso_id
     AND i.cliente=p_cliente AND i.area=p_area AND i.base_imponible>0
     AND p_base_imponible=round(i.base_imponible*p_porcentaje_facturado/100,2)
     AND p_porcentaje_iva=i.porcentaje_iva
     AND p_importe_iva=round(p_base_imponible*i.porcentaje_iva/100,2)
     AND p_total=p_base_imponible+p_importe_iva) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Los importes no coinciden con el ingreso y el porcentaje.';
  END IF;
  PERFORM p_fecha::date;
  -- [FIX-7] Alta atómica de la fila del contador y luego bloqueo.
  INSERT INTO public.numeracion_contador (emisor_id, serie, ultimo_numero, confirmado)
  VALUES (v_emisor_id, v_serie, 0, false)
  ON CONFLICT (emisor_id, serie) DO NOTHING;

  PERFORM 1 FROM public.numeracion_contador
   WHERE emisor_id = v_emisor_id AND serie = v_serie FOR UPDATE;

  IF NOT (SELECT confirmado FROM public.numeracion_contador
           WHERE emisor_id = v_emisor_id AND serie = v_serie) THEN
    RAISE EXCEPTION 'La numeración del emisor % (serie "%") no ha sido confirmada por un administrador.', v_emisor_id, v_serie;
  END IF;

  UPDATE public.numeracion_contador
     SET ultimo_numero = ultimo_numero + 1
   WHERE emisor_id = v_emisor_id AND serie = v_serie
   RETURNING ultimo_numero INTO v_numero;

  INSERT INTO public.numeracion_log (numero, emisor_id, serie, factura_id, user_id)
  VALUES (v_numero, v_emisor_id, v_serie, p_factura_id, auth.uid());

  -- [FIX-6] Marca de operación privilegiada: deja pasar ESTE update ante el
  -- trigger de inmutabilidad, y solo este.
  PERFORM set_config('app.facturacion_privilegiada', 'on', true);

  UPDATE public.facturas SET
    numero = v_numero::text, numero_secuencial = v_numero,
    emisor_id = v_emisor_id, serie = v_serie,
    area = p_area, tipo = p_tipo, cliente = p_cliente, concepto = p_concepto,
    base_imponible = p_base_imponible, porcentaje_iva = p_porcentaje_iva,
    importe_iva = p_importe_iva, total = p_total, fecha = p_fecha,
    ingreso_id = COALESCE(p_ingreso_id, ingreso_id),
    porcentaje_facturado = p_porcentaje_facturado,
    notas = p_notas, linea_negocio = v_linea, estado = 'emitida',
    fecha_emision = now(), emitida_por = auth.uid(),
    emisor_snapshot = v_emisor, cliente_snapshot = v_cliente,
    historial = COALESCE(historial, '[]'::jsonb) || jsonb_build_object(
      'fecha', now(), 'usuarioId', auth.uid(), 'accion', 'emitida',
      'detalle', format('Nº %s · emisor %s · línea %s', v_numero, v_emisor_id, v_linea))
  WHERE id = p_factura_id;

  PERFORM set_config('app.facturacion_privilegiada', 'off', true);

  RETURN QUERY SELECT v_numero, v_emisor_id, v_serie;
END;
$$;
REVOKE ALL ON FUNCTION public.emitir_numero_factura(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emitir_numero_factura(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;


-- ══ 8. Confirmación del número inicial, por (emisor, serie) ═══════════════
CREATE OR REPLACE FUNCTION public.fijar_numero_inicial_factura(
  p_numero_inicial BIGINT, p_emisor_id TEXT DEFAULT 'default', p_serie TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_facturacion_perm(auth.uid(), 'gestionar_numeracion') THEN
    RAISE EXCEPTION 'No tienes permiso para configurar la numeración de facturación.';
  END IF;
  IF p_numero_inicial IS NULL OR p_numero_inicial < 1 THEN
    RAISE EXCEPTION 'El número inicial debe ser un entero positivo.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.configuracion_fiscal WHERE id = p_emisor_id) THEN
    RAISE EXCEPTION 'El emisor % no existe.', p_emisor_id;
  END IF;
  INSERT INTO public.numeracion_contador(emisor_id,serie) VALUES(p_emisor_id,p_serie) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.numeracion_contador WHERE emisor_id=p_emisor_id AND serie=p_serie FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.numeracion_log WHERE emisor_id = p_emisor_id AND serie = p_serie) THEN
    RAISE EXCEPTION 'Ya se han emitido facturas con esta numeración — no se puede reiniciar el contador.';
  END IF;

  INSERT INTO public.numeracion_contador (emisor_id, serie, ultimo_numero, confirmado)
  VALUES (p_emisor_id, p_serie, p_numero_inicial - 1, true)
  ON CONFLICT (emisor_id, serie)
    DO UPDATE SET ultimo_numero = EXCLUDED.ultimo_numero, confirmado = true;

  UPDATE public.configuracion_fiscal
     SET numeracion_confirmada = true, numero_inicial = p_numero_inicial,
         actualizado_por = auth.uid(), actualizado_en = now()
   WHERE id = p_emisor_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fijar_numero_inicial_factura(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fijar_numero_inicial_factura(BIGINT, TEXT, TEXT) TO authenticated;


-- ══ 9. Rectificación ══════════════════════════════════════════════════════
-- La original se CONSERVA íntegra (solo pasa a 'anulada') y se emite una
-- rectificativa enlazada, con número nuevo del MISMO contador de la
-- original. Quien sume facturación debe excluir siempre 'anulada': así la
-- original deja de contar y solo cuenta la rectificativa, sin doble cómputo.
-- [FIX-8] El emisor sale de `facturas.emisor_id` de la ORIGINAL, en el
--         servidor: nunca se re-resuelve por la asignación actual (que pudo
--         cambiar) ni se acepta del navegador.
CREATE OR REPLACE FUNCTION public.crear_factura_rectificativa(
  p_original_id TEXT, p_motivo TEXT, p_nueva_factura_id TEXT,
  p_base_imponible NUMERIC, p_porcentaje_iva NUMERIC, p_importe_iva NUMERIC,
  p_total NUMERIC, p_porcentaje_facturado NUMERIC
)
RETURNS TABLE (numero_emitido BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orig   RECORD;
  v_linea  TEXT;
  v_serie  TEXT;
  v_numero BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado.'; END IF;
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'El motivo de la rectificación es obligatorio.';
  END IF;
  IF NOT public.has_facturacion_perm(auth.uid(), 'rectificar') THEN
    RAISE EXCEPTION 'No tienes permiso para rectificar facturas.';
  END IF;

  -- Bloqueo de la original: dos rectificaciones simultáneas se serializan y
  -- la segunda ve `estado='anulada'` y sale.
  SELECT * INTO v_orig FROM public.facturas WHERE id = p_original_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura original no encontrada.'; END IF;
  v_linea := v_orig.linea_negocio;
  IF v_linea IS NULL OR NOT public.has_line_perm(auth.uid(),v_linea,'edit') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='No tienes permiso sobre esta factura.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.facturas WHERE id=p_nueva_factura_id AND factura_rectifica_id=p_original_id) THEN
    RETURN QUERY SELECT numero_secuencial FROM public.facturas WHERE id=p_nueva_factura_id;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_orig.ingreso_id,0));
  IF p_total IS NULL OR p_total < 0 OR p_total > v_orig.total OR p_total::text IN ('NaN','Infinity','-Infinity')
     OR p_base_imponible IS NULL OR p_importe_iva IS NULL OR p_porcentaje_facturado IS NULL
     OR p_porcentaje_iva IS DISTINCT FROM v_orig.porcentaje_iva
     OR p_base_imponible <> round(p_total/(1+p_porcentaje_iva/100),2)
     OR p_importe_iva <> p_total-p_base_imponible
     OR NOT EXISTS(SELECT 1 FROM public.ingresos WHERE id=v_orig.ingreso_id AND total>0
                   AND p_porcentaje_facturado=round(p_total/total*100,2)) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Importes de rectificación no válidos.';
  END IF;
  IF v_orig.estado = 'anulada' THEN RAISE EXCEPTION 'Esta factura ya está anulada.'; END IF;
  IF v_orig.numero_secuencial IS NULL THEN
    RAISE EXCEPTION 'Solo se rectifican facturas ya emitidas (esta no tiene número).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.facturas WHERE id = p_nueva_factura_id) THEN
    RAISE EXCEPTION 'Ya existe una factura con el id %.', p_nueva_factura_id;
  END IF;

  -- [FIX-4] Permiso de línea, derivado del ingreso real de la original.
  v_linea := public.linea_de_ingreso(v_orig.ingreso_id);
  IF v_linea IS NOT NULL AND NOT public.has_line_perm(auth.uid(), v_linea, 'edit') THEN
    RAISE EXCEPTION 'No tienes permiso para rectificar facturas de la línea %.', v_linea;
  END IF;

  -- [FIX-8] Emisor y serie: los de la ORIGINAL, leídos del registro.
  IF v_orig.emisor_id IS NULL THEN
    RAISE EXCEPTION 'La factura original no tiene emisor registrado — no se puede rectificar con seguridad.';
  END IF;
  v_serie := COALESCE(v_orig.serie, '');

  PERFORM 1 FROM public.numeracion_contador
   WHERE emisor_id = v_orig.emisor_id AND serie = v_serie FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe contador para el emisor % (serie "%").', v_orig.emisor_id, v_serie;
  END IF;

  UPDATE public.numeracion_contador SET ultimo_numero = ultimo_numero + 1
   WHERE emisor_id = v_orig.emisor_id AND serie = v_serie
   RETURNING ultimo_numero INTO v_numero;

  INSERT INTO public.numeracion_log (numero, emisor_id, serie, factura_id, user_id)
  VALUES (v_numero, v_orig.emisor_id, v_serie, p_nueva_factura_id, auth.uid());

  PERFORM set_config('app.facturacion_privilegiada', 'on', true);

  -- La original conserva TODOS sus importes y su número. Solo se anula.
  UPDATE public.facturas SET
    estado = 'anulada', anulada_por = auth.uid(), fecha_anulacion = now(),
    motivo_anulacion = p_motivo,
    historial = COALESCE(historial, '[]'::jsonb) || jsonb_build_object(
      'fecha', now(), 'usuarioId', auth.uid(), 'accion', 'anulada', 'detalle', p_motivo)
  WHERE id = p_original_id;

  INSERT INTO public.facturas (
    id, area, tipo, numero, numero_secuencial, serie, emisor_id, cliente, concepto,
    base_imponible, porcentaje_iva, importe_iva, total, fecha, pagada, iva_deducible,
    ingreso_id, linea_negocio, estado, porcentaje_facturado, fecha_emision, emitida_por,
    emisor_snapshot, cliente_snapshot, factura_rectifica_id, notas
  ) VALUES (
    p_nueva_factura_id, v_orig.area, v_orig.tipo, v_numero::text, v_numero, v_serie, v_orig.emisor_id,
    v_orig.cliente, 'Rectificación de la factura ' || v_orig.numero || ': ' || p_motivo,
    p_base_imponible, p_porcentaje_iva, p_importe_iva, p_total,
    to_char(CURRENT_DATE, 'YYYY-MM-DD'),          -- [FIX-1] `fecha` es TEXT
    false, v_orig.iva_deducible,
    v_orig.ingreso_id, v_orig.linea_negocio, 'emitida', p_porcentaje_facturado, now(), auth.uid(),
    v_orig.emisor_snapshot, v_orig.cliente_snapshot, p_original_id, p_motivo
  );

  PERFORM set_config('app.facturacion_privilegiada', 'off', true);

  RETURN QUERY SELECT v_numero;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_factura_rectificativa(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_factura_rectificativa(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;


-- ══ 10. Sincronización con Drive: permiso y registro idempotente ══════════
-- La Edge Function `drive-sync` llama a estas funciones. Comprueban que el
-- usuario puede acceder a ESA factura (por su línea) antes de subir nada, y
-- registran el resultado de forma idempotente: dos peticiones simultáneas
-- para la misma factura no dejan dos archivos registrados.
CREATE OR REPLACE FUNCTION public.puede_sincronizar_factura(p_factura_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_f RECORD; v_linea TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_f FROM public.facturas WHERE id = p_factura_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF public.is_admin(auth.uid()) THEN RETURN true; END IF;
  v_linea := v_f.linea_negocio;
  IF v_linea IS NULL THEN
    -- Facturas de gasto sin ingreso vinculado: permiso del módulo.
    RETURN false;
  END IF;
  RETURN public.has_line_perm(auth.uid(), v_linea, 'edit');
END;
$$;
REVOKE ALL ON FUNCTION public.puede_sincronizar_factura(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.puede_sincronizar_factura(TEXT) TO authenticated;

-- Reserva el "derecho a subir" de una factura bloqueando su fila: si otra
-- petición simultánea ya subió, devuelve el fileId existente y la Edge
-- Function borra de Drive el archivo duplicado que hubiera creado.
CREATE OR REPLACE FUNCTION public.registrar_sync_drive(
  p_factura_id TEXT, p_file_id TEXT, p_folder_id TEXT, p_link TEXT, p_nombre TEXT
)
RETURNS TABLE (file_id_final TEXT, ya_existia BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_f RECORD;
BEGIN
  IF NOT public.puede_sincronizar_factura(p_factura_id) THEN
    RAISE EXCEPTION 'No tienes permiso para sincronizar esta factura.';
  END IF;
  SELECT * INTO v_f FROM public.facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura % no encontrada.', p_factura_id; END IF;

  IF v_f.drive_file_id IS NOT NULL THEN
    RETURN QUERY SELECT v_f.drive_file_id, true;   -- ya sincronizada: idempotente
    RETURN;
  END IF;

  PERFORM set_config('app.facturacion_privilegiada', 'on', true);
  UPDATE public.facturas SET
    drive_file_id = p_file_id, drive_folder_id = p_folder_id, drive_link = p_link,
    drive_nombre_archivo = p_nombre, drive_fecha_subida = now(),
    drive_subido_por = auth.uid(), sync_estado = 'sincronizada', sync_ultimo_error = NULL
  WHERE id = p_factura_id;
  PERFORM set_config('app.facturacion_privilegiada', 'off', true);

  RETURN QUERY SELECT p_file_id, false;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_sync_drive(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_sync_drive(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_error_sync_drive(p_factura_id TEXT, p_error TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.puede_sincronizar_factura(p_factura_id) THEN
    RAISE EXCEPTION 'No tienes permiso para sincronizar esta factura.';
  END IF;
  PERFORM set_config('app.facturacion_privilegiada', 'on', true);
  UPDATE public.facturas
     SET sync_estado = 'error', sync_ultimo_error = left(COALESCE(p_error, 'error desconocido'), 500)
   WHERE id = p_factura_id AND drive_file_id IS NULL;  -- nunca degrada una ya sincronizada
  PERFORM set_config('app.facturacion_privilegiada', 'off', true);
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_error_sync_drive(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_error_sync_drive(TEXT, TEXT) TO authenticated;


-- ══ 11. Índices, tope del 100% e inmutabilidad ════════════════════════════
-- [FIX-2] Unicidad POR EMISOR Y SERIE, no global.
ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS uq_factura_num_area_tipo;
DROP INDEX IF EXISTS public.idx_facturas_numero_secuencial_unico;   -- índice global defectuoso (revisión 1)
CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_numero_por_emisor_serie
  ON public.facturas (emisor_id, COALESCE(serie, ''), numero_secuencial)
  WHERE numero_secuencial IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_ingreso_id ON public.facturas (ingreso_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON public.facturas (estado);
CREATE INDEX IF NOT EXISTS idx_facturas_sync_estado ON public.facturas (sync_estado);

-- Tope del 100% facturado por ingreso, con advisory lock por ingreso para
-- que dos parciales simultáneas no pasen ambas la comprobación.
CREATE OR REPLACE FUNCTION public.validar_porcentaje_facturado()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_suma NUMERIC;
BEGIN
  IF NEW.tipo <> 'emitida' OR NEW.ingreso_id IS NULL
     OR NEW.estado IS NULL OR NEW.estado IN ('borrador','anulada') THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.ingreso_id, 0));
  SELECT COALESCE(SUM(porcentaje_facturado), 0) INTO v_suma
    FROM public.facturas
   WHERE ingreso_id = NEW.ingreso_id AND tipo = 'emitida'
     AND estado NOT IN ('borrador','anulada') AND id <> NEW.id;
  IF v_suma + COALESCE(NEW.porcentaje_facturado, 0) > 100.001 THEN
    RAISE EXCEPTION 'La suma de facturas emitidas de este ingreso superaría el 100%% (ya facturado: %, intentando añadir: %).',
      v_suma, NEW.porcentaje_facturado;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validar_porcentaje_facturado ON public.facturas;
CREATE TRIGGER trg_validar_porcentaje_facturado
  BEFORE INSERT OR UPDATE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.validar_porcentaje_facturado();

-- [FIX-6] Inmutabilidad de las facturas ya emitidas. Sin esto, cualquiera
-- con la anon key podía cambiar número/importes o borrar una factura fiscal
-- directamente vía PostgREST. Solo las funciones de esta migración (que
-- marcan `app.facturacion_privilegiada`) pueden tocarlas.
CREATE OR REPLACE FUNCTION public.proteger_factura_emitida()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE field text;
BEGIN
  IF current_user IN ('postgres','supabase_admin','service_role') THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP<>'DELETE' THEN
    FOREACH field IN ARRAY ARRAY['drive_file_id','drive_folder_id','drive_link','drive_nombre_archivo','drive_fecha_subida','drive_subido_por'] LOOP
      IF (TG_OP='INSERT' AND to_jsonb(NEW)->>field IS NOT NULL) OR
         (TG_OP='UPDATE' AND to_jsonb(NEW)->field IS DISTINCT FROM to_jsonb(OLD)->field) THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Solo el servicio Drive confirma una subida.';
      END IF;
    END LOOP;
    IF NEW.sync_estado='sincronizada' AND (TG_OP='INSERT' OR OLD.sync_estado IS DISTINCT FROM 'sincronizada') THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='La subida debe verificarse en Drive.';
    END IF;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.numero_secuencial IS NOT NULL OR NEW.emisor_snapshot IS NOT NULL OR NEW.cliente_snapshot IS NOT NULL
       OR (NEW.tipo='emitida' AND COALESCE(NEW.estado,'borrador') <> 'borrador') THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='La emisión requiere la función de facturación.';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.numero_secuencial IS NOT NULL THEN
    IF TG_OP='DELETE' THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Una factura emitida no se puede borrar.';
    END IF;
    IF (to_jsonb(NEW)-ARRAY['pagada','pagos_recibidos','fecha_pago','enviada'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['pagada','pagos_recibidos','fecha_pago','enviada']) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Una factura emitida es inmutable. Usa rectificación.';
    END IF;
  ELSIF TG_OP='UPDATE' AND (NEW.numero_secuencial IS NOT NULL OR NEW.emisor_snapshot IS NOT NULL
          OR NEW.cliente_snapshot IS NOT NULL OR (NEW.tipo='emitida' AND COALESCE(NEW.estado,'borrador')<>'borrador')) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='La emisión requiere la función de facturación.';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
DROP TRIGGER IF EXISTS trg_proteger_factura_emitida ON public.facturas;
CREATE TRIGGER trg_proteger_factura_emitida BEFORE INSERT OR UPDATE OR DELETE ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public.proteger_factura_emitida();

-- ══ 12. RLS de todas las tablas nuevas ════════════════════════════════════
-- [FIX-5] `numeracion_contador` estaba SIN RLS: legible y escribible con la
-- anon key. Ahora lectura solo admin/contabilidad y NINGUNA política de
-- escritura (solo las funciones SECURITY DEFINER la tocan).
ALTER TABLE public.numeracion_contador ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_admin_o_contabilidad" ON public.numeracion_contador;
CREATE POLICY "select_admin_o_contabilidad" ON public.numeracion_contador FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.has_module_perm(auth.uid(), 'contabilidad', 'view'));

ALTER TABLE public.numeracion_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_admin_o_contabilidad" ON public.numeracion_log;
CREATE POLICY "select_admin_o_contabilidad" ON public.numeracion_log FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.has_module_perm(auth.uid(), 'contabilidad', 'view'));

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_contabilidad" ON public.clientes;
CREATE POLICY "select_contabilidad" ON public.clientes FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.has_module_perm(auth.uid(), 'contabilidad', 'view'));
DROP POLICY IF EXISTS "write_contabilidad" ON public.clientes;
CREATE POLICY "write_contabilidad" ON public.clientes FOR ALL
  USING (public.is_admin(auth.uid()) OR public.has_module_perm(auth.uid(), 'contabilidad', 'edit'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_perm(auth.uid(), 'contabilidad', 'edit'));

ALTER TABLE public.configuracion_fiscal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_autenticado" ON public.configuracion_fiscal;
CREATE POLICY "select_autenticado" ON public.configuracion_fiscal FOR SELECT
  USING (auth.uid() IS NOT NULL);   -- necesario para generar el PDF
DROP POLICY IF EXISTS "write_admin" ON public.configuracion_fiscal;
CREATE POLICY "write_admin" ON public.configuracion_fiscal FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.proyecto_emisor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_autenticado" ON public.proyecto_emisor;
CREATE POLICY "select_autenticado" ON public.proyecto_emisor FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "write_admin" ON public.proyecto_emisor;
CREATE POLICY "write_admin" ON public.proyecto_emisor FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.user_facturacion_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_propio_o_admin" ON public.user_facturacion_permissions;
CREATE POLICY "select_propio_o_admin" ON public.user_facturacion_permissions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
-- Escritura solo admin: nadie puede concederse permisos a sí mismo.
DROP POLICY IF EXISTS "write_admin" ON public.user_facturacion_permissions;
CREATE POLICY "write_admin" ON public.user_facturacion_permissions FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


-- ══ 13. Emisor 'default' migrado del modelo antiguo ═══════════════════════
-- Si no existe ningún emisor se crea 'default' VACÍO — sin datos fiscales
-- inventados. Queda sin numeración confirmada: nadie puede emitir hasta que
-- un administrador rellene los datos y confirme el número inicial.
INSERT INTO public.configuracion_fiscal (id, nombre_interno, activo, numeracion_confirmada)
VALUES ('default', 'Emisor principal (pendiente de completar)', true, false)
ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON public.numeracion_contador, public.numeracion_log FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.numeracion_contador, public.numeracion_log TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.clientes,public.configuracion_fiscal,public.proyecto_emisor,public.user_facturacion_permissions TO authenticated;
REVOKE ALL ON FUNCTION public.linea_de_ingreso(TEXT),public.emisor_de_linea(TEXT) FROM authenticated;


-- ============================================================================
-- Reversión: consultar ACTIVACION.md. No quitar triggers de inmutabilidad ni
-- índices de numeración: preservan las facturas ya emitidas. Antes de COMMIT,
-- cualquier fallo revierte la activación; después, detener emisión y corregir
-- con migración hacia adelante o restaurar una copia validada en entorno aislado.

-- SOURCE supabase/hardening.sql
-- Applied inside activation transaction, after G and H. No business rows deleted.
CREATE OR REPLACE FUNCTION public.canonical_line(v text, a text DEFAULT NULL) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE v WHEN 'La Montada Sound' THEN 'montada_sound' WHEN 'DJs' THEN 'dj'
 WHEN 'Real Madrid' THEN 'real_madrid' WHEN 'La Montada Installations' THEN 'montada_installations'
 WHEN 'montada_sound' THEN v WHEN 'dj' THEN v WHEN 'real_madrid' THEN v WHEN 'montada_installations' THEN v
 ELSE CASE a WHEN 'montada' THEN 'montada_sound' WHEN 'dj' THEN 'dj' WHEN 'real_madrid' THEN 'real_madrid' END END
$$;
CREATE OR REPLACE FUNCTION public.normalize_business_line() RETURNS trigger LANGUAGE plpgsql
SET search_path=public,pg_temp AS $$
DECLARE payload jsonb := to_jsonb(NEW); parent_line text;
BEGIN
 IF NEW.linea_negocio IS NOT NULL AND public.canonical_line(NEW.linea_negocio) IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Línea de negocio desconocida.';
 END IF;
 NEW.linea_negocio := public.canonical_line(NEW.linea_negocio,payload->>'area');
 IF payload->>'ingreso_id' IS NOT NULL THEN
   SELECT linea_negocio INTO parent_line FROM public.ingresos WHERE id=payload->>'ingreso_id';
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Ingreso no encontrado o no autorizado.'; END IF;
   NEW.linea_negocio := parent_line;
 ELSIF payload->>'gasto_id' IS NOT NULL THEN
   SELECT linea_negocio INTO parent_line FROM public.gastos WHERE id=payload->>'gasto_id';
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Gasto no encontrado o no autorizado.'; END IF;
   NEW.linea_negocio := parent_line;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; p record; BEGIN
 FOR t IN SELECT unnest(ARRAY['ingresos','gastos','facturas','equipo','impuestos','documentos','gastos_evento','pagos_evento','suplidos']) LOOP
   EXECUTE format('UPDATE public.%I SET linea_negocio=public.canonical_line(linea_negocio) WHERE linea_negocio IN (''La Montada Sound'',''DJs'',''Real Madrid'',''La Montada Installations'')',t);
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon',t);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
   EXECUTE format('DROP TRIGGER IF EXISTS aa_normalize_line ON public.%I',t);
   EXECUTE format('CREATE TRIGGER aa_normalize_line BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.normalize_business_line()',t);
   FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
     EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
   END LOOP;
   EXECUTE format('CREATE POLICY line_select ON public.%I FOR SELECT TO authenticated USING(public.has_line_perm(auth.uid(),linea_negocio,''view''))',t);
   EXECUTE format('CREATE POLICY line_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(public.has_line_perm(auth.uid(),linea_negocio,''create''))',t);
   EXECUTE format('CREATE POLICY line_update ON public.%I FOR UPDATE TO authenticated USING(public.has_line_perm(auth.uid(),linea_negocio,''edit'')) WITH CHECK(public.has_line_perm(auth.uid(),linea_negocio,''edit''))',t);
   EXECUTE format('CREATE POLICY line_delete ON public.%I FOR DELETE TO authenticated USING(public.has_line_perm(auth.uid(),linea_negocio,''delete''))',t);
 END LOOP;
 -- Explicit module gate for taxes. Permissive line policies still bound rows.
 CREATE POLICY taxes_read ON public.impuestos AS RESTRICTIVE FOR SELECT TO authenticated USING(public.has_module_perm(auth.uid(),'impuestos','view'));
 CREATE POLICY taxes_create ON public.impuestos AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.has_module_perm(auth.uid(),'impuestos','create'));
 CREATE POLICY taxes_edit ON public.impuestos AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.has_module_perm(auth.uid(),'impuestos','edit')) WITH CHECK(public.has_module_perm(auth.uid(),'impuestos','edit'));
 CREATE POLICY taxes_delete ON public.impuestos AS RESTRICTIVE FOR DELETE TO authenticated USING(public.has_module_perm(auth.uid(),'impuestos','delete'));
 FOR t IN SELECT unnest(ARRAY['eventos','socios','movimientos_socios']) LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon',t);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
   FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
     EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
   END LOOP;
   EXECUTE format('CREATE POLICY line_select ON public.%I FOR SELECT TO authenticated USING(public.has_line_perm(auth.uid(),''montada_sound'',''view''))',t);
   EXECUTE format('CREATE POLICY line_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(public.has_line_perm(auth.uid(),''montada_sound'',''create''))',t);
   EXECUTE format('CREATE POLICY line_update ON public.%I FOR UPDATE TO authenticated USING(public.has_line_perm(auth.uid(),''montada_sound'',''edit'')) WITH CHECK(public.has_line_perm(auth.uid(),''montada_sound'',''edit''))',t);
   EXECUTE format('CREATE POLICY line_delete ON public.%I FOR DELETE TO authenticated USING(public.has_line_perm(auth.uid(),''montada_sound'',''delete''))',t);
 END LOOP;
 -- Legacy tables preserved and closed to client roles, including old password hashes.
 FOR t IN SELECT unnest(ARRAY['usuarios','gastos_recurrentes','historial_pagos']) LOOP
   IF to_regclass('public.'||t) IS NOT NULL THEN
     EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
     EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
     FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
       EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
     END LOOP;
   END IF;
 END LOOP;
END $$;
-- Repair child line classifications from existing relationships, without touching amounts.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['gastos_evento','pagos_evento','suplidos','facturas']) LOOP
  EXECUTE format('UPDATE public.%I d SET linea_negocio=i.linea_negocio FROM public.ingresos i WHERE d.ingreso_id=i.id AND d.linea_negocio IS DISTINCT FROM i.linea_negocio',t);
 END LOOP;
 UPDATE public.facturas f SET linea_negocio=g.linea_negocio FROM public.gastos g WHERE f.gasto_id=g.id AND f.linea_negocio IS DISTINCT FROM g.linea_negocio;
 UPDATE public.documentos d SET linea_negocio=i.linea_negocio FROM public.ingresos i WHERE d.entity_type='ingreso' AND d.entity_id=i.id AND d.linea_negocio IS DISTINCT FROM i.linea_negocio;
 UPDATE public.documentos d SET linea_negocio=g.linea_negocio FROM public.gastos g WHERE d.entity_type='gasto' AND d.entity_id=g.id AND d.linea_negocio IS DISTINCT FROM g.linea_negocio;
 UPDATE public.documentos d SET linea_negocio=f.linea_negocio FROM public.facturas f WHERE d.entity_type='factura' AND d.entity_id=f.id AND d.linea_negocio IS DISTINCT FROM f.linea_negocio;
 UPDATE public.documentos d SET linea_negocio=e.linea_negocio FROM public.equipo e WHERE d.entity_type='equipo' AND d.entity_id=e.id AND d.linea_negocio IS DISTINCT FROM e.linea_negocio;
END $$;
-- Data access to dependants is derived from their parent on both reads and writes.
DO $$ DECLARE t text; a text; cmd text; pred text; BEGIN
 FOR t IN SELECT unnest(ARRAY['gastos_evento','pagos_evento','suplidos','facturas']) LOOP
  FOREACH a IN ARRAY ARRAY['view','create','edit','delete'] LOOP
   cmd := CASE a WHEN 'view' THEN 'SELECT' WHEN 'create' THEN 'INSERT' WHEN 'edit' THEN 'UPDATE' ELSE 'DELETE' END;
   pred := format('(ingreso_id IS NULL OR EXISTS(SELECT 1 FROM public.ingresos i WHERE i.id=%I.ingreso_id AND public.has_line_perm(auth.uid(),i.linea_negocio,%L)))',t,a);
   IF a = 'view' THEN pred := '(public.is_admin(auth.uid()) OR ' || pred || ')'; END IF;
   EXECUTE format('CREATE POLICY parent_%s ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s',a,t,cmd,
    CASE cmd WHEN 'INSERT' THEN 'WITH CHECK('||pred||')' WHEN 'UPDATE' THEN 'USING('||pred||') WITH CHECK('||pred||')' ELSE 'USING('||pred||')' END);
  END LOOP;
 END LOOP;
END $$;
-- Profile and permission writes are admin-only; an admin cannot modify their own capabilities.
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profiles,public.user_line_permissions,public.user_module_permissions TO authenticated;
REVOKE ALL ON public.profiles,public.user_line_permissions,public.user_module_permissions,public.user_facturacion_permissions,public.clientes,public.configuracion_fiscal,public.proyecto_emisor FROM PUBLIC,anon;
CREATE OR REPLACE FUNCTION public.protect_last_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(872931004);
 IF TG_OP='DELETE' OR NEW.rol IS DISTINCT FROM OLD.rol OR NEW.activo IS DISTINCT FROM OLD.activo THEN
  IF OLD.id=auth.uid() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='No puedes quitarte tu propio acceso.'; END IF;
  IF OLD.rol='admin' AND OLD.activo AND (TG_OP='DELETE' OR NEW.rol<>'admin' OR NOT NEW.activo)
    AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id<>OLD.id AND rol='admin' AND activo) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Debe quedar al menos un administrador activo.';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_protect_last_admin ON public.profiles;
CREATE TRIGGER trg_protect_last_admin BEFORE UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin();
DROP POLICY IF EXISTS write_admin ON public.user_facturacion_permissions;
CREATE POLICY write_admin ON public.user_facturacion_permissions FOR ALL TO authenticated
 USING(public.is_admin(auth.uid()) AND user_id<>auth.uid()) WITH CHECK(public.is_admin(auth.uid()) AND user_id<>auth.uid());
DROP POLICY IF EXISTS write_contabilidad ON public.clientes;
DROP POLICY IF EXISTS client_insert ON public.clientes;
CREATE POLICY client_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK(public.has_module_perm(auth.uid(),'contabilidad','create'));
DROP POLICY IF EXISTS client_update ON public.clientes;
CREATE POLICY client_update ON public.clientes FOR UPDATE TO authenticated USING(public.has_module_perm(auth.uid(),'contabilidad','edit')) WITH CHECK(public.has_module_perm(auth.uid(),'contabilidad','edit'));
DROP POLICY IF EXISTS client_delete ON public.clientes;
CREATE POLICY client_delete ON public.clientes FOR DELETE TO authenticated USING(public.has_module_perm(auth.uid(),'contabilidad','delete'));
DROP POLICY IF EXISTS select_autenticado ON public.configuracion_fiscal;
DROP POLICY IF EXISTS issuer_select ON public.configuracion_fiscal;
CREATE POLICY issuer_select ON public.configuracion_fiscal FOR SELECT TO authenticated
 USING(public.is_admin(auth.uid()) OR EXISTS(SELECT 1 FROM public.proyecto_emisor pe WHERE pe.emisor_id=id AND public.has_line_perm(auth.uid(),pe.linea_id,'view')));
DROP POLICY IF EXISTS select_autenticado ON public.proyecto_emisor;
DROP POLICY IF EXISTS assignment_select ON public.proyecto_emisor;
CREATE POLICY assignment_select ON public.proyecto_emisor FOR SELECT TO authenticated USING(public.has_line_perm(auth.uid(),linea_id,'view'));
-- Synchronization receipts may only be written by the verified server integration.
REVOKE EXECUTE ON FUNCTION public.registrar_sync_drive(TEXT,TEXT,TEXT,TEXT,TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_sync_drive(TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.puede_sincronizar_factura(TEXT) TO service_role;
-- Existing documents remain private. Their object key must match an authorized document.
DO $$ DECLARE p record; BEGIN
 IF to_regclass('storage.objects') IS NOT NULL THEN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND (policyname IN ('acceso_total','acceso_total_docs') OR COALESCE(qual,'') LIKE '%documentos%') LOOP
   EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname);
  END LOOP;
  CREATE POLICY finance_document_read ON storage.objects FOR SELECT TO authenticated
   USING(bucket_id='documentos' AND EXISTS(SELECT 1 FROM public.documentos d WHERE d.storage_key=name));
 END IF;
END $$;
-- Validate every capability before any change, then persist the whole matrix atomically.
CREATE OR REPLACE FUNCTION public.admin_save_user(p_user_id uuid,p_nombre text,p_rol text,p_activo boolean,p_lineas jsonb,p_modulos jsonb,p_facturacion jsonb,p_email text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k text; v jsonb; action text;
BEGIN
 IF NOT public.is_admin(auth.uid()) OR p_user_id=auth.uid() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Acción administrativa no autorizada.'; END IF;
 IF p_rol NOT IN ('admin','usuario') OR p_activo IS NULL OR NULLIF(trim(p_nombre),'') IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Perfil inválido.'; END IF;
 IF jsonb_typeof(p_lineas)<>'object' OR jsonb_typeof(p_modulos)<>'object' OR jsonb_typeof(p_facturacion)<>'object'
   OR p_lineas IS NULL OR p_modulos IS NULL OR p_facturacion IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Matriz de permisos inválida.'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(p_lineas||p_modulos) LOOP
  IF k NOT IN ('montada_sound','dj','real_madrid','montada_installations','contabilidad','impuestos','informes','administracion') OR jsonb_typeof(v)<>'object'
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Permiso desconocido.'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(v) field WHERE field NOT IN ('ver','crear','editar','eliminar')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Capacidad desconocida.'; END IF;
  FOREACH action IN ARRAY ARRAY['ver','crear','editar','eliminar'] LOOP
   IF jsonb_typeof(v->action) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Las capacidades deben ser booleanas.'; END IF;
  END LOOP;
  IF NOT (v->>'ver')::boolean AND ((v->>'crear')::boolean OR (v->>'editar')::boolean OR (v->>'eliminar')::boolean) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Concede lectura antes de escritura.'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_lineas) AS keys(name) WHERE keys.name NOT IN ('montada_sound','dj','real_madrid','montada_installations')) OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_modulos) AS keys(name) WHERE keys.name NOT IN ('contabilidad','impuestos','informes','administracion')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Matriz incorrecta.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_facturacion) AS keys(name) WHERE keys.name NOT IN ('emitir','rectificar','gestionarNumeracion')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Permiso de facturación desconocido.'; END IF;
 FOREACH action IN ARRAY ARRAY['emitir','rectificar','gestionarNumeracion'] LOOP
  IF jsonb_typeof(p_facturacion->action) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Permiso de facturación inválido.'; END IF;
 END LOOP;
 -- Auth user must already exist; this never creates Auth identities.
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Cuenta Auth inexistente.'; END IF;
 INSERT INTO public.profiles(id,email,nombre,rol,activo)
 SELECT p_user_id,u.email,trim(p_nombre),p_rol,p_activo FROM auth.users u WHERE u.id=p_user_id
 ON CONFLICT(id) DO UPDATE SET nombre=EXCLUDED.nombre,rol=EXCLUDED.rol,activo=EXCLUDED.activo;
 DELETE FROM public.user_line_permissions WHERE user_id=p_user_id;
 DELETE FROM public.user_module_permissions WHERE user_id=p_user_id;
 INSERT INTO public.user_line_permissions(user_id,linea_negocio,can_view,can_create,can_edit,can_delete)
 SELECT p_user_id,key,(value->>'ver')::boolean,(value->>'crear')::boolean,(value->>'editar')::boolean,(value->>'eliminar')::boolean FROM jsonb_each(p_lineas);
 INSERT INTO public.user_module_permissions(user_id,modulo,can_view,can_create,can_edit,can_delete)
 SELECT p_user_id,key,(value->>'ver')::boolean,(value->>'crear')::boolean,(value->>'editar')::boolean,(value->>'eliminar')::boolean FROM jsonb_each(p_modulos);
 INSERT INTO public.user_facturacion_permissions(user_id,puede_emitir,puede_rectificar,puede_gestionar_numeracion)
 VALUES(p_user_id,(p_facturacion->>'emitir')::boolean,(p_facturacion->>'rectificar')::boolean,(p_facturacion->>'gestionarNumeracion')::boolean)
 ON CONFLICT(user_id) DO UPDATE SET puede_emitir=EXCLUDED.puede_emitir,puede_rectificar=EXCLUDED.puede_rectificar,puede_gestionar_numeracion=EXCLUDED.puede_gestionar_numeracion;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_user(uuid,text,text,boolean,jsonb,jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_user(uuid,text,text,boolean,jsonb,jsonb,jsonb,text) TO authenticated;
CREATE TABLE IF NOT EXISTS public.drive_uploads(
 factura_id text PRIMARY KEY REFERENCES public.facturas(id), file_id text NOT NULL UNIQUE,
 folder_id text NOT NULL, contenido_hash text NOT NULL, nombre text NOT NULL,
 completed boolean NOT NULL DEFAULT false, created_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS drive_unique_content ON public.drive_uploads(folder_id,contenido_hash);
ALTER TABLE public.drive_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drive_uploads FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.drive_uploads TO service_role;
CREATE OR REPLACE FUNCTION public.reserve_drive_upload(p_factura_id text,p_actor uuid,p_file_id text,p_folder text,p_hash text,p_nombre text)
RETURNS SETOF public.drive_uploads LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public.facturas;
BEGIN
 SELECT * INTO f FROM public.facturas WHERE id=p_factura_id FOR UPDATE;
 IF NOT FOUND OR NOT public.has_line_perm(p_actor,f.linea_negocio,'edit') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Factura no autorizada.'; END IF;
 IF f.tipo='emitida' AND f.numero_secuencial IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Emite la factura antes de sincronizarla.'; END IF;
 INSERT INTO public.drive_uploads(factura_id,file_id,folder_id,contenido_hash,nombre,created_by)
 VALUES(p_factura_id,p_file_id,p_folder,p_hash,p_nombre,p_actor) ON CONFLICT(factura_id) DO NOTHING;
 IF EXISTS(SELECT 1 FROM public.drive_uploads WHERE factura_id=p_factura_id AND contenido_hash<>p_hash) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ya existe un intento con otro archivo. Conserva el documento original.';
 END IF;
 RETURN QUERY SELECT * FROM public.drive_uploads WHERE factura_id=p_factura_id;
END $$;
CREATE OR REPLACE FUNCTION public.complete_drive_upload(p_factura_id text,p_actor uuid,p_file_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u public.drive_uploads;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.facturas f WHERE id=p_factura_id AND public.has_line_perm(p_actor,f.linea_negocio,'edit')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Factura no autorizada.'; END IF;
 SELECT * INTO u FROM public.drive_uploads WHERE factura_id=p_factura_id AND file_id=p_file_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subida no reservada.'; END IF;
 UPDATE public.drive_uploads SET completed=true WHERE factura_id=p_factura_id;
 UPDATE public.facturas SET drive_file_id=u.file_id,drive_folder_id=u.folder_id,drive_nombre_archivo=u.nombre,
 drive_link='https://drive.google.com/file/d/'||u.file_id||'/view',drive_fecha_subida=now(),drive_subido_por=p_actor,sync_estado='sincronizada',sync_ultimo_error=NULL WHERE id=p_factura_id;
END $$;
REVOKE ALL ON FUNCTION public.reserve_drive_upload(text,uuid,text,text,text,text),public.complete_drive_upload(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_drive_upload(text,uuid,text,text,text,text),public.complete_drive_upload(text,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.document_entity_permission(p_type text,p_id text,p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l text;
BEGIN
 CASE p_type
 WHEN 'ingreso' THEN SELECT linea_negocio INTO l FROM public.ingresos WHERE id=p_id;
 WHEN 'gasto' THEN SELECT linea_negocio INTO l FROM public.gastos WHERE id=p_id;
 WHEN 'factura' THEN SELECT linea_negocio INTO l FROM public.facturas WHERE id=p_id;
 WHEN 'equipo' THEN SELECT linea_negocio INTO l FROM public.equipo WHERE id=p_id;
 WHEN 'evento' THEN SELECT 'montada_sound' INTO l FROM public.eventos WHERE id=p_id;
 ELSE RETURN false;
 END CASE;
 RETURN l IS NOT NULL AND public.has_line_perm(auth.uid(),l,p_action);
END $$;
REVOKE ALL ON FUNCTION public.document_entity_permission(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.document_entity_permission(text,text,text) TO authenticated;
DO $$ DECLARE p record; a text; command text; pred text; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='documentos' LOOP EXECUTE format('DROP POLICY %I ON public.documentos',p.policyname); END LOOP;
 FOREACH a IN ARRAY ARRAY['view','create','edit','delete'] LOOP
  command:=CASE a WHEN 'view' THEN 'SELECT' WHEN 'create' THEN 'INSERT' WHEN 'edit' THEN 'UPDATE' ELSE 'DELETE' END;
  pred:=format('public.document_entity_permission(entity_type,entity_id,%L)',a);
  EXECUTE format('CREATE POLICY doc_%s ON public.documentos FOR %s TO authenticated %s',a,command,CASE command WHEN 'INSERT' THEN 'WITH CHECK('||pred||')' WHEN 'UPDATE' THEN 'USING('||pred||') WITH CHECK('||pred||')' ELSE 'USING('||pred||')' END);
 END LOOP;
 IF to_regclass('storage.objects') IS NOT NULL THEN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND (policyname LIKE 'finance_%' OR COALESCE(qual,'') LIKE '%investment-invoices%' OR COALESCE(with_check,'') LIKE '%investment-invoices%') LOOP EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname); END LOOP;
  CREATE POLICY finance_storage_read ON storage.objects FOR SELECT TO authenticated
   USING(bucket_id IN ('documentos','investment-invoices') AND public.document_entity_permission(split_part(name,'/',1),split_part(name,'/',2),'view'));
  CREATE POLICY finance_storage_upload ON storage.objects FOR INSERT TO authenticated
   WITH CHECK(bucket_id='investment-invoices' AND public.document_entity_permission(split_part(name,'/',1),split_part(name,'/',2),'create'));
  CREATE POLICY finance_storage_delete ON storage.objects FOR DELETE TO authenticated
   USING(bucket_id='investment-invoices' AND public.document_entity_permission(split_part(name,'/',1),split_part(name,'/',2),'delete'));
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS expense_invoice_number ON public.facturas(gasto_id,numero_proveedor) WHERE gasto_id IS NOT NULL AND numero_proveedor IS NOT NULL;
CREATE OR REPLACE FUNCTION public.save_received_invoice(p_factura jsonb,p_documento jsonb DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE f public.facturas; d public.documentos;
BEGIN
 f:=jsonb_populate_record(NULL::public.facturas,p_factura);
 IF f.tipo IS DISTINCT FROM 'recibida' OR f.gasto_id IS NULL OR f.numero_secuencial IS NOT NULL OR NULLIF(trim(f.numero),'') IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.gastos WHERE id=f.gasto_id) OR f.total IS NULL OR f.base_imponible IS NULL OR f.importe_iva IS NULL
 OR f.total<0 OR f.total<>round(f.base_imponible+f.importe_iva,2) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Factura de proveedor inválida.'; END IF;
 IF p_documento IS NOT NULL THEN
  d:=jsonb_populate_record(NULL::public.documentos,p_documento);
  IF d.entity_type<>'gasto' OR d.entity_id<>f.gasto_id OR d.id IS DISTINCT FROM f.documento_id THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Adjunto inválido.'; END IF;
  INSERT INTO public.documentos SELECT d.* ON CONFLICT(id) DO NOTHING;
 END IF;
 INSERT INTO public.facturas SELECT f.* ON CONFLICT(id) DO NOTHING;
 RETURN f.id;
END $$;
REVOKE ALL ON FUNCTION public.save_received_invoice(jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_received_invoice(jsonb,jsonb) TO authenticated;

DROP POLICY IF EXISTS select_contabilidad ON public.clientes;
CREATE POLICY select_contabilidad ON public.clientes FOR SELECT TO authenticated USING(
 public.has_module_perm(auth.uid(),'contabilidad','view') OR
 (public.has_facturacion_perm(auth.uid(),'emitir') AND EXISTS(SELECT 1 FROM public.ingresos i WHERE lower(trim(i.cliente))=lower(trim(nombre))))
);
CREATE OR REPLACE FUNCTION public.protect_invoiced_income() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.facturas WHERE ingreso_id=OLD.id AND numero_secuencial IS NOT NULL) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='No se puede borrar un ingreso con facturas emitidas.'; END IF;
  IF NEW.linea_negocio IS DISTINCT FROM OLD.linea_negocio OR NEW.area IS DISTINCT FROM OLD.area OR NEW.base_imponible IS DISTINCT FROM OLD.base_imponible OR NEW.porcentaje_iva IS DISTINCT FROM OLD.porcentaje_iva OR NEW.total IS DISTINCT FROM OLD.total OR NEW.cliente IS DISTINCT FROM OLD.cliente THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Un ingreso facturado conserva su cliente, importes y línea. Rectifica sus facturas antes de ajustar la operación.';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS protect_invoiced_income ON public.ingresos;
CREATE TRIGGER protect_invoiced_income BEFORE UPDATE OR DELETE ON public.ingresos FOR EACH ROW EXECUTE FUNCTION public.protect_invoiced_income();

-- Counters/logs cannot reveal other issuers or invoice IDs via a generic module grant.
DROP POLICY IF EXISTS select_admin_o_contabilidad ON public.numeracion_contador;
CREATE POLICY select_admin_o_contabilidad ON public.numeracion_contador FOR SELECT TO authenticated USING(public.is_admin(auth.uid()));
DROP POLICY IF EXISTS select_admin_o_contabilidad ON public.numeracion_log;
CREATE POLICY select_admin_o_contabilidad ON public.numeracion_log FOR SELECT TO authenticated USING(public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_facturas_ingreso ON public.facturas(ingreso_id);
CREATE INDEX IF NOT EXISTS idx_facturas_gasto ON public.facturas(gasto_id);
CREATE INDEX IF NOT EXISTS idx_documentos_entity ON public.documentos(entity_type,entity_id);

-- All original IDs and original fields are preserved, except approved classifications.
CREATE TEMP TABLE finance_validation(table_name text,before_count bigint,after_count bigint) ON COMMIT DROP;
DO $$ DECLARE t text; bad bigint; before_n bigint; after_n bigint; BEGIN
 FOREACH t IN ARRAY ARRAY['ingresos','gastos','facturas','equipo','impuestos','documentos','gastos_evento','pagos_evento','suplidos','eventos','socios','movimientos_socios','usuarios'] LOOP
  EXECUTE format('SELECT count(*) FROM finance_baseline b LEFT JOIN public.%I x ON x.id::text=b.id WHERE b.table_name=%L AND (x.id IS NULL OR NOT b.payload <@ to_jsonb(x))',t,t) INTO bad;
  IF bad<>0 THEN RAISE EXCEPTION 'Integridad fallida en %: % registros. Activación abortada.',t,bad; END IF;
  SELECT count(*) INTO before_n FROM finance_baseline WHERE table_name=t;
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO after_n;
  IF before_n<>after_n THEN RAISE EXCEPTION 'Conteo cambiado en %. Activación abortada.',t; END IF;
  INSERT INTO finance_validation VALUES(t,before_n,after_n);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=ANY(ARRAY['ingresos','gastos','facturas','equipo','impuestos','documentos','gastos_evento','pagos_evento','suplidos','eventos','socios','movimientos_socios','usuarios']) AND (qual='true' OR with_check='true')) THEN RAISE EXCEPTION 'Política abierta residual.'; END IF;
 IF NOT public.is_admin('f700fe77-98f4-4cda-8c75-2524e782afcd') THEN RAISE EXCEPTION 'Administradora no activa.'; END IF;
END $$;
SELECT * FROM finance_validation ORDER BY table_name;
COMMIT;
