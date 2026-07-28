-- ══════════════════════════════════════════════════════════════════
-- FASE 1 — Reestructuración Finanzas Pro
-- Aprobada con condición: NO se reutiliza ni se cambia el significado
-- de ninguna columna existente. "importe" en gastos_evento se mantiene
-- tal cual (legado); toda cifra nueva va en columnas nuevas.
-- Patrón: solo ADD, nunca DROP. Todo con DEFAULT para no romper filas.
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 0. COMPROBACIÓN PREVIA — ejecutar y REVISAR el resultado antes de
--    continuar con el resto del script. Si devuelve filas, avisa
--    antes de aplicar el UNIQUE de facturas (paso 5).
-- ─────────────────────────────────────────────────────────────────
SELECT numero, area, tipo, COUNT(*) AS duplicados
FROM public.facturas
GROUP BY numero, area, tipo
HAVING COUNT(*) > 1;

-- ─────────────────────────────────────────────────────────────────
-- 1. GASTOS RECURRENTES (tabla nueva)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gastos_recurrentes (
  id                  TEXT PRIMARY KEY,
  area                TEXT NOT NULL CHECK (area IN ('montada','dj')),
  concepto            TEXT NOT NULL,
  categoria           TEXT NOT NULL,
  tipo                TEXT NOT NULL DEFAULT 'variable',
  proveedor           TEXT,
  base_imponible      NUMERIC NOT NULL DEFAULT 0,
  porcentaje_iva      NUMERIC NOT NULL DEFAULT 0,
  periodicidad        TEXT NOT NULL CHECK (periodicidad IN ('mensual','trimestral','semestral','anual','personalizada')),
  intervalo_dias      INTEGER,
  fecha_inicio        TEXT NOT NULL,
  fecha_fin           TEXT,
  renovacion_auto     BOOLEAN NOT NULL DEFAULT FALSE,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TEXT NOT NULL,
  created_by          TEXT,
  updated_at          TEXT,
  updated_by          TEXT
);

ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS recurrencia_id TEXT;
CREATE INDEX IF NOT EXISTS idx_gastos_recurrencia ON public.gastos (recurrencia_id);

-- ─────────────────────────────────────────────────────────────────
-- 2. GASTOS DE EVENTO — SOLO columnas nuevas. "importe" NO se toca
--    ni cambia de significado; se mantiene por compatibilidad.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.gastos_evento ADD COLUMN IF NOT EXISTS base_imponible   NUMERIC;
ALTER TABLE public.gastos_evento ADD COLUMN IF NOT EXISTS porcentaje_iva   NUMERIC;
ALTER TABLE public.gastos_evento ADD COLUMN IF NOT EXISTS importe_iva      NUMERIC;
ALTER TABLE public.gastos_evento ADD COLUMN IF NOT EXISTS total_con_iva    NUMERIC;
ALTER TABLE public.gastos_evento ADD COLUMN IF NOT EXISTS factura_recibida BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.gastos_evento ADD COLUMN IF NOT EXISTS numero_factura   TEXT;
ALTER TABLE public.gastos_evento ADD COLUMN IF NOT EXISTS estado_pago      TEXT NOT NULL DEFAULT 'pendiente';
ALTER TABLE public.gastos_evento ADD COLUMN IF NOT EXISTS proveedor        TEXT;
ALTER TABLE public.gastos_evento ADD COLUMN IF NOT EXISTS tipo             TEXT;
-- Nota: para filas ya existentes, base_imponible/porcentaje_iva/importe_iva/total_con_iva
-- quedan en NULL hasta que se editen desde la UI (Fase 4). "importe" sigue siendo
-- el campo legado válido y no se sobrescribe.

-- ─────────────────────────────────────────────────────────────────
-- 3. GASTOS GENERALES — quién pagó + fecha de pago + nº factura
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS pagado_por     TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS fecha_pago     TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS numero_factura TEXT;

-- ─────────────────────────────────────────────────────────────────
-- 4. INGRESOS — nuevo formulario: Reserva + "No factura"
--    "fecha_cobro_prevista" se mantiene en BD (solo se deja de usar
--    en el formulario); no se borra ni se renombra.
--    "empresa" tampoco se toca ni se reutiliza — se añade una columna
--    nueva e independiente para "No factura".
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.ingresos ADD COLUMN IF NOT EXISTS reserva     NUMERIC DEFAULT 0;
ALTER TABLE public.ingresos ADD COLUMN IF NOT EXISTS sin_factura BOOLEAN DEFAULT FALSE;
ALTER TABLE public.ingresos ADD COLUMN IF NOT EXISTS linea_negocio TEXT;

