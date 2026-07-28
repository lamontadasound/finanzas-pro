import { useEffect, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { useAuthStore } from './store/useAuthStore';
import { useStore } from './store/useStore';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { AreaKey } from './types';

// ── Lazy pages ────────────────────────────────────────────────────────────────
const Dashboard       = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const IngresosPage    = lazy(() => import('./pages/shared/IngresosPage').then((m) => ({ default: m.IngresosPage })));
const GastosPage      = lazy(() => import('./pages/shared/GastosPage').then((m) => ({ default: m.GastosPage })));
const GastosEventoPage = lazy(() => import('./pages/shared/GastosEventoPage').then((m) => ({ default: m.GastosEventoPage })));
const BeneficioPage   = lazy(() => import('./pages/shared/BeneficioPage').then((m) => ({ default: m.BeneficioPage })));
const EventosPage     = lazy(() => import('./pages/shared/EventosPage').then((m) => ({ default: m.EventosPage })));
const PagosPage       = lazy(() => import('./pages/shared/PagosPage').then((m) => ({ default: m.PagosPage })));
const FacturasAreaPage = lazy(() => import('./pages/shared/FacturasAreaPage').then((m) => ({ default: m.FacturasAreaPage })));
const InversionesPage = lazy(() => import('./pages/shared/InversionesPage').then((m) => ({ default: m.InversionesPage })));
const InformesPage    = lazy(() => import('./pages/shared/InformesPage').then((m) => ({ default: m.InformesPage })));
const RepartoSociosPage = lazy(() => import('./pages/shared/RepartoSociosPage').then((m) => ({ default: m.RepartoSociosPage })));
const InformesContablesPage = lazy(() => import('./pages/contabilidad/InformesContablesPage').then((m) => ({ default: m.InformesContablesPage })));
const AdminUsuarios   = lazy(() => import('./pages/admin/Usuarios').then((m) => ({ default: m.AdminUsuarios })));
const AdminAjustes    = lazy(() => import('./pages/admin/Ajustes').then((m) => ({ default: m.AdminAjustes })));

// ── Pantallas de estado ───────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    <p className="text-gray-500 text-sm">Cargando datos…</p>
  </div>
);

const ErrorScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-8">
    <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-lg w-full text-center space-y-3 shadow-sm">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
        <span className="text-red-500 text-xl">⚠</span>
      </div>
      <p className="text-red-600 font-semibold text-base">Error de conexión con Supabase</p>
      <p className="text-xs text-gray-500 font-mono bg-gray-50 rounded-lg p-3 break-all text-left">{message}</p>
      <div className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-3 text-left space-y-1">
        <p className="font-semibold text-amber-800">Para resolverlo:</p>
        <p>1. Ve a <strong>supabase.com</strong> → tu proyecto → <strong>Settings → API</strong></p>
        <p>2. Copia <strong>Project URL</strong> y <strong>anon key</strong></p>
        <p>3. Pégalos en <code className="bg-amber-100 px-1 rounded">.env.local</code></p>
        <p>4. Reconstruye la app</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-5 py-2 bg-amber-500 text-black text-sm font-semibold rounded-lg hover:bg-amber-400 transition-colors"
      >
        Reintentar
      </button>
    </div>
  </div>
);

const PageLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── Guards ────────────────────────────────────────────────────────────────────
const DataLoader = ({ children }: { children: ReactNode }) => {
  const initData = useStore((s) => s.initData);
  const _loaded  = useStore((s) => s._loaded);
  const _error   = useStore((s) => s._error);

  useEffect(() => { initData(); }, [initData]);

  if (!_loaded) return <LoadingScreen />;
  if (_error)   return <ErrorScreen message={_error} />;
  return <>{children}</>;
};

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <DataLoader>{children}</DataLoader>;
};

const RequirePerm = ({ area, children }: { area: AreaKey; children: ReactNode }) => {
  const canView = useAuthStore((s) => s.canView);
  if (!canView(area)) return (
    <div className="py-16 text-center">
      <p className="text-gray-400 text-sm">No tienes acceso a este apartado.</p>
    </div>
  );
  return <>{children}</>;
};

