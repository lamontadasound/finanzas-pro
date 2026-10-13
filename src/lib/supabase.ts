import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabaseConfigured = !!url && !!key;

if (!supabaseConfigured && !import.meta.env.DEV && !import.meta.env.MODE.includes('test')) {
  console.error(
    '[Supabase] Faltan variables de entorno: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.\n' +
    'Añádelas en .env.local y reinicia el servidor de desarrollo.'
  );
}

// Once this page enters preview, keep all backend traffic blocked until a full reload.
let isolatedPreview = import.meta.env.DEV && typeof window !== 'undefined' && window.location.pathname.startsWith('/_dev/preview');

export const supabase = createClient(url || 'http://127.0.0.1:54321', key || 'not-configured', {
  global: { fetch: (input, init) => {
    if (import.meta.env.DEV && typeof window !== 'undefined' && window.location.pathname.startsWith('/_dev/preview')) isolatedPreview = true;
    if (isolatedPreview) {
      return Promise.reject(new Error('Vista de prueba: no se conecta con datos reales.'));
    }
    return fetch(input, init);
  } },
});
