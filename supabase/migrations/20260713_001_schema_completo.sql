-- ══════════════════════════════════════════════════════════════════════════════
-- FINANZAS PRO — Migración completa (safe, no borra datos existentes)
-- Ejecutar en: Supabase → SQL Editor → New query → Run
--
-- Estrategia:
--   • CREATE TABLE IF NOT EXISTS   → crea si no existe, no toca la existente
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS → añade columnas nuevas sin romper
--   • CREATE POLICY … IF NOT EXISTS → evita error si la política ya existe
--   • Índices con IF NOT EXISTS
--   • Bucket de Storage comentado por separado al final
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLAS (CREATE IF NOT EXISTS = seguro para BD existente)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── eventos ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eventos (
  id              TEXT    PRIMARY KEY,
  nombre          TEXT    NOT NULL,
  cliente         TEXT    NOT NULL,
  fecha           TEXT    NOT NULL,
  tipo            TEXT    NOT NULL,
  area            TEXT    NOT NULL CHECK (area IN ('montada','dj')),
  presupuesto     NUMERIC NOT NULL DEFAULT 0,
  pagos_recibidos NUMERIC NOT NULL DEFAULT 0,
  estado          TEXT    NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','confirmado','realizado','cobrado','facturado')),
  notas           TEXT,
  created_at      TEXT    NOT NULL
);

-- ── ingresos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ingresos (
  id                   TEXT    PRIMARY KEY,
  area                 TEXT    NOT NULL CHECK (area IN ('montada','dj')),
  concepto             TEXT    NOT NULL,
  cliente              TEXT    NOT NULL,
  empresa              BOOLEAN NOT NULL DEFAULT FALSE,
  tipo_evento          TEXT    NOT NULL,
  evento_id            TEXT,
  fecha_evento         TEXT    NOT NULL,
  fecha_factura        TEXT,
  fecha_cobro_prevista TEXT,
  fecha_pago           TEXT,
  base_imponible       NUMERIC NOT NULL DEFAULT 0,
  porcentaje_iva       NUMERIC NOT NULL DEFAULT 0,
  importe_iva          NUMERIC NOT NULL DEFAULT 0,
  total                NUMERIC NOT NULL DEFAULT 0,
  metodo_pago          TEXT    NOT NULL DEFAULT 'transferencia',
  estado_pago          TEXT    NOT NULL DEFAULT 'pendiente'
                       CHECK (estado_pago IN ('presupuesto','pendiente','parcial','pagado','cancelado')),
  pagos_recibidos      NUMERIC NOT NULL DEFAULT 0,
  factura_emitida      BOOLEAN NOT NULL DEFAULT FALSE,
  numero_factura       TEXT,
  notas                TEXT,
  created_at           TEXT    NOT NULL
);

-- ── gastos ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gastos (
  id               TEXT    PRIMARY KEY,
  area             TEXT    NOT NULL CHECK (area IN ('montada','dj')),
  fecha            TEXT    NOT NULL,
  concepto         TEXT    NOT NULL,
  categoria        TEXT    NOT NULL,
  tipo             TEXT    NOT NULL DEFAULT 'variable' CHECK (tipo IN ('fijo','variable')),
  proveedor        TEXT,
  base_imponible   NUMERIC NOT NULL DEFAULT 0,
  porcentaje_iva   NUMERIC NOT NULL DEFAULT 0,
  importe_iva      NUMERIC NOT NULL DEFAULT 0,
  total            NUMERIC NOT NULL DEFAULT 0,
  metodo_pago      TEXT    NOT NULL DEFAULT 'transferencia',
  estado_pago      TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente','pagado')),
  factura_recibida BOOLEAN NOT NULL DEFAULT FALSE,
  deducible        BOOLEAN NOT NULL DEFAULT TRUE,
  evento_id        TEXT,
  observaciones    TEXT,
  created_at       TEXT    NOT NULL
);

-- ── suplidos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suplidos (
  id            TEXT    PRIMARY KEY,
  area          TEXT    NOT NULL CHECK (area IN ('montada','dj')),
  fecha         TEXT    NOT NULL,
  cliente       TEXT    NOT NULL,
  concepto      TEXT    NOT NULL,
  importe       NUMERIC NOT NULL DEFAULT 0,
  metodo_pago   TEXT    NOT NULL DEFAULT 'efectivo',
  justificante  BOOLEAN NOT NULL DEFAULT FALSE,
  evento_id     TEXT,
  observaciones TEXT,
  created_at    TEXT    NOT NULL
);

