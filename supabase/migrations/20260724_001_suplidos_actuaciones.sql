-- ══════════════════════════════════════════════════════════════════
-- Suplidos por actuación (DJs). Solo ADD, nunca DROP. Todo con DEFAULT.
-- Ejecutar manualmente en el SQL Editor de Supabase tras revisión.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.suplidos ADD COLUMN IF NOT EXISTS ingreso_id          TEXT;
ALTER TABLE public.suplidos ADD COLUMN IF NOT EXISTS estado              TEXT DEFAULT 'pendiente';
ALTER TABLE public.suplidos ADD COLUMN IF NOT EXISTS cantidad_recuperada NUMERIC DEFAULT 0;
ALTER TABLE public.suplidos ADD COLUMN IF NOT EXISTS fecha_cobro         TEXT;

CREATE INDEX IF NOT EXISTS idx_suplidos_ingreso ON public.suplidos (ingreso_id);

-- ─────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────────
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'suplidos' AND column_name IN ('ingreso_id', 'estado', 'cantidad_recuperada', 'fecha_cobro');
