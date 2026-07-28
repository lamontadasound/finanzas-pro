-- ══════════════════════════════════════════════════════════════════
-- Reserva opcional en ingresos ("¿Tiene reserva?"). Solo ADD, nunca DROP.
-- Ejecutar manualmente en el SQL Editor de Supabase tras revisión.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.ingresos ADD COLUMN IF NOT EXISTS tiene_reserva       BOOLEAN DEFAULT FALSE;
ALTER TABLE public.ingresos ADD COLUMN IF NOT EXISTS fecha_cobro_reserva TEXT;
ALTER TABLE public.ingresos ADD COLUMN IF NOT EXISTS metodo_pago_reserva TEXT;

-- ─────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────────
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ingresos' AND column_name IN ('tiene_reserva', 'fecha_cobro_reserva', 'metodo_pago_reserva', 'reserva', 'sin_factura', 'linea_negocio');
