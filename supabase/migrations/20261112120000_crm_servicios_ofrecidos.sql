-- CRM La Montada: qué servicios pide cada contacto (casino, DJ, pack…), para
-- saber qué se solicita más. Aditivo: no toca datos existentes.
alter table public.sound_leads
  add column if not exists servicios_ofrecidos text[] not null default '{}';
