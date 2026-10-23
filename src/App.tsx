import { useEffect, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { useAuthStore } from './store/useAuthStore';
import { useStore } from './store/useStore';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RequireLinea, RequireModulo } from './components/guards/RouteGuards';

const SoundCalendar = lazy(() => import('./pages/lineas/SoundCalendar').then(m => ({default:m.SoundCalendar})));
const DevPreviewLazy = lazy(() => import('./dev/DevPreview').then((m) => ({ default: m.DevPreview })));

// ── Lazy pages ────────────────────────────────────────────────────────────────
const Dashboard       = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const IngresosPage    = lazy(() => import('./pages/shared/IngresosPage').then((m) => ({ default: m.IngresosPage })));
const GastosPage      = lazy(() => import('./pages/shared/GastosPage').then((m) => ({ default: m.GastosPage })));
const GastosEventoPage = lazy(() => import('./pages/shared/GastosEventoPage').then((m) => ({ default: m.GastosEventoPage })));
const BeneficioPage   = lazy(() => import('./pages/shared/BeneficioPage').then((m) => ({ default: m.BeneficioPage })));
const EventosPage     = lazy(() => import('./pages/shared/EventosPage').then((m) => ({ default: m.EventosPage })));
const PresupuestosPage = lazy(() => import('./pages/shared/PresupuestosPage').then(m => ({ default: m.PresupuestosPage })));
const PagosPage       = lazy(() => import('./pages/shared/PagosPage').then((m) => ({ default: m.PagosPage })));
const FacturasAreaPage = lazy(() => import('./pages/shared/FacturasAreaPage').then((m) => ({ default: m.FacturasAreaPage })));
const InversionesPage = lazy(() => import('./pages/shared/InversionesPage').then((m) => ({ default: m.InversionesPage })));
const InformesPage    = lazy(() => import('./pages/shared/InformesPage').then((m) => ({ default: m.InformesPage })));
const RepartoSociosPage = lazy(() => import('./pages/shared/RepartoSociosPage').then((m) => ({ default: m.RepartoSociosPage })));
const InformesContablesPage = lazy(() => import('./pages/contabilidad/InformesContablesPage').then((m) => ({ default: m.InformesContablesPage })));
const PrevisionFiscal = lazy(() => import('./components/impuestos/PrevisionFiscal').then((m) => ({ default: m.PrevisionFiscal })));
const ImpuestosPage   = lazy(() => import('./pages/contabilidad/ImpuestosPage').then((m) => ({ default: m.ImpuestosPage })));
const ResultadosPage = lazy(() => import('./pages/contabilidad/ResultadosPage').then(m=>({default:m.ResultadosPage})));
const AdminUsuarios   = lazy(() => import('./pages/admin/Usuarios').then((m) => ({ default: m.AdminUsuarios })));

const SoundProspects=lazy(()=>import('./pages/lineas/SoundProspects').then(m=>({default:m.SoundProspects})));
const SoundContracts=lazy(()=>import('./pages/lineas/SoundContracts').then(m=>({default:m.SoundContracts})));
const GenerateInvoices=lazy(()=>import('./pages/shared/GenerateInvoices').then(m=>({default:m.GenerateInvoices})));
const SoundCRM = lazy(() => import('./pages/lineas/SoundCRM').then(m => ({default:m.SoundCRM})));
const MontadaSoundResumen = lazy(() => import('./pages/lineas/MontadaSoundResumen').then((m) => ({ default: m.MontadaSoundResumen })));
const DjResumen           = lazy(() => import('./pages/lineas/DjResumen').then((m) => ({ default: m.DjResumen })));
const RealMadridResumen   = lazy(() => import('./pages/lineas/RealMadridResumen').then((m) => ({ default: m.RealMadridResumen })));
const InstallationsResumen     = lazy(() => import('./pages/lineas/installations/InstallationsResumen').then((m) => ({ default: m.InstallationsResumen })));
const InstallationsProyectos   = lazy(() => import('./pages/lineas/installations/InstallationsProyectos').then((m) => ({ default: m.InstallationsProyectos })));
const InstallationsGastos      = lazy(() => import('./pages/lineas/installations/InstallationsGastos').then((m) => ({ default: m.InstallationsGastos })));
const InstallationsInformes    = lazy(() => import('./pages/lineas/installations/InstallationsInformes').then((m) => ({ default: m.InstallationsInformes })));