-- ─────────────────────────────────────────────────────────────────
-- 5. FACTURAS — documento adjunto + anti-duplicados
--    ⚠ Ejecutar el paso 0 antes. Si detecta duplicados, comentar
--    el bloque UNIQUE de abajo y avisar antes de continuar.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS documento_id TEXT;

DO $$ BEGIN
  ALTER TABLE public.facturas ADD CONSTRAINT uq_factura_num_area_tipo UNIQUE (numero, area, tipo);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 6. INVERSIONES (equipo) — campos ampliados, todo nuevo
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS descripcion           TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS marca                 TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS modelo                TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS comprador             TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS propietario           TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS evento_relacionado_id TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS valor_residual        NUMERIC DEFAULT 0;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS documento_id          TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS ingresos_generados     NUMERIC DEFAULT 0;

-- 6.b — Ampliar el CHECK de área para admitir 'real_madrid' (antes solo montada/dj).
-- Necesario para poder guardar inversiones asignadas a Real Madrid.
ALTER TABLE public.equipo DROP CONSTRAINT IF EXISTS equipo_area_check;
ALTER TABLE public.equipo ADD CONSTRAINT equipo_area_check CHECK (area IN ('montada','dj','real_madrid'));

-- ─────────────────────────────────────────────────────────────────
-- 7. AUDITORÍA — creado/modificado por, columnas nuevas
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.ingresos      ADD COLUMN IF NOT EXISTS created_by TEXT, ADD COLUMN IF NOT EXISTS updated_by TEXT, ADD COLUMN IF NOT EXISTS updated_at TEXT;
ALTER TABLE public.gastos        ADD COLUMN IF NOT EXISTS created_by TEXT, ADD COLUMN IF NOT EXISTS updated_by TEXT, ADD COLUMN IF NOT EXISTS updated_at TEXT;
ALTER TABLE public.gastos_evento ADD COLUMN IF NOT EXISTS created_by TEXT, ADD COLUMN IF NOT EXISTS updated_by TEXT, ADD COLUMN IF NOT EXISTS updated_at TEXT;
ALTER TABLE public.pagos_evento  ADD COLUMN IF NOT EXISTS created_by TEXT, ADD COLUMN IF NOT EXISTS updated_by TEXT, ADD COLUMN IF NOT EXISTS updated_at TEXT;
ALTER TABLE public.facturas      ADD COLUMN IF NOT EXISTS created_by TEXT, ADD COLUMN IF NOT EXISTS updated_by TEXT, ADD COLUMN IF NOT EXISTS updated_at TEXT;
ALTER TABLE public.equipo        ADD COLUMN IF NOT EXISTS created_by TEXT, ADD COLUMN IF NOT EXISTS updated_by TEXT, ADD COLUMN IF NOT EXISTS updated_at TEXT;

-- ─────────────────────────────────────────────────────────────────
-- 8. HISTORIAL DE PAGOS (tabla nueva)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.historial_pagos (
  id             TEXT PRIMARY KEY,
  ingreso_id     TEXT NOT NULL,
  area           TEXT NOT NULL CHECK (area IN ('montada','dj')),
  fecha          TEXT NOT NULL,
  importe        NUMERIC NOT NULL DEFAULT 0,
  metodo_pago    TEXT NOT NULL DEFAULT 'transferencia',
  observaciones  TEXT,
  registrado_por TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_historial_pagos_ingreso ON public.historial_pagos (ingreso_id);

-- ─────────────────────────────────────────────────────────────────
-- 9. RLS — mismo patrón "acceso_total" ya usado en el resto de tablas
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.gastos_recurrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_pagos    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acceso_total" ON public.gastos_recurrentes;
DROP POLICY IF EXISTS "acceso_total" ON public.historial_pagos;

CREATE POLICY "acceso_total" ON public.gastos_recurrentes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON public.historial_pagos    FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────
-- 10. STORAGE — bucket de documentos (tabla ya existía, bucket no)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "acceso_total_docs" ON storage.objects;
CREATE POLICY "acceso_total_docs" ON storage.objects
  FOR ALL USING (bucket_id = 'documentos')
  WITH CHECK (bucket_id = 'documentos');

-- ─────────────────────────────────────────────────────────────────
-- 11. VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('gastos','gastos_evento','facturas','equipo','gastos_recurrentes','historial_pagos')
ORDER BY table_name, ordinal_position;
