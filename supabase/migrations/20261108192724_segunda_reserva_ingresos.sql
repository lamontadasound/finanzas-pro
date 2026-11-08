-- Solo añade campos: la primera reserva y sus datos históricos no se modifican.
ALTER TABLE public.ingresos
  ADD COLUMN numero_reservas smallint NOT NULL DEFAULT 1 CHECK (numero_reservas IN (1, 2)),
  ADD COLUMN reserva_2 numeric(12,2) NOT NULL DEFAULT 0 CHECK (reserva_2 >= 0),
  ADD COLUMN fecha_cobro_reserva_2 text,
  ADD COLUMN metodo_pago_reserva_2 text,
  ADD COLUMN reserva_2_incluye_iva boolean;
-- Se mantienen los permisos y las políticas RLS existentes de ingresos.