-- ── facturas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.facturas (
  id                TEXT    PRIMARY KEY,
  area              TEXT    NOT NULL CHECK (area IN ('montada','dj')),
  tipo              TEXT    NOT NULL CHECK (tipo IN ('emitida','recibida')),
  numero            TEXT    NOT NULL,
  serie             TEXT,
  cliente           TEXT    NOT NULL,
  concepto          TEXT    NOT NULL DEFAULT '',
  base_imponible    NUMERIC NOT NULL DEFAULT 0,
  porcentaje_iva    NUMERIC NOT NULL DEFAULT 0,
  importe_iva       NUMERIC NOT NULL DEFAULT 0,
  total             NUMERIC NOT NULL DEFAULT 0,
  fecha             TEXT    NOT NULL,
  fecha_vencimiento TEXT,
  fecha_pago        TEXT,
  pagada            BOOLEAN NOT NULL DEFAULT FALSE,
  pagos_recibidos   NUMERIC NOT NULL DEFAULT 0,
  iva_deducible     BOOLEAN NOT NULL DEFAULT TRUE,
  evento_id         TEXT,
  ingreso_id        TEXT,
  enviada           BOOLEAN NOT NULL DEFAULT FALSE,
  notas             TEXT
  -- sin created_at en el schema original; lo añadimos abajo con ADD COLUMN IF NOT EXISTS
);

-- ── equipo / inversiones ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.equipo (
  id                 TEXT    PRIMARY KEY,
  area               TEXT    NOT NULL CHECK (area IN ('montada','dj')),
  nombre             TEXT    NOT NULL,
  categoria          TEXT    NOT NULL,
  base_imponible     NUMERIC NOT NULL DEFAULT 0,
  porcentaje_iva     NUMERIC NOT NULL DEFAULT 0,
  importe_iva        NUMERIC NOT NULL DEFAULT 0,
  total              NUMERIC NOT NULL DEFAULT 0,
  fecha_compra       TEXT    NOT NULL,
  proveedor          TEXT,
  factura_recibida   BOOLEAN NOT NULL DEFAULT FALSE,
  forma_pago         TEXT,
  financiado         BOOLEAN NOT NULL DEFAULT FALSE,
  vida_util          INTEGER,
  garantia           INTEGER,
  fecha_fin_garantia TEXT,
  numero_serie       TEXT,
  observaciones      TEXT,
  created_at         TEXT    NOT NULL
);

-- ── gastos_evento ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gastos_evento (
  id            TEXT    PRIMARY KEY,
  ingreso_id    TEXT    NOT NULL,
  area          TEXT    NOT NULL CHECK (area IN ('montada','dj')),
  fecha         TEXT    NOT NULL,
  concepto      TEXT    NOT NULL,
  categoria     TEXT    NOT NULL,
  importe       NUMERIC NOT NULL DEFAULT 0,
  observaciones TEXT,
  created_at    TEXT    NOT NULL
);

-- ── pagos_evento ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pagos_evento (
  id            TEXT    PRIMARY KEY,
  ingreso_id    TEXT    NOT NULL,
  area          TEXT    NOT NULL CHECK (area IN ('montada','dj')),
  fecha         TEXT    NOT NULL,
  importe       NUMERIC NOT NULL DEFAULT 0,
  metodo_pago   TEXT    NOT NULL DEFAULT 'efectivo',
  concepto      TEXT    NOT NULL,
  observaciones TEXT,
  created_at    TEXT    NOT NULL
);

-- ── usuarios ──────────────────────────────────────────────────────────────────
-- ESTA es la tabla que faltaba y causaba el error
CREATE TABLE IF NOT EXISTS public.usuarios (
  id            TEXT    PRIMARY KEY,
  email         TEXT    UNIQUE NOT NULL,
  nombre        TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  rol           TEXT    NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin','usuario')),
  permisos      JSONB   NOT NULL DEFAULT '{
    "montada":     {"ver":false,"crear":false,"editar":false,"eliminar":false},
    "dj":          {"ver":false,"crear":false,"editar":false,"eliminar":false},
    "inversiones": {"ver":false,"crear":false,"editar":false,"eliminar":false},
    "facturas":    {"ver":false,"crear":false,"editar":false,"eliminar":false},
    "informes":    {"ver":false,"crear":false,"editar":false,"eliminar":false}
  }',
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TEXT    NOT NULL
);