// ── Pantallas de estado ───────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
    <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
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
      <div className="text-xs text-gray-500 bg-gold-50 border border-gold-200 rounded-lg p-3 text-left space-y-1">
        <p className="font-semibold text-gold-800">Para resolverlo:</p>
        <p>1. Ve a <strong>supabase.com</strong> → tu proyecto → <strong>Settings → API</strong></p>
        <p>2. Copia <strong>Project URL</strong> y <strong>anon key</strong></p>
        <p>3. Pégalos en <code className="bg-gold-100 px-1 rounded">.env.local</code></p>
        <p>4. Reconstruye la app</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-5 py-2 bg-gold-500 text-white text-sm font-semibold rounded-lg hover:bg-gold-400 transition-colors"
      >
        Reintentar
      </button>
    </div>
  </div>
);

const PageLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── Guards ────────────────────────────────────────────────────────────────────
const DataLoader = ({ children }: { children: ReactNode }) => {
  const initData = useStore((s) => s.initData);
  const _loaded  = useStore((s) => s._loaded);
  const _error   = useStore((s) => s._error);
  const profile = useAuthStore(s=>s.profile);

  useEffect(() => { initData(); }, [initData,profile]);

  if (!_loaded) return <LoadingScreen />;
  if (_error)   return <ErrorScreen message={_error} />;
  return <>{children}</>;
};

// Arranca la sesión de Supabase Auth UNA sola vez, al montar la app entera
// (no por ruta) — `init()` hace getSession() + se suscribe a
// onAuthStateChange, y se desuscribe al desmontar. Vive fuera de
// `RequireAuth` para no reiniciar la suscripción en cada navegación.
const AuthGate = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    if (import.meta.env.DEV && window.location.pathname.startsWith('/_dev/preview')) return;
    const unsubscribe = useAuthStore.getState().init();
    return unsubscribe;
  }, []);
  return <>{children}</>;
};

