import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { supabaseConfigured } from '../lib/supabase';
import { BrandMark } from '../components/ui/BrandMark';

export const Login = () => {
  const status = useAuthStore((s) => s.status);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Mientras Supabase Auth resuelve si ya hay sesión, no se decide nada —
  // ni se muestra el formulario, ni se redirige. Evita un parpadeo del
  // formulario de login para alguien que en realidad ya tiene sesión.
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if(!supabaseConfigured){setError('Falta conectar la base de datos financiera.');setLoading(false);return;}
    const result = await login(email, password);
    if (result.ok) {
      navigate('/');
    } else {
      setError(result.error ?? 'Email o contraseña incorrectos.');
      setLoading(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if(!supabaseConfigured){setError('Falta conectar la base de datos financiera.');setLoading(false);return;}
    const result = await requestPasswordReset(email);
    setLoading(false);
    if (result.ok) setResetSent(true);
    else setError(result.error ?? 'No se pudo enviar el correo.');
  };

  return (
    <div className="finance-auth min-h-screen bg-white flex items-center justify-center p-4">
      <aside className="finance-auth-intro"><div className="finance-auth-wordmark">LA MONTADA<span>MI ESPACIO</span></div><div><p>Menos vueltas.<br/>Más perspectiva.</p><span>Clientes, proyectos y finanzas.<br/>Todo en un mismo lugar.</span></div><div className="finance-auth-orbit" aria-hidden="true"><i/><i/><i/></div></aside>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm space-y-6"
      >
        {/* Símbolo propio — sin relación con ningún proyecto ni marca externa */}
        <div className="flex flex-col items-center gap-3">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
            className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-raised text-accent-500"
          >
            <BrandMark size={26} />
          </motion.div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Mi espacio</h1>
            <p className="text-sm text-gray-500 mt-0.5">Área privada</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-card shadow-card p-8">
          {!supabaseConfigured && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">La conexión de esta copia todavía no está configurada.</p>}
          {mode === 'login' ? (
            <>
              <h2 className="text-base font-semibold text-gray-900 mb-5">Iniciar sesión</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-gray-900 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/10 transition-colors"
                      placeholder="usuario@ejemplo.com"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-gray-600 block">Contraseña</label>
                    <button type="button" onClick={() => { setMode('reset'); setError(''); }} className="text-xs text-gold-600 hover:text-gold-500 font-medium transition-colors">
                      ¿La olvidaste?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-10 py-2.5 text-gray-900 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/10 transition-colors"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gold-500 hover:bg-gold-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                >
                  {loading ? 'Verificando...' : 'Entrar'}
                </button>
              </form>
            </>
          ) : (
            <>
              <button onClick={() => { setMode('login'); setError(''); setResetSent(false); }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-4">
                <ArrowLeft size={12} /> Volver a iniciar sesión
              </button>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Recuperar contraseña</h2>
              {resetSent ? (
                <div className="flex flex-col items-center text-center gap-2 py-4">
                  <CheckCircle2 size={28} className="text-accent-500" />
                  <p className="text-sm text-gray-700">Si existe una cuenta con ese email, te hemos enviado un enlace para restablecer la contraseña.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-4">Te enviaremos un enlace para establecer una contraseña nueva.</p>
                  <form onSubmit={handleReset} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email</label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoComplete="email"
                          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-gray-900 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/10 transition-colors"
                          placeholder="usuario@ejemplo.com"
                        />
                      </div>
                    </div>
                    {error && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                    )}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gold-500 hover:bg-gold-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                    >
                      {loading ? 'Enviando…' : 'Enviar enlace'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          Acceso restringido · Solo usuarios autorizados
        </p>
      </motion.div>
    </div>
  );
};
