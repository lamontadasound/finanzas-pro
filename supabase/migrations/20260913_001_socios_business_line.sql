ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS linea_negocio text NOT NULL DEFAULT 'montada_sound' CHECK (linea_negocio IN ('montada_sound','montada_installations'));
