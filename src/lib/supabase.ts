import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error(
    '[Supabase] Faltan variables de entorno: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.\n' +
    'Añádelas en .env.local y reinicia el servidor de desarrollo.'
  );
}

export const supabase = createClient(url ?? '', key ?? '');
