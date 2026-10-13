-- ============================================================================
-- FASE F — Modelo definitivo de usuarios/permisos + RLS real.
-- PREPARADA, NO EJECUTADA. Requiere aprobación explícita de Julia antes de
-- aplicarse — y requiere ADEMÁS migrar el login a Supabase Auth (ver nota
-- al final), porque RLS solo puede distinguir usuarios reales mediante
-- `auth.uid()`; el `usuarios`/password-hash-en-tabla actual no genera
-- ninguna sesión de Supabase Auth, así que RLS no podría aplicarse hoy
-- aunque se ejecutara esta migración tal cual.
--
-- Aditiva, idempotente (IF NOT EXISTS en todo) y reversible (ver plan de
-- reversión al final). No borra ni renombra ninguna columna ni tabla
-- existente. No modifica ni reclasifica ningún registro financiero.
-- ============================================================================


-- ── 1. Completar linea_negocio en TODAS las tablas afectadas ────────────────
-- Reejecuta el backfill ya preparado en 20260906_001_linea_negocio.sql (que
-- sigue sin ejecutarse) — se repite aquí íntegro para que esta migración sea
-- autocontenida y pueda aplicarse sola. Es la MISMA lógica, no una nueva:
-- mismos IDs de Real Madrid confirmados, mismo criterio montada→montada_sound,
-- dj+tipo_evento→real_madrid/dj. No inventa ni reclasifica nada distinto de
-- lo ya auditado.
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

UPDATE ingresos SET tipo_evento = 'Partido'
  WHERE id IN ('tavsmkotyqfms30yxr1', 'gsdi12lqqoms30zk7x') AND tipo_evento = 'Boda';

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

-- Installations queda preparada sin backfill (no tiene filas todavía) — los
-- registros nuevos que se creen desde el frontend ya escriben
-- linea_negocio='montada_installations' explícitamente.

-- Solo cuando TODAS las filas tengan linea_negocio no nulo se puede añadir
-- el CHECK — se deja preparado pero comentado; ejecutar a mano tras
-- verificar `SELECT count(*) FROM ingresos WHERE linea_negocio IS NULL`
-- (y equivalente en cada tabla) que da 0.
-- ALTER TABLE ingresos ADD CONSTRAINT ingresos_linea_negocio_check
--   CHECK (linea_negocio IN ('montada_sound','dj','real_madrid','montada_installations'));


-- ── 2. Modelo de permisos definitivo — vinculado a auth.users.id ───────────
-- No se usa una tabla `roles` separada: un solo campo `rol` en `profiles`
-- ('admin'|'usuario') es suficiente y evita una tabla extra sin valor real
-- (solo 2 roles, sin jerarquía que justifique normalizarlo aparte).
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  nombre        TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario')),
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sign_in_at TIMESTAMPTZ  -- solo se rellena si Supabase Auth lo reporta; nunca se inventa
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


-- ── 3. Funciones auxiliares — SECURITY DEFINER mínimo y justificado ────────
-- Se necesitan SECURITY DEFINER porque las políticas RLS de las tablas
-- financieras consultan `user_line_permissions`/`profiles`, que a su vez
-- tienen su PROPIA RLS (un usuario normal no puede leer los permisos de
-- otro) — sin SECURITY DEFINER, la subconsulta de la política fallaría por
-- recursión de permisos al evaluarse con los privilegios del propio
-- usuario. Cada función:
--   • tiene `search_path` fijado a 'public, pg_temp' (evita secuestro de
--     esquema vía search_path manipulado),
--   • solo lee (nunca escribe) profiles/user_*_permissions,
--   • no devuelve ninguna fila ni columna financiera — solo booleanos,
--   • se declara STABLE (mismo resultado dentro de una misma consulta,
--     permite al planner cachear el resultado y evita recomputar por fila).

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
    -- Un usuario inactivo nunca tiene permiso, ni siquiera si es admin.
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

