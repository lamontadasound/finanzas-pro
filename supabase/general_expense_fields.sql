-- Repair all missing columns sent by toDbGasto. No historical data updates.
ALTER TABLE public.gastos
 ADD COLUMN IF NOT EXISTS pagado_por text,
 ADD COLUMN IF NOT EXISTS fecha_pago text,
 ADD COLUMN IF NOT EXISTS numero_factura text,
 ADD COLUMN IF NOT EXISTS recurrencia_id text;
NOTIFY pgrst, 'reload schema';
-- Safe rollback: revert client if necessary; retain nullable columns so newly
-- entered information is not lost. Existing amounts and IDs are untouched.
