-- ══════════════════════════════════════════════════════════════════════════════
-- FINANZAS PRO — Schema Supabase
-- Pegar completo en: Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════════════════

-- ── EVENTOS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eventos (
  id            TEXT        PRIMARY KEY,
  nombre        TEXT        NOT NULL,
  cliente       TEXT        NOT NULL,
  fecha         TEXT        NOT NULL,
  tipo          TEXT        NOT NULL,
  area          TEXT        NOT NULL,
  presupuesto   NUMERIC     NOT NULL DEFAULT 0,
  pagos_recibidos NUMERIC   NOT NULL DEFAULT 0,
  estado        TEXT        NOT NULL,
  notas         TEXT,
  created_at    TEXT        NOT NULL
);

-- ── INGRESOS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingresos (
  id               TEXT    PRIMARY KEY,
  area             TEXT    NOT NULL,
  concepto         TEXT    NOT NULL,
  cliente          TEXT    NOT NULL,
  tipo_evento      TEXT    NOT NULL,
  evento_id        TEXT,
  fecha_evento     TEXT    NOT NULL,
  fecha_factura    TEXT,
  fecha_pago       TEXT,
  base_imponible   NUMERIC NOT NULL DEFAULT 0,
  porcentaje_iva   NUMERIC NOT NULL DEFAULT 0,
  importe_iva      NUMERIC NOT NULL DEFAULT 0,
  total            NUMERIC NOT NULL DEFAULT 0,
  metodo_pago      TEXT    NOT NULL,
  estado_pago      TEXT    NOT NULL,
  pagos_recibidos  NUMERIC NOT NULL DEFAULT 0,
  factura_emitida  BOOLEAN NOT NULL DEFAULT FALSE,
  numero_factura   TEXT,
  notas            TEXT,
  created_at       TEXT    NOT NULL
);

-- ── GASTOS ──────────────────────────────────────────────────────────────────
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
  factura_recibida BOOLEAN NOT NULL DEFAULT FALSE,
  deducible        BOOLEAN NOT NULL DEFAULT TRUE,
  evento_id        TEXT,
  observaciones    TEXT,
  created_at       TEXT    NOT NULL
);

-- ── SUPLIDOS ────────────────────────────────────────────────────────────────
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

-- ── FACTURAS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id                TEXT    PRIMARY KEY,
  area              TEXT    NOT NULL,
  tipo              TEXT    NOT NULL,
  numero            TEXT    NOT NULL,
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
  iva_deducible     BOOLEAN NOT NULL DEFAULT FALSE,
  evento_id         TEXT,
  notas             TEXT
);

-- ── EQUIPO ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipo (
  id               TEXT    PRIMARY KEY,
  area             TEXT    NOT NULL,
  nombre           TEXT    NOT NULL,
  categoria        TEXT    NOT NULL,
  base_imponible   NUMERIC NOT NULL DEFAULT 0,
  porcentaje_iva   NUMERIC NOT NULL DEFAULT 0,
  importe_iva      NUMERIC NOT NULL DEFAULT 0,
  total            NUMERIC NOT NULL DEFAULT 0,
  fecha_compra     TEXT    NOT NULL,
  proveedor        TEXT,
  factura_recibida BOOLEAN NOT NULL DEFAULT FALSE,
  observaciones    TEXT,
  created_at       TEXT    NOT NULL
);

-- ── GASTOS EVENTO ───────────────────────────────────────────────────────────
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

-- ── PAGOS EVENTO ────────────────────────────────────────────────────────────
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

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- App de usuario único — permitir todas las operaciones con la clave anon
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE gastos_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_evento  ENABLE ROW LEVEL SECURITY;

ALTER TABLE eventos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE suplidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipo   ENABLE ROW LEVEL SECURITY;

-- Política: acceso total desde clave anon (app privada protegida por login)
CREATE POLICY "acceso_total" ON eventos  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON ingresos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON gastos   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON suplidos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON facturas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON equipo        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON gastos_evento FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total" ON pagos_evento  FOR ALL USING (true) WITH CHECK (true);