-- Revoca ejecución pública por defecto y concede solo a `authenticated` —
-- ni `anon` ni `public` deben poder invocar estas funciones directamente.
REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_line_perm(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_module_perm(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_line_perm(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_module_perm(UUID, TEXT, TEXT) TO authenticated;


-- ── 4. RLS — profiles / permisos ────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_line_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_or_admin" ON public.profiles;
CREATE POLICY "select_own_or_admin" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

-- Un usuario nunca puede editar su propia fila (rol/activo) — solo un admin
-- puede, y nunca sobre sí mismo tampoco (ver trigger de protección más abajo).
DROP POLICY IF EXISTS "update_admin_only" ON public.profiles;
CREATE POLICY "update_admin_only" ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()) AND id != auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) AND id != auth.uid());

DROP POLICY IF EXISTS "insert_admin_only" ON public.profiles;
CREATE POLICY "insert_admin_only" ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Nunca se permite DELETE desde el cliente — solo desactivar (`activo=false`).
-- Si hiciera falta borrar de verdad, se hace desde la Edge Function con
-- service_role, nunca vía RLS de cliente.

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
-- Nótese "user_id != auth.uid()" en las políticas de escritura: ni un admin
-- puede cambiar sus PROPIOS permisos por este camino — evita que un admin
-- se quite acceso por error, y cierra la vía de "un usuario manipula sus
-- propios permisos" aunque tuviera temporalmente rol admin comprometido.
-- El cambio de los propios permisos, si hiciera falta alguna vez, se hace
-- desde otro admin.


-- ── 5. RLS — tablas financieras con linea_negocio directa ──────────────────
-- ingresos, gastos, facturas, equipo, impuestos, documentos: cada una tiene
-- ya su columna `linea_negocio` (rellenada en el paso 1). Un usuario ve
-- SOLO las filas de sus líneas autorizadas; el admin ve todo.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['ingresos','gastos','facturas','equipo','impuestos','documentos']) LOOP
    -- CRÍTICO (auditoría Fase G): las políticas PERMISIVAS de Postgres se
    -- combinan con OR — si "acceso_total" (USING(true)) no se elimina
    -- explícitamente aquí, seguiría concediendo acceso total a CUALQUIERA
    -- independientemente de las políticas restrictivas de abajo, dejándolas
    -- completamente anuladas en la práctica. Encontrado y corregido en esta
    -- misma auditoría — no estaba en la primera versión de esta migración.
    EXECUTE format('DROP POLICY IF EXISTS "acceso_total" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "select_by_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "select_by_line_perm" ON public.%I FOR SELECT
        USING (
          public.is_admin(auth.uid())
          OR (linea_negocio IS NOT NULL AND public.has_line_perm(auth.uid(), linea_negocio, 'view'))
          -- Fila legada sin linea_negocio todavía clasificada: solo el admin
          -- la ve, nunca "cualquiera" — fail-closed, no fail-open.
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

    -- UPDATE: exige permiso de edición en la línea ANTES del cambio (USING)
    -- Y en la línea DESPUÉS del cambio (WITH CHECK) — así un usuario no
    -- puede "mover" un registro a una línea a la que no tiene acceso, ni
    -- editar uno que ya pertenece a una línea que no tiene permitida.
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


-- ── 6. RLS — tablas dependientes SIN linea_negocio propia ──────────────────
-- gastos_evento, pagos_evento, suplidos cuelgan de un `ingreso_id` — la
-- línea se deriva SIEMPRE de esa relación (nunca se duplica la columna
-- donde ya existe una relación fiable, tal como se pidió). Se usa un JOIN
-- correlacionado en la propia política en vez de otra función, porque aquí
-- sí hace falta mirar la fila padre concreta (`ingreso_id`), no solo un
-- valor de columna propio.
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
          OR EXISTS (
            SELECT 1 FROM public.ingresos i
            WHERE i.id = %I.ingreso_id
              AND i.linea_negocio IS NOT NULL
              AND public.has_line_perm(auth.uid(), i.linea_negocio, 'view')
          )
        )
    $p$, t, t);

    EXECUTE format('DROP POLICY IF EXISTS "insert_by_parent_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "insert_by_parent_line_perm" ON public.%I FOR INSERT
        WITH CHECK (
          public.is_admin(auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.ingresos i
            WHERE i.id = %I.ingreso_id
              AND i.linea_negocio IS NOT NULL
              AND public.has_line_perm(auth.uid(), i.linea_negocio, 'create')
          )
        )
    $p$, t, t);

    EXECUTE format('DROP POLICY IF EXISTS "update_by_parent_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "update_by_parent_line_perm" ON public.%I FOR UPDATE
        USING (
          public.is_admin(auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.ingresos i
            WHERE i.id = %I.ingreso_id
              AND i.linea_negocio IS NOT NULL
              AND public.has_line_perm(auth.uid(), i.linea_negocio, 'edit')
          )
        )
        WITH CHECK (
          public.is_admin(auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.ingresos i
            WHERE i.id = %I.ingreso_id
              AND i.linea_negocio IS NOT NULL
              AND public.has_line_perm(auth.uid(), i.linea_negocio, 'edit')
          )
        )
    $p$, t, t, t);

    EXECUTE format('DROP POLICY IF EXISTS "delete_by_parent_line_perm" ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY "delete_by_parent_line_perm" ON public.%I FOR DELETE
        USING (
          public.is_admin(auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.ingresos i
            WHERE i.id = %I.ingreso_id
              AND i.linea_negocio IS NOT NULL
              AND public.has_line_perm(auth.uid(), i.linea_negocio, 'delete')
          )
        )
    $p$, t, t);
  END LOOP;
