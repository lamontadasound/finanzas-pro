-- ══════════════════════════════════════════════════════════════════
-- Impuestos (Contabilidad): cuota de autónomos, nóminas y S.S., IVA
-- e Impuesto de Sociedades. Solo ADD/CREATE, nunca DROP.
-- Ejecutar manualmente en el SQL Editor de Supabase tras revisión.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.impuestos (
  id            TEXT PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('autonomos', 'nominas_ss', 'iva', 'sociedades')),
  concepto      TEXT NOT NULL,
  fecha         TEXT NOT NULL,
  importe       NUMERIC NOT NULL DEFAULT 0,
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
  fecha_pago    TEXT,
  observaciones TEXT,
  linea_negocio TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_impuestos_fecha ON public.impuestos (fecha);

ALTER TABLE public.impuestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acceso_total" ON public.impuestos;
CREATE POLICY "acceso_total" ON public.impuestos FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'impuestos'
ORDER BY ordinal_position;
