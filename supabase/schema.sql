-- ══════════════════════════════════════════════════════════════════════════════
-- FINANZAS PRO — Schema Supabase  (ejecutar completo en SQL Editor)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── EVENTOS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eventos (
  id              TEXT    PRIMARY KEY,
  nombre          TEXT    NOT NULL,
  cliente         TEXT    NOT NULL,
  fecha           TEXT    NOT NULL,
  tipo            TEXT    NOT NULL,
  area            TEXT    NOT NULL,
  presupuesto     NUMERIC NOT NULL DEFAULT 0,
  pagos_recibidos NUMERIC NOT NULL DEFAULT 0,
  estado          TEXT    NOT NULL,
  notas           TEXT,
  created_at      TEXT    NOT NULL
);

-- ── INGRESOS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingresos (
  id                   TEXT    PRIMARY KEY,
  area                 TEXT    NOT NULL,
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
  metodo_pago          TEXT    NOT NULL,
  estado_pago          TEXT    NOT NULL DEFAULT 'pendiente',
  pagos_recibidos      NUMERIC NOT NULL DEFAULT 0,
  factura_emitida      BOOLEAN NOT NULL DEFAULT FALSE,
  numero_factura       TEXT,
  notas                TEXT,
  created_at           TEXT    NOT NULL
);

-- ── GASTOS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos (
  id               TEXT    PRIMARY KEY,
  area             TEXT    NOT NULL,
  fecha            TEXT    NOT NULL,
  concepto         TEXT    NOT NULL,
  categoria        TEXT    NOT NULL,
  tipo             TEXT    NOT NULL,
  proveedor        TEXT,
  base_imponible   NUMERIC NOT NULL DEFAULT 0,
  porcentaje_iva   NUMERIC NOT NULL DEFAULT 0,
  importe_iva      NUMERIC NOT NULL DEFAULT 0,
  total            NUMERIC NOT NULL DEFAULT 0,
  metodo_pago      TEXT    NOT NULL,
  estado_pago      TEXT    NOT NULL DEFAULT 'pendiente',
  factura_recibida BOOLEAN NOT NULL DEFAULT FALSE,
  deducible        BOOLEAN NOT NULL DEFAULT TRUE,
  evento_id        TEXT,
  observaciones    TEXT,
  created_at       TEXT    NOT NULL
);

-- ── SUPLIDOS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suplidos (
  id            TEXT    PRIMARY KEY,
  area          TEXT    NOT NULL,
  fecha         TEXT    NOT NULL,
  cliente       TEXT    NOT NULL,
  concepto      TEXT    NOT NULL,
  importe       NUMERIC NOT NULL DEFAULT 0,
  metodo_pago   TEXT    NOT NULL,
  justificante  BOOLEAN NOT NULL DEFAULT FALSE,
  evento_id     TEXT,
  observaciones TEXT,
  created_at    TEXT    NOT NULL
);

-- ── FACTURAS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id                TEXT    PRIMARY KEY,
  area              TEXT    NOT NULL,
  tipo              TEXT    NOT NULL,
  numero            TEXT    NOT NULL,
  serie             TEXT,
  cliente           TEXT    NOT NULL,
  concepto          TEXT    NOT NULL,
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
);

-- ── EQUIPO / INVERSIONES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipo (
  id                 TEXT    PRIMARY KEY,
  area               TEXT    NOT NULL,
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

-- ── GASTOS EVENTO ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos_evento (
  id            TEXT    PRIMARY KEY,
  ingreso_id    TEXT    NOT NULL,
  area          TEXT    NOT NULL,
  fecha         TEXT    NOT NULL,
  concepto      TEXT    NOT NULL,
  categoria     TEXT    NOT NULL,
  importe       NUMERIC NOT NULL DEFAULT 0,
  observaciones TEXT,
  created_at    TEXT    NOT NULL
);

-- ── PAGOS EVENTO ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos_evento (
  id            TEXT    PRIMARY KEY,
  ingreso_id    TEXT    NOT NULL,
  area          TEXT    NOT NULL,
  fecha         TEXT    NOT NULL,
  importe       NUMERIC NOT NULL DEFAULT 0,
  metodo_pago   TEXT    NOT NULL,
  concepto      TEXT    NOT NULL,
  observaciones TEXT,
  created_at    TEXT    NOT NULL
);

-- ── USUARIOS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id            TEXT    PRIMARY KEY,
  email         TEXT    UNIQUE NOT NULL,
  nombre        TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  rol           TEXT    NOT NULL DEFAULT 'usuario',
  permisos      JSONB   NOT NULL DEFAULT '{}',
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TEXT    NOT NULL
);

-- ── DOCUMENTOS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos (
  id                TEXT    PRIMARY KEY,
  entity_type       TEXT    NOT NULL,
  entity_id         TEXT    NOT NULL,
  area              TEXT    NOT NULL,
  nombre            TEXT    NOT NULL,
  tipo              TEXT    NOT NULL,
  storage_key       TEXT    NOT NULL,
  url               TEXT    NOT NULL,
  fecha_subida      TEXT    NOT NULL,
  subido_por        TEXT    NOT NULL,
  subido_por_nombre TEXT    NOT NULL,
  tamano            INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT    NOT NULL
);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (acceso total desde clave anon — app privada por login)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE eventos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE suplidos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipo       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_evento  ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acceso_total" ON eventos       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON ingresos      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON gastos        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON suplidos      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON facturas      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON equipo        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON gastos_evento FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON pagos_evento  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON usuarios      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON documentos    FOR ALL USING (true) WITH CHECK (true);

-- ── Bucket de almacenamiento para documentos (ejecutar por separado si falla) ─
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', false)
-- ON CONFLICT (id) DO NOTHING;
-- CREATE POLICY "acceso_total" ON storage.objects FOR ALL USING (bucket_id = 'documentos') WITH CHECK (bucket_id = 'documentos');

-- ── Columnas nuevas en tablas existentes (ejecutar si ya tenías la BD) ────────
-- ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS empresa BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE ingresos ADD COLUMN IF NOT EXISTS fecha_cobro_prevista TEXT;
-- ALTER TABLE gastos   ADD COLUMN IF NOT EXISTS estado_pago TEXT NOT NULL DEFAULT 'pendiente';
-- ALTER TABLE equipo   ADD COLUMN IF NOT EXISTS forma_pago TEXT;
-- ALTER TABLE equipo   ADD COLUMN IF NOT EXISTS financiado BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE equipo   ADD COLUMN IF NOT EXISTS vida_util INTEGER;
-- ALTER TABLE equipo   ADD COLUMN IF NOT EXISTS garantia INTEGER;
-- ALTER TABLE equipo   ADD COLUMN IF NOT EXISTS fecha_fin_garantia TEXT;
-- ALTER TABLE equipo   ADD COLUMN IF NOT EXISTS numero_serie TEXT;
-- ALTER TABLE facturas ADD COLUMN IF NOT EXISTS serie TEXT;
-- ALTER TABLE facturas ADD COLUMN IF NOT EXISTS pagos_recibidos NUMERIC NOT NULL DEFAULT 0;
-- ALTER TABLE facturas ADD COLUMN IF NOT EXISTS ingreso_id TEXT;
-- ALTER TABLE facturas ADD COLUMN IF NOT EXISTS enviada BOOLEAN NOT NULL DEFAULT FALSE;