const RequireAdmin = ({ children }: { children: ReactNode }) => {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  if (!isAdmin()) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// ── App ───────────────────────────────────────────────────────────────────────
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
                <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route index element={<Dashboard />} />

                      {/* La Montada Sound */}
                      <Route path="montada" element={<Navigate to="/montada/ingresos" replace />} />
                      <Route path="montada/ingresos"       element={<RequirePerm area="montada"><IngresosPage area="montada" /></RequirePerm>} />
                      <Route path="montada/gastos-eventos" element={<RequirePerm area="montada"><GastosEventoPage area="montada" /></RequirePerm>} />
                      <Route path="montada/gastos"         element={<RequirePerm area="montada"><GastosPage area="montada" /></RequirePerm>} />
                      <Route path="montada/beneficio"      element={<RequirePerm area="montada"><BeneficioPage area="montada" /></RequirePerm>} />
                      <Route path="montada/informes"       element={<RequirePerm area="informes"><InformesPage area="montada" /></RequirePerm>} />
                      <Route path="montada/reparto-socios" element={<RequirePerm area="montada"><RepartoSociosPage /></RequirePerm>} />
                      {/* Eventos (agenda) — ya no está en el menú principal, se mantiene accesible para gestionar la agenda de eventos */}
                      <Route path="montada/eventos"        element={<RequirePerm area="montada"><EventosPage area="montada" /></RequirePerm>} />
                      {/* Resumen eliminado del menú — redirige a Beneficio */}
                      <Route path="montada/resumen"        element={<Navigate to="/montada/beneficio" replace />} />

                      {/* DJ Personal */}
                      <Route path="dj" element={<Navigate to="/dj/ingresos" replace />} />
                      <Route path="dj/ingresos"         element={<RequirePerm area="dj"><IngresosPage area="dj" /></RequirePerm>} />
                      <Route path="dj/gastos-actuacion" element={<RequirePerm area="dj"><GastosEventoPage area="dj" /></RequirePerm>} />
                      <Route path="dj/gastos"           element={<RequirePerm area="dj"><GastosPage area="dj" /></RequirePerm>} />
                      <Route path="dj/beneficio"        element={<RequirePerm area="dj"><BeneficioPage area="dj" /></RequirePerm>} />
                      <Route path="dj/informes"         element={<RequirePerm area="informes"><InformesPage area="dj" /></RequirePerm>} />
                      {/* Actuaciones (agenda) — ya no está en el menú principal */}
                      <Route path="dj/eventos"          element={<RequirePerm area="dj"><EventosPage area="dj" /></RequirePerm>} />
                      {/* Resumen eliminado del menú — redirige a Beneficio */}
                      <Route path="dj/resumen"          element={<Navigate to="/dj/beneficio" replace />} />

                      {/* Contabilidad (conjunta La Montada + DJ) */}
                      <Route path="contabilidad" element={<Navigate to="/contabilidad/pagos" replace />} />
                      <Route path="contabilidad/pagos"       element={<RequirePerm area="pagos"><PagosPage area="todos" /></RequirePerm>} />
                      <Route path="contabilidad/facturas"    element={<RequirePerm area="facturas"><FacturasAreaPage area="todos" /></RequirePerm>} />
                      <Route path="contabilidad/inversiones" element={<RequirePerm area="inversiones"><InversionesPage area="todos" /></RequirePerm>} />
                      <Route path="contabilidad/informes"    element={<RequirePerm area="informes"><InformesContablesPage /></RequirePerm>} />

                      {/* Admin */}
                      <Route path="admin/usuarios" element={<RequireAdmin><AdminUsuarios /></RequireAdmin>} />
                      <Route path="admin/ajustes"  element={<RequireAdmin><AdminAjustes /></RequireAdmin>} />

                      {/* Rutas antiguas → redirect */}
                      <Route path="montada-sound" element={<Navigate to="/montada/resumen" replace />} />
                      <Route path="dj-personal"   element={<Navigate to="/dj/resumen" replace />} />
                      <Route path="facturas"       element={<Navigate to="/contabilidad/facturas" replace />} />
                      <Route path="equipo"         element={<Navigate to="/contabilidad/inversiones" replace />} />
                      <Route path="informes"       element={<Navigate to="/montada/informes" replace />} />
                      <Route path="montada/pagos"       element={<Navigate to="/contabilidad/pagos" replace />} />
                      <Route path="montada/facturas"    element={<Navigate to="/contabilidad/facturas" replace />} />
                      <Route path="montada/inversiones" element={<Navigate to="/contabilidad/inversiones" replace />} />
                      <Route path="dj/pagos"       element={<Navigate to="/contabilidad/pagos" replace />} />
                      <Route path="dj/facturas"    element={<Navigate to="/contabilidad/facturas" replace />} />
                      <Route path="dj/inversiones" element={<Navigate to="/contabilidad/inversiones" replace />} />

                      {/* Fallback visible en vez de página en blanco */}
                      <Route path="*" element={
                        <div className="py-16 text-center">
                          <p className="text-gray-500 font-medium">Página no encontrada</p>
                          <p className="text-gray-400 text-sm mt-1">La ruta solicitada no existe.</p>
                        </div>
                      } />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
