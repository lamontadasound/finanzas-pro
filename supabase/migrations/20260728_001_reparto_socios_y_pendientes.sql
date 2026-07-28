-- ══════════════════════════════════════════════════════════════════
-- Reparto de socios (tablas nuevas) + columnas pendientes de esta
-- sesión (dj_relacionado en ingresos). Solo ADD/CREATE, nunca DROP.
-- Ejecutar manualmente en el SQL Editor de Supabase tras revisión.
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. SOCIOS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.socios (
  id                    TEXT PRIMARY KEY,
  nombre                TEXT NOT NULL,
  porcentaje            NUMERIC NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  fecha_incorporacion   TEXT,
  activo                BOOLEAN DEFAULT TRUE,
  observaciones         TEXT
);

ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS fecha_incorporacion TEXT;
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS activo              BOOLEAN DEFAULT TRUE;
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS observaciones       TEXT;

-- ─────────────────────────────────────────────────────────────────
-- 2. MOVIMIENTOS DE SOCIOS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.movimientos_socios (
  id            TEXT PRIMARY KEY,
  socio_id      TEXT NOT NULL REFERENCES public.socios(id),
  fecha         TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN (
                  'aportacion_personal','reintegro_aportacion','beneficio_reinvertido',
                  'reparto_beneficio_cobrado','adelanto_socio','devolucion_adelanto','ajuste'
                )),
  cantidad      NUMERIC NOT NULL DEFAULT 0,
  concepto      TEXT,
  cuenta        TEXT,
  documento_id  TEXT,
  observaciones TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movimientos_socios_socio ON public.movimientos_socios (socio_id);

-- ─────────────────────────────────────────────────────────────────
-- 3. RLS — mismo patrón "acceso_total" ya usado en el resto de tablas
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.socios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_socios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acceso_total" ON public.socios;
DROP POLICY IF EXISTS "acceso_total" ON public.movimientos_socios;

CREATE POLICY "acceso_total" ON public.socios             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON public.movimientos_socios FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────
-- 4. INGRESOS — DJ relacionado con la actuación (pendiente de sesiones
--    anteriores, nunca incluida en una migración hasta ahora)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.ingresos ADD COLUMN IF NOT EXISTS dj_relacionado TEXT;

-- ─────────────────────────────────────────────────────────────────
-- 5. GASTOS GENERALES — línea de negocio + recurrencia completa
--    (la tabla gastos_recurrentes ya existe; estas columnas son las
--    que usa el formulario de Gastos generales directamente sobre
--    cada fila generada, para que dejen de ser solo de UI)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS linea_negocio             TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS es_recurrente             BOOLEAN DEFAULT FALSE;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS periodicidad              TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS fecha_inicio_recurrencia  TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS fecha_fin_recurrencia     TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS proxima_fecha_pago        TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS renovacion_automatica     BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────
-- 6. GASTOS DE EVENTO — quién lo pagó (columna que faltaba)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.gastos_evento ADD COLUMN IF NOT EXISTS pagado_por TEXT;

-- ─────────────────────────────────────────────────────────────────
-- 7. INVERSIONES (equipo) — cantidad de unidades del mismo producto
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS cantidad NUMERIC DEFAULT 1;

-- ─────────────────────────────────────────────────────────────────
-- 8. VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('socios','movimientos_socios')
ORDER BY table_name, ordinal_position;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ingresos' AND column_name = 'dj_relacionado';

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'gastos' AND column_name IN
  ('linea_negocio','es_recurrente','periodicidad','fecha_inicio_recurrencia','fecha_fin_recurrencia','proxima_fecha_pago','renovacion_automatica');

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'gastos_evento' AND column_name = 'pagado_por';

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'equipo' AND column_name = 'cantidad';