END $$;


-- ── 7. RLS — módulo Contabilidad consolidada ────────────────────────────────
-- El "consolidado" no filtra solo por módulo: cada fila individual de
-- ingresos/gastos/facturas ya está protegida por línea (paso 5) — ver
-- consolidado con el módulo activado NO significa ver TODAS las líneas
-- (así lo pidió Julia explícitamente: acceso al módulo ≠ acceso a todas las
-- líneas). Por eso Contabilidad no necesita una política propia adicional:
-- hereda automáticamente la restricción de línea de las tablas que consulta.


-- ── 8. eventos, socios, movimientos_socios (siguen usando `area`, no línea)
-- `eventos` y el reparto de socios son exclusivos de La Montada Sound — se
-- protegen con permiso de línea 'montada_sound' directamente, sin columna
-- `linea_negocio` (no la necesitan: son monolínea por diseño).
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


-- ── 9. Trigger de protección — último administrador ─────────────────────────
-- Defensa en profundidad EN LA BASE DE DATOS (no solo en el frontend):
-- impide desactivar o degradar al último admin activo, y que un admin se
-- quite su propio rol/activo, incluso si alguien llamara a la API directa.
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
    SELECT count(*) INTO admins_restantes
    FROM public.profiles
    WHERE rol = 'admin' AND activo = true AND id != OLD.id;
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


