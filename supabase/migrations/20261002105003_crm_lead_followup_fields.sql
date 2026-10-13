alter table public.sound_leads
add column if not exists fecha_evento date,
add column if not exists calidad text check (calidad in ('alta','media','baja')),
add column if not exists primer_contacto date,
add column if not exists ultimo_contacto date,
add column if not exists siguiente_contacto date,
add column if not exists reserva_estado text check (reserva_estado in ('pendiente','reservado','firmado')),
add column if not exists reserva_importe numeric(12,2) check (reserva_importe>=0),
add column if not exists precio_acordado numeric(12,2) check (precio_acordado>=0);
