alter table public.facturas add column if not exists datos_cliente_borrador jsonb;
comment on column public.facturas.datos_cliente_borrador is 'Datos fiscales editables del borrador; cliente_snapshot se fija exclusivamente al emitir.';
