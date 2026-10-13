-- Additive repair: the client already sends these optional fields.
-- No backfill: historical amounts and unknown payment details stay unchanged.
ALTER TABLE public.gastos_evento
 ADD COLUMN IF NOT EXISTS base_imponible numeric,
 ADD COLUMN IF NOT EXISTS porcentaje_iva numeric,
 ADD COLUMN IF NOT EXISTS importe_iva numeric,
 ADD COLUMN IF NOT EXISTS total_con_iva numeric,
 ADD COLUMN IF NOT EXISTS factura_recibida boolean,
 ADD COLUMN IF NOT EXISTS numero_factura text,
 ADD COLUMN IF NOT EXISTS estado_pago text,
 ADD COLUMN IF NOT EXISTS proveedor text,
 ADD COLUMN IF NOT EXISTS tipo text,
 ADD COLUMN IF NOT EXISTS metodo_pago text;
NOTIFY pgrst, 'reload schema';
-- Rollback: revert the frontend first. Retain nullable columns to preserve any
-- newly entered payment details. Do not drop populated columns automatically.
