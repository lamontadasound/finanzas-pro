import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { BrandMark } from '../components/ui/BrandMark';

// ── Restablecer contraseña — destino del enlace de recuperación ─────────────
// Al pulsar el enlace del correo, Supabase Auth ya deja al navegador con una
// sesión de recuperación temporal (vía el hash de la URL, gestionado por el
// propio SDK) — esta pantalla NUNCA ve ni pide la contraseña anterior, solo
// llama a `supabase.auth.updateUser({ password })` para fijar la nueva.
export const ResetPassword = () => {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // El SDK procesa el token de recuperación de la URL y emite un evento
    // PASSWORD_RECOVERY — hasta que eso ocurra (o getSession confirme una
    // sesión), no se muestra el formulario.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') { setReady(true); setChecked(true); }
    });
    supabase.auth.getSession().then(({ data }) => { setReady(!!data.session); setChecked(true); }).catch(() => { setChecked(true); });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !ready) return;
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateErr) { setError('No se pudo actualizar la contraseña. Pide un nuevo enlace.'); return; }
    setDone(true);
    setTimeout(() => navigate('/'), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-raised text-accent-500">
            <BrandMark size={26} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Nueva contraseña</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-card shadow-card p-8">
          {!ready ? (
            <div className="flex flex-col items-center gap-2 py-6">
              {!checked && <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />}
              <p className="text-sm text-gray-500">{checked ? 'El enlace ha caducado o no es válido. Solicita uno nuevo desde el inicio de sesión.' : 'Comprobando el enlace…'}</p>
              {checked && <button className="text-accent-600 py-3" onClick={()=>navigate('/login')}>Volver al inicio de sesión</button>}
            </div>
          ) : done ? (
            <div className="flex flex-col items-center text-center gap-2 py-4">
              <CheckCircle2 size={28} className="text-accent-500" />
              <p className="text-sm text-gray-700">Contraseña actualizada. Entrando…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nueva contraseña</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-gray-900 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/10 transition-colors" placeholder="Mínimo 8 caracteres" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Repite la contraseña</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-gray-900 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/10 transition-colors" />
                </div>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-gold-500 hover:bg-gold-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-1">
                {loading ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