-- ── documentos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documentos (
  id                TEXT    PRIMARY KEY,
  entity_type       TEXT    NOT NULL CHECK (entity_type IN ('ingreso','gasto','factura','evento','equipo')),
  entity_id         TEXT    NOT NULL,
  area              TEXT    NOT NULL CHECK (area IN ('montada','dj')),
  nombre            TEXT    NOT NULL,
  tipo              TEXT    NOT NULL CHECK (tipo IN ('factura','presupuesto','contrato','justificante','ticket','otro')),
  storage_key       TEXT    NOT NULL,
  url               TEXT    NOT NULL,
  fecha_subida      TEXT    NOT NULL,
  subido_por        TEXT    NOT NULL,
  subido_por_nombre TEXT    NOT NULL,
  tamano            INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT    NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. COLUMNAS NUEVAS en tablas ya existentes (ADD COLUMN IF NOT EXISTS = seguro)
-- ─────────────────────────────────────────────────────────────────────────────

-- ingresos: campos añadidos en la nueva versión
ALTER TABLE public.ingresos ADD COLUMN IF NOT EXISTS empresa              BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.ingresos ADD COLUMN IF NOT EXISTS fecha_cobro_prevista TEXT;
ALTER TABLE public.ingresos ADD COLUMN IF NOT EXISTS fecha_factura        TEXT;
ALTER TABLE public.ingresos ADD COLUMN IF NOT EXISTS fecha_pago           TEXT;

-- gastos: estado_pago era opcional, ahora obligatorio con default
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS estado_pago TEXT NOT NULL DEFAULT 'pendiente';

-- equipo: campos de inversiones extendidos
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS forma_pago         TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS financiado         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS vida_util          INTEGER;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS garantia           INTEGER;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS fecha_fin_garantia TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS numero_serie       TEXT;

-- facturas: campos nuevos
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS serie           TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS pagos_recibidos NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS ingreso_id      TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS enviada         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS created_at      TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ÍNDICES (mejoran rendimiento en filtros habituales)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ingresos_area        ON public.ingresos (area);
CREATE INDEX IF NOT EXISTS idx_ingresos_fecha       ON public.ingresos (fecha_evento);
CREATE INDEX IF NOT EXISTS idx_ingresos_estado_pago ON public.ingresos (estado_pago);
CREATE INDEX IF NOT EXISTS idx_gastos_area          ON public.gastos (area);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha         ON public.gastos (fecha);
CREATE INDEX IF NOT EXISTS idx_eventos_area         ON public.eventos (area);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha        ON public.eventos (fecha);
CREATE INDEX IF NOT EXISTS idx_facturas_area        ON public.facturas (area);
CREATE INDEX IF NOT EXISTS idx_facturas_tipo        ON public.facturas (tipo);
CREATE INDEX IF NOT EXISTS idx_equipo_area          ON public.equipo (area);
CREATE INDEX IF NOT EXISTS idx_gastos_evento_ingreso ON public.gastos_evento (ingreso_id);
CREATE INDEX IF NOT EXISTS idx_pagos_evento_ingreso  ON public.pagos_evento (ingreso_id);
CREATE INDEX IF NOT EXISTS idx_documentos_entity    ON public.documentos (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email       ON public.usuarios (email);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
-- La app usa clave anon pero tiene login propio, así que RLS = acceso total
-- (la autenticación la gestiona la app, no Supabase Auth)

ALTER TABLE public.eventos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingresos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suplidos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_evento  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos    ENABLE ROW LEVEL SECURITY;

-- DROP + CREATE para evitar "policy already exists" en re-ejecuciones
DO $$ BEGIN
  DROP POLICY IF EXISTS "acceso_total" ON public.eventos;
  DROP POLICY IF EXISTS "acceso_total" ON public.ingresos;
  DROP POLICY IF EXISTS "acceso_total" ON public.gastos;
  DROP POLICY IF EXISTS "acceso_total" ON public.suplidos;
  DROP POLICY IF EXISTS "acceso_total" ON public.facturas;
  DROP POLICY IF EXISTS "acceso_total" ON public.equipo;
  DROP POLICY IF EXISTS "acceso_total" ON public.gastos_evento;
  DROP POLICY IF EXISTS "acceso_total" ON public.pagos_evento;
  DROP POLICY IF EXISTS "acceso_total" ON public.usuarios;
  DROP POLICY IF EXISTS "acceso_total" ON public.documentos;
END $$;

CREATE POLICY "acceso_total" ON public.eventos       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON public.ingresos      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON public.gastos        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON public.suplidos      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON public.facturas      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON public.equipo        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON public.gastos_evento FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON public.pagos_evento  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON public.usuarios      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON public.documentos    FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VERIFICACIÓN FINAL (devuelve las tablas creadas para confirmar)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  t.table_name,
  COUNT(c.column_name) AS columnas,
  obj_description(pc.oid, 'pg_class') AS comentario
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_name = t.table_name AND c.table_schema = 'public'
JOIN pg_class pc
  ON pc.relname = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    'eventos','ingresos','gastos','suplidos','facturas',
    'equipo','gastos_evento','pagos_evento','usuarios','documentos'
  )
GROUP BY t.table_name, pc.oid
ORDER BY t.table_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. BUCKET DE STORAGE PARA DOCUMENTOS (ejecutar por separado si falla)
-- ─────────────────────────────────────────────────────────────────────────────
-- Descomenta y ejecuta solo si vas a usar la subida de documentos:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('documentos', 'documentos', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- DROP POLICY IF EXISTS "acceso_total_docs" ON storage.objects;
-- CREATE POLICY "acceso_total_docs" ON storage.objects
--   FOR ALL USING (bucket_id = 'documentos')
--   WITH CHECK (bucket_id = 'documentos');
