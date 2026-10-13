import { Lock } from 'lucide-react';

// ── Bloqueo seguro de creación mientras no exista un campo propio ──────────
// La Montada Installations no tiene todavía ningún sitio seguro donde vivir
// en Supabase (no comparte `area` con montada/dj sin inventar un valor que
// el resto de la app no entendería, y `linea_negocio` aún no se ha migrado).
// En vez de forzar el dato en un campo incorrecto, se bloquea la creación y
// se explica por qué — la arquitectura (rutas, formularios, tablas) ya está
// lista para funcionar en cuanto se autorice y ejecute la migración
// preparada en supabase/migrations/20260906_001_linea_negocio.sql.
export const MigrationRequiredNotice = ({ action }: { action: string }) => (
  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3 text-sm text-amber-800">
    <Lock size={16} className="flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-medium">{action} está bloqueado de forma segura</p>
      <p className="mt-0.5 text-amber-700">
        La Montada Installations todavía no tiene una columna propia en Supabase para guardar sus datos sin mezclarlos con otra línea.
        La migración que la crea ya está preparada (<code className="bg-white/60 px-1 rounded">linea_negocio</code>), pero no se ejecutará hasta que la autorices.
      </p>
    </div>
  </div>
);
