import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Zap } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const Login = () => {
  const { isAuthenticated, login } = useAuthStore();
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (result.ok) {
      navigate('/');
    } else {
      setError(result.error ?? 'Email o contraseña incorrectos.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Zap size={26} className="text-black" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Finanzas Pro</h1>
            <p className="text-sm text-gray-500 mt-0.5">La Montada Sound · Área privada</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Iniciar sesión</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email o usuario</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-gray-900 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Contraseña</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-10 py-2.5 text-gray-900 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-colors"
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
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400">
          Acceso restringido · Solo usuarios autorizados
        </p>
      </div>
    </div>
  );
};
