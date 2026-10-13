-- ══════════════════════════════════════════════════════════════════
-- Equipo (Inversiones): columnas que el código ya usa pero nunca
-- llegaron a crearse en esta base de datos — por eso cada alta de
-- equipo fallaba en silencio (PGRST204: columna no encontrada).
-- Solo ADD, nunca DROP. Ejecutar tras revisión.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS descripcion           TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS marca                 TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS modelo                TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS comprador             TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS propietario           TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS evento_relacionado_id TEXT;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS valor_residual        NUMERIC DEFAULT 0;
ALTER TABLE public.equipo ADD COLUMN IF NOT EXISTS documento_id          TEXT;

-- ─────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────────
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'equipo'
  AND column_name IN ('descripcion','marca','modelo','comprador','propietario','evento_relacionado_id','valor_residual','documento_id','cantidad')
ORDER BY column_name;
