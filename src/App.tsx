import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { MontadaSound } from './pages/MontadaSound';
import { DJPersonal } from './pages/DJPersonal';
import { Facturas } from './pages/Facturas';
import { Equipo } from './pages/Equipo';
import { Informes } from './pages/Informes';
import { Login } from './pages/Login';
import { useAuthStore } from './store/useAuthStore';
import { useStore } from './store/useStore';
import { ConfirmDialog } from './components/ui/ConfirmDialog';

// ── Pantalla de carga ────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center gap-4">
    <div className="w-10 h-10 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
    <p className="text-zinc-500 text-sm">Cargando datos…</p>
  </div>
);

// ── Pantalla de error de conexión ────────────────────────────────────────────
const ErrorScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center gap-4 p-8">
    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 max-w-md w-full text-center space-y-3">
      <p className="text-red-400 font-semibold">Error de conexión con Supabase</p>
      <p className="text-xs text-zinc-500 font-mono break-all">{message}</p>
      <p className="text-xs text-zinc-600">
        Verifica que <code className="bg-zinc-800 px-1 rounded">VITE_SUPABASE_URL</code> y{' '}
        <code className="bg-zinc-800 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> están configuradas.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400"
      >
        Reintentar
      </button>
    </div>
  </div>
);

// ── Carga de datos desde Supabase ────────────────────────────────────────────
const DataLoader = ({ children }: { children: ReactNode }) => {
  const initData = useStore((s) => s.initData);
  const _loaded  = useStore((s) => s._loaded);
  const _error   = useStore((s) => s._error);

  useEffect(() => {
    initData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!_loaded) return <LoadingScreen />;
  if (_error)   return <ErrorScreen message={_error} />;
  return <>{children}</>;
};

// ── Guard de autenticación ───────────────────────────────────────────────────
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <DataLoader>{children}</DataLoader>;
};

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <ConfirmDialog />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout>
                <Routes>
                  <Route path="/"         element={<Dashboard />} />
                  <Route path="/montada"  element={<MontadaSound />} />
                  <Route path="/dj"       element={<DJPersonal />} />
                  <Route path="/facturas" element={<Facturas />} />
                  <Route path="/equipo"   element={<Equipo />} />
                  <Route path="/informes" element={<Informes />} />
                </Routes>
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