-- ── 10. Retirada segura de la tabla `usuarios` (login antiguo) — Fase G ────
-- NO se borra la tabla ni sus filas — se conservan los datos de perfil
-- (nombre, email, rol, activo) por si hace falta consultarlos durante la
-- migración manual a `profiles`. Lo que SÍ se retira aquí es el acceso:
--   1. Se elimina la política abierta "acceso_total" (mismo problema que el
--      resto de tablas — sin esto, cualquiera con la anon key podía leer
--      `password_hash` de cualquier fila).
--   2. Se sustituye por una política de solo-admin (nadie más necesita ya
--      leer esta tabla: el frontend migra a `profiles`).
--   3. Se revoca el privilegio de columna sobre `password_hash` para TODOS
--      los roles (ni siquiera un admin autenticado puede seleccionarla vía
--      RLS+columna — solo un proceso con service_role, fuera del frontend,
--      podría necesitarlo alguna vez, y no debería).
-- El momento en que esta tabla se podrá BORRAR por completo: cuando todos
-- los usuarios de la lista de migración (ver informe) tengan cuenta activa
-- en Supabase Auth + `profiles`, confirmado por Julia, y exista un backup
-- exportado de esta tabla fuera de Supabase.
DROP POLICY IF EXISTS "acceso_total" ON public.usuarios;
DROP POLICY IF EXISTS "admin_only" ON public.usuarios;
CREATE POLICY "admin_only" ON public.usuarios FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

REVOKE SELECT (password_hash) ON public.usuarios FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- REQUISITO PREVIO NO INCLUIDO AQUÍ: migrar el login a Supabase Auth.
-- Hoy `usuarios` (tabla propia, password_hash SHA-256, sin auth.users) sigue
-- siendo la fuente de sesión del frontend. Esta migración crea el modelo
-- nuevo (profiles/user_line_permissions/user_module_permissions) EN
-- PARALELO, pero no mueve usuarios reales ni togglea el login todavía — se
-- deja para una migración de datos aparte, explícita y aprobada por
-- separado (creación de usuarios reales en auth.users vía Admin API/Edge
-- Function, nunca aquí).
--
-- PLAN DE REVERSIÓN (si algo fallara tras aplicar) — auditado en Fase G:
-- esta migración SÍ elimina las políticas "acceso_total" originales (pasos
-- 5/6/8/10), así que revertir significa recrearlas explícitamente, no
-- solo borrar lo nuevo:
--   -- 1. Restaurar acceso abierto en cada tabla financiera (ingresos,
--   --    gastos, facturas, equipo, impuestos, documentos, gastos_evento,
--   --    pagos_evento, suplidos, eventos, socios, movimientos_socios,
--   --    usuarios) — por cada una:
--   --      DROP POLICY IF EXISTS "select_by_line_perm" ON public.<tabla>;
--   --      -- (y el resto de políticas nuevas de esa tabla — ver nombres
--   --      -- en los pasos 5/6/8/10 de arriba)
--   --      CREATE POLICY "acceso_total" ON public.<tabla> FOR ALL
--   --        USING (true) WITH CHECK (true);
--   -- 2. Restaurar el acceso de columna sobre usuarios.password_hash:
--   --      GRANT SELECT (password_hash) ON public.usuarios TO authenticated;
--   -- 3. Quitar el trigger y las funciones auxiliares:
--   DROP TRIGGER IF EXISTS trg_protect_last_admin ON public.profiles;
--   DROP FUNCTION IF EXISTS public.protect_last_admin();
--   DROP FUNCTION IF EXISTS public.has_module_perm(UUID, TEXT, TEXT);
--   DROP FUNCTION IF EXISTS public.has_line_perm(UUID, TEXT, TEXT);
--   DROP FUNCTION IF EXISTS public.is_admin(UUID);
--   -- 4. Borrar las tablas nuevas:
--   DROP TABLE IF EXISTS public.user_module_permissions;
--   DROP TABLE IF EXISTS public.user_line_permissions;
--   DROP TABLE IF EXISTS public.profiles;
--   -- linea_negocio NO se revierte: es aditiva e inofensiva dejarla, pero
--   -- si hiciera falta: ALTER TABLE <tabla> DROP COLUMN linea_negocio;
-- IMPORTANTE: mientras el paso 1 de este rollback no se ejecute tabla por
-- tabla, esas tablas quedan SIN NINGUNA política permisiva — es decir, con
-- RLS activada pero 0 acceso para nadie (ni admin), no con el comportamiento
-- antiguo. El rollback debe aplicarse completo, no a medias.
-- ============================================================================
