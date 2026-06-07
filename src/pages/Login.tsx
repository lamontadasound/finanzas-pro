import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { DollarSign, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const Login = () => {
  const { isAuthenticated, login } = useAuthStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState('');

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      if (login(email, password)) {
        navigate('/');
      } else {
        setError('Email o contraseña incorrectos.');
        setLoading(false);
      }
    }, 300);
  };

  const handleReset = (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (resetEmail === import.meta.env.VITE_ADMIN_EMAIL) {
      setResetDone(true);
    } else {
      setResetError('No existe ninguna cuenta con ese email.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gold-500 flex items-center justify-center shadow-lg shadow-gold-500/20">
            <DollarSign size={28} className="text-black" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Finanzas Pro</h1>
            <p className="text-sm text-zinc-500 mt-0.5">La Montada Sound · Área privada</p>
          </div>
        </div>

        <div className="bg-surface-800 border border-surface-400/20 rounded-2xl p-8 shadow-2xl">
          {!showReset ? (
            <>
              <h2 className="text-lg font-semibold text-white mb-6">Iniciar sesión</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block font-medium">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full bg-surface-700 border border-surface-400/30 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm outline-none focus:border-gold-500/60 transition-colors"
                      placeholder="admin@ejemplo.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block font-medium">Contraseña</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full bg-surface-700 border border-surface-400/30 rounded-lg pl-9 pr-10 py-2.5 text-white text-sm outline-none focus:border-gold-500/60 transition-colors"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gold-500 text-black font-semibold py-2.5 rounded-lg hover:bg-gold-400 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? 'Verificando...' : 'Entrar'}
                </button>
              </form>

              <button
                onClick={() => { setShowReset(true); setError(''); }}
                className="w-full mt-5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-center"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-2">Recuperar contraseña</h2>

              {!resetDone ? (
                <>
                  <p className="text-sm text-zinc-500 mb-6">
                    Introduce tu email de administrador para ver las instrucciones de recuperación.
                  </p>
                  <form onSubmit={handleReset} className="space-y-4">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1.5 block font-medium">Email</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                          className="w-full bg-surface-700 border border-surface-400/30 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm outline-none focus:border-gold-500/60"
                          placeholder="admin@ejemplo.com"
                        />
                      </div>
                    </div>
                    {resetError && (
                      <p className="text-xs text-red-400">{resetError}</p>
                    )}
                    <button
                      type="submit"
                      className="w-full bg-gold-500 text-black font-semibold py-2.5 rounded-lg hover:bg-gold-400 transition-colors text-sm"
                    >
                      Verificar
                    </button>
                  </form>
                </>
              ) : (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium text-blue-300">Instrucciones de recuperación</p>
                  <p className="text-xs text-blue-400 leading-relaxed">
                    Para restablecer tu contraseña, edita el archivo{' '}
                    <code className="bg-blue-500/20 px-1 rounded font-mono">.env.local</code>{' '}
                    en el servidor y actualiza el valor de{' '}
                    <code className="bg-blue-500/20 px-1 rounded font-mono">VITE_ADMIN_PASSWORD</code>.
                    Después vuelve a publicar la aplicación con{' '}
                    <code className="bg-blue-500/20 px-1 rounded font-mono">npm run build</code>.
                  </p>
                </div>
              )}

              <button
                onClick={() => { setShowReset(false); setResetDone(false); setResetError(''); }}
                className="w-full mt-5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-center"
              >
                ← Volver al inicio de sesión
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-zinc-700">
          Acceso restringido · Solo administrador
        </p>
      </div>
    </div>
  );
};