// `status` se comprueba ANTES que `isAuthenticated`: hasta que Supabase
// Auth resuelva si hay sesión (getSession + primer evento de
// onAuthStateChange), no se decide nada — ni se redirige a /login, ni se
// deja pasar, ni se piden datos financieros. Esto sustituye por completo al
// antiguo `_hydrated` de zustand/persist (fuente del bug de TDZ de la Fase
// F) — ahora la única fuente de verdad es Supabase Auth.
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const status = useAuthStore((s) => s.status);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (status === 'loading') return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <DataLoader>{children}</DataLoader>;
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
    <AuthGate>
    <BrowserRouter>
      <ConfirmDialog />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Entorno local de pruebas visuales — SOLO build de desarrollo.
            `import.meta.env.DEV` es una constante estática que Vite resuelve
            en build time: esta rama entera (ruta + import de DevPreview) se
            elimina del bundle de producción, nunca se despliega. No toca
            RequireAuth ni RLS — ver src/dev/DevPreview.tsx. */}
        {import.meta.env.DEV && (
          <Route path="/_dev/preview/*" element={<Suspense fallback={null}><DevPreviewLazy /></Suspense>} />
        )}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout>
                <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route index element={<Dashboard />} />
                      <Route path="lineas/montada-sound/contratos" element={<RequireLinea linea="montada_sound"><SoundContracts/></RequireLinea>}/>
                      <Route path="contabilidad/generar-facturas" element={<Navigate to="/contabilidad/facturas" replace />}/>
                      <Route path="lineas/montada-sound/generar-facturas" element={<RequireLinea linea="montada_sound"><GenerateInvoices linea="montada_sound"/></RequireLinea>}/>
                      <Route path="lineas/installations/generar-facturas" element={<RequireLinea linea="montada_installations"><GenerateInvoices linea="montada_installations"/></RequireLinea>}/>
                      <Route path="lineas/real-madrid/generar-facturas" element={<RequireLinea linea="real_madrid"><GenerateInvoices linea="real_madrid"/></RequireLinea>}/>
                      <Route path="lineas/dj/generar-facturas" element={<RequireLinea linea="dj"><GenerateInvoices linea="dj"/></RequireLinea>}/>
                      <Route path="lineas/montada-sound/presupuestos" element={<RequireLinea linea="montada_sound"><PresupuestosPage key="montada_sound" linea="montada_sound" /></RequireLinea>} />
                      <Route path="lineas/installations/presupuestos" element={<RequireLinea linea="montada_installations"><PresupuestosPage key="montada_installations" linea="montada_installations" /></RequireLinea>} />

                      {/* La Montada Sound — Fase F: acceso por línea (`RequireLinea`), no
                          por AreaKey legado. Cualquier usuario con permiso de línea
                          la ve, no solo admin. */}
                      <Route path="lineas/montada-sound/pagos" element={<RequireLinea linea="montada_sound"><PagosPage key="montada_sound" area="todos" fixedLinea="montada_sound" /></RequireLinea>} />
                      <Route path="lineas/dj/pagos" element={<RequireLinea linea="dj"><PagosPage key="dj" area="todos" fixedLinea="dj" /></RequireLinea>} />
                      <Route path="lineas/real-madrid/pagos" element={<RequireLinea linea="real_madrid"><PagosPage key="real_madrid" area="todos" fixedLinea="real_madrid" /></RequireLinea>} />
                      <Route path="lineas/installations/pagos" element={<RequireLinea linea="montada_installations"><PagosPage key="montada_installations" area="todos" fixedLinea="montada_installations" /></RequireLinea>} />
                      <Route path="lineas/montada-sound" element={<Navigate to="/lineas/montada-sound/resumen" replace />} />
                      <Route path="lineas/montada-sound/crm/:clienteId" element={<RequireLinea linea="montada_sound"><SoundProspects /></RequireLinea>} />
                      <Route path="lineas/montada-sound/crm" element={<RequireLinea linea="montada_sound"><SoundProspects /></RequireLinea>} />
                      <Route path="lineas/montada-sound/clientes" element={<RequireLinea linea="montada_sound"><SoundCRM /></RequireLinea>} />
                      <Route path="lineas/montada-sound/clientes/:clienteId" element={<RequireLinea linea="montada_sound"><SoundCRM /></RequireLinea>} />
                      <Route path="lineas/montada-sound/resumen"        element={<RequireLinea linea="montada_sound"><MontadaSoundResumen /></RequireLinea>} />
                      <Route path="lineas/montada-sound/resultados" element={<RequireLinea linea="montada_sound"><ResultadosPage soundOnly /></RequireLinea>} />
                      <Route path="lineas/montada-sound/calendario" element={<RequireLinea linea="montada_sound"><SoundCalendar/></RequireLinea>} />
                      <Route path="lineas/montada-sound/ingresos"       element={<RequireLinea linea="montada_sound"><IngresosPage area="montada" /></RequireLinea>} />
                      <Route path="lineas/montada-sound/gastos-eventos" element={<RequireLinea linea="montada_sound"><GastosEventoPage area="montada" /></RequireLinea>} />
                      <Route path="lineas/montada-sound/gastos"         element={<RequireLinea linea="montada_sound"><GastosPage area="montada" /></RequireLinea>} />
                      <Route path="lineas/montada-sound/inversiones"    element={<RequireLinea linea="montada_sound"><InversionesPage area="montada" /></RequireLinea>} />
                      <Route path="lineas/montada-sound/informes"       element={<RequireLinea linea="montada_sound"><InformesPage area="montada" /></RequireLinea>} />
                      <Route path="lineas/montada-sound/reparto-socios" element={<RequireLinea linea="montada_sound"><RepartoSociosPage /></RequireLinea>} />

                      {/* DJ */}
                      <Route path="lineas/dj/resumen" element={<RequireLinea linea="dj"><DjResumen /></RequireLinea>} />

                      {/* Real Madrid — comparte area='dj' con DJ, separado siempre
                          mediante resolveLinea/lineaNegocio, nunca mezclado. Ya NO
                          exclusivo de admin: cualquier usuario con permiso de línea
                          "real_madrid" accede. */}
                      <Route path="lineas/real-madrid" element={<Navigate to="/lineas/real-madrid/resumen" replace />} />
                      <Route path="lineas/real-madrid/resumen" element={<RequireLinea linea="real_madrid"><RealMadridResumen /></RequireLinea>} />
                      <Route path="lineas/real-madrid/ingresos" element={<RequireLinea linea="real_madrid">
                        <IngresosPage area="dj" filterLinea="real_madrid" tituloOverride="Ingresos — Real Madrid" />
                      </RequireLinea>} />
                      <Route path="lineas/real-madrid/gastos-actuacion" element={<RequireLinea linea="real_madrid">
                        <GastosEventoPage area="dj" filterLinea="real_madrid" tituloOverride="Gastos de actuación" singularOverride="partido" />
                      </RequireLinea>} />
                      <Route path="lineas/real-madrid/gastos" element={<RequireLinea linea="real_madrid">
                        <GastosPage area="dj" filterLinea="real_madrid" />
                      </RequireLinea>} />
                      <Route path="lineas/real-madrid/inversiones" element={<RequireLinea linea="real_madrid">
                        <InversionesPage area="real_madrid" />
                      </RequireLinea>} />
                      <Route path="lineas/real-madrid/informes" element={<RequireLinea linea="real_madrid">
                        <InformesPage area="dj" filterLinea="real_madrid" tituloLinea="Real Madrid" />
                      </RequireLinea>} />

                      {/* La Montada Installations — nace sin datos. Creación bloqueada
                          de forma segura hasta ejecutar la migración preparada. */}
                      <Route path="lineas/installations" element={<Navigate to="/lineas/installations/resumen" replace />} />
                      <Route path="lineas/installations/resumen" element={<RequireLinea linea="montada_installations"><InstallationsResumen /></RequireLinea>} />
                      <Route path="lineas/installations/ingresos" element={<RequireLinea linea="montada_installations"><InstallationsProyectos /></RequireLinea>} />
                      <Route path="lineas/installations/gastos-instalacion" element={<RequireLinea linea="montada_installations"><InstallationsGastos variant="instalacion" /></RequireLinea>} />
                      <Route path="lineas/installations/gastos" element={<RequireLinea linea="montada_installations"><InstallationsGastos variant="generales" /></RequireLinea>} />
                      <Route path="lineas/installations/reparto-socios" element={<RequireLinea linea="montada_installations"><RepartoSociosPage linea="montada_installations" /></RequireLinea>} />
                      <Route path="lineas/installations/informes" element={<RequireLinea linea="montada_installations"><InstallationsInformes /></RequireLinea>} />

                      {/* Rutas antiguas /montada/* — mismos datos que /lineas/montada-sound/*,
                          ahora protegidas con el mismo guard por línea (antes usaban el
                          AreaKey legado 'montada', que ya no es la fuente de verdad). */}
                      <Route path="montada" element={<Navigate to="/montada/ingresos" replace />} />
                      <Route path="montada/ingresos"       element={<RequireLinea linea="montada_sound"><IngresosPage area="montada" /></RequireLinea>} />
                      <Route path="montada/gastos-eventos" element={<RequireLinea linea="montada_sound"><GastosEventoPage area="montada" /></RequireLinea>} />
                      <Route path="montada/gastos"         element={<RequireLinea linea="montada_sound"><GastosPage area="montada" /></RequireLinea>} />
                      <Route path="montada/beneficio"      element={<RequireLinea linea="montada_sound"><BeneficioPage area="montada" /></RequireLinea>} />
                      <Route path="montada/informes"       element={<RequireLinea linea="montada_sound"><InformesPage area="montada" /></RequireLinea>} />
                      <Route path="montada/reparto-socios" element={<RequireLinea linea="montada_sound"><RepartoSociosPage /></RequireLinea>} />
                      <Route path="montada/eventos"        element={<RequireLinea linea="montada_sound"><EventosPage area="montada" /></RequireLinea>} />
                      <Route path="montada/resumen"        element={<Navigate to="/montada/beneficio" replace />} />

                      {/* DJ — filterLinea='dj' excluye siempre los partidos de Real Madrid,
                          que hoy comparten area='dj' (ver resolveLinea). */}
                      <Route path="dj" element={<Navigate to="/dj/ingresos" replace />} />
                      <Route path="dj/ingresos"         element={<RequireLinea linea="dj"><IngresosPage area="dj" filterLinea="dj" /></RequireLinea>} />
                      <Route path="dj/gastos-actuacion" element={<RequireLinea linea="dj"><GastosEventoPage area="dj" filterLinea="dj" /></RequireLinea>} />
                      <Route path="dj/gastos"           element={<RequireLinea linea="dj"><GastosPage area="dj" filterLinea="dj" /></RequireLinea>} />
                      <Route path="dj/beneficio"        element={<RequireLinea linea="dj"><BeneficioPage area="dj" /></RequireLinea>} />
                      <Route path="dj/informes"         element={<RequireLinea linea="dj"><InformesPage area="dj" filterLinea="dj" /></RequireLinea>} />
                      <Route path="dj/eventos"          element={<RequireLinea linea="dj"><EventosPage area="dj" /></RequireLinea>} />
                      <Route path="dj/resumen"          element={<Navigate to="/dj/beneficio" replace />} />

                      {/* Contabilidad consolidada (Fase E) — protegida por módulo
                          (`RequireModulo`), no por línea: ver Contabilidad es un
                          permiso aparte, independiente de qué líneas vea el usuario.
                          "Inversiones" NO vive aquí — se mantiene solo dentro de
                          cada línea que las tenga. */}
                      <Route path="contabilidad" element={<Navigate to="/contabilidad/facturas" replace />} />
                      <Route path="contabilidad/resumen"          element={<Navigate to="/contabilidad/prevision" replace />} />
                      <Route path="contabilidad/pagos"            element={<RequireModulo modulo="contabilidad"><PagosPage area="todos" defaultTab="porcobrar" /></RequireModulo>} />
                      <Route path="contabilidad/pagos-pendientes" element={<RequireModulo modulo="contabilidad"><PagosPage area="todos" defaultTab="porcobrar" /></RequireModulo>} />
                      <Route path="contabilidad/facturas"    element={<RequireModulo modulo="contabilidad"><FacturasAreaPage area="todos" /></RequireModulo>} />
                      <Route path="contabilidad/clientes"    element={<Navigate to="/contabilidad/facturas" replace />} />
                      <Route path="contabilidad/informes"    element={<RequireModulo modulo="informes"><InformesContablesPage /></RequireModulo>} />
                      <Route path="contabilidad/resultados" element={<RequireModulo modulo="contabilidad"><ResultadosPage /></RequireModulo>} />
                      <Route path="contabilidad/impuestos"   element={<RequireModulo modulo="impuestos"><ImpuestosPage /></RequireModulo>} />
                      <Route path="contabilidad/prevision"   element={<RequireModulo modulo="impuestos"><PrevisionFiscal /></RequireModulo>} />
                      {/* "Inversiones" ya no vive en Contabilidad — redirige a
                          la línea principal que las tiene, para no romper
                          bookmarks/enlaces antiguos. */}
                      <Route path="contabilidad/inversiones" element={<Navigate to="/lineas/montada-sound/inversiones" replace />} />

                      {/* Admin — el módulo "administracion" puede concederse a un
                          usuario no-admin (punto 1 del encargo); las acciones
                          verdaderamente irreversibles (borrar el último admin,
                          tocar los propios permisos) se bloquean dentro de la
                          propia página, no solo aquí. */}
                      <Route path="admin/usuarios" element={<RequireModulo modulo="administracion"><AdminUsuarios /></RequireModulo>} />
                      <Route path="admin/ajustes"  element={<Navigate to="/admin/usuarios" replace />} />
                      <Route path="admin/datos-fiscales" element={<Navigate to="/contabilidad/facturas" replace />} />

                      <Route path="lineas/montada-sound/facturas" element={<Navigate to="/contabilidad/facturas" replace />} />
                      <Route path="lineas/real-madrid/facturas" element={<Navigate to="/contabilidad/facturas" replace />} />
                      <Route path="lineas/installations/facturas" element={<Navigate to="/contabilidad/facturas" replace />} />
                      {/* Rutas antiguas → redirect */}
                      <Route path="montada-sound" element={<Navigate to="/montada/resumen" replace />} />
                      <Route path="dj-personal"   element={<Navigate to="/dj/resumen" replace />} />
                      <Route path="facturas"       element={<Navigate to="/contabilidad/facturas" replace />} />
                      <Route path="equipo"         element={<Navigate to="/lineas/montada-sound/inversiones" replace />} />
                      <Route path="informes"       element={<Navigate to="/montada/informes" replace />} />
                      <Route path="montada/pagos"       element={<Navigate to="/contabilidad/pagos" replace />} />
                      <Route path="montada/facturas"    element={<Navigate to="/contabilidad/facturas" replace />} />
                      <Route path="montada/inversiones" element={<Navigate to="/lineas/montada-sound/inversiones" replace />} />
                      <Route path="dj/pagos"       element={<Navigate to="/contabilidad/pagos" replace />} />
                      <Route path="dj/facturas" element={<Navigate to="/contabilidad/facturas" replace />} />
                      <Route path="dj/inversiones" element={<Navigate to="/lineas/dj/resumen" replace />} />

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
    </AuthGate>
    </MotionConfig>
  );
}
