// ── Entorno local de pruebas visuales — SOLO DESARROLLO ─────────────────────
// Objetivo: poder ver y hacer capturas de las pantallas internas (Dashboard,
// Ingresos, Facturas, Administración…) sin credenciales reales de producción
// y sin tocar el auth real de ninguna forma.
//
// Por qué es seguro:
//  - Este archivo entero se monta desde una única ruta (`/_dev/preview/*`)
//    registrada en App.tsx dentro de un `if (import.meta.env.DEV)` — Vite
//    elimina esa rama del bundle de producción (dead-code elimination sobre
//    una condición estática), así que ni la ruta ni este código existen en
//    el build que se despliega.
//  - NO modifica `RequireAuth`, ni RLS, ni ningún guard real — usa las
//    MISMAS acciones públicas de los stores (`useAuthStore.setState`,
//    `useStore.setState`) que ya usa el flujo de login real, solo que con
//    datos ficticios en vez de una sesión de Supabase. Fuera de esta ruta,
//    la app real sigue exigiendo login real exactamente igual.
//  - Todos los datos son inventados (ver `fixtures.ts`), nunca reales.
import { useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { Layout } from '../components/layout/Layout';
import { Dashboard } from '../pages/Dashboard';
import { IngresosPage } from '../pages/shared/IngresosPage';
import { GastosPage } from '../pages/shared/GastosPage';
import { FacturasAreaPage } from '../pages/shared/FacturasAreaPage';
import { AdminDatosFiscales } from '../pages/admin/DatosFiscales';
import { ResumenContablePage } from '../pages/contabilidad/ResumenContablePage';
import { ImpuestosPage } from '../pages/contabilidad/ImpuestosPage';
import { InversionesPage } from '../pages/shared/InversionesPage';
import { RepartoSociosPage } from '../pages/shared/RepartoSociosPage';
import { ClientesPage } from '../pages/shared/ClientesPage';
import { ALL_PERMS_MODULOS, ALL_PERMS_FACTURACION } from '../types';
import {
  fixtureIngresos, fixtureGastos, fixtureFacturas, fixtureClientes,
  fixtureEmisores, fixtureProyectoEmisorMap, fixtureEventos, FIXTURE_PERMISOS_LINEAS,
} from './fixtures';

function seedFixtures() {
  useAuthStore.setState({
    status: 'ready',
    isAuthenticated: true,
    profile: {
      id: 'fx-admin', email: 'demo@ejemplo.com', nombre: 'Usuaria de prueba',
      rol: 'admin', activo: true,
      permisosLineas: FIXTURE_PERMISOS_LINEAS,
      permisosModulos: ALL_PERMS_MODULOS,
      permisosFacturacion: ALL_PERMS_FACTURACION,
    },
    user: {
      id: 'fx-admin', email: 'demo@ejemplo.com', nombre: 'Usuaria de prueba',
      rol: 'admin', activo: true,
      permisosLineas: FIXTURE_PERMISOS_LINEAS,
      permisosModulos: ALL_PERMS_MODULOS,
      permisosFacturacion: ALL_PERMS_FACTURACION,
    },
  });
  useStore.setState({
    eventos: fixtureEventos, ingresos: fixtureIngresos, gastos: fixtureGastos,
    suplidos: [], facturas: fixtureFacturas, equipo: [], gastosEvento: [], pagosEvento: [],
    documentos: [], usuarios: [], socios: [], movimientosSocios: [], impuestos: [],
    clientes: fixtureClientes, emisores: fixtureEmisores, proyectoEmisorMap: fixtureProyectoEmisorMap,
    permisosFacturacion: { 'fx-admin': ALL_PERMS_FACTURACION },
    _loaded: true, _error: null,
  });
}

const Menu = () => (
  <div className="max-w-lg mx-auto py-16 px-6 space-y-4">
    <h1 className="text-xl font-bold text-gray-900">Entorno de pruebas visuales</h1>
    <p className="text-sm text-gray-500">Solo en desarrollo — datos ficticios, no toca producción ni Auth real.</p>
    <div className="flex flex-col gap-2 pt-2">
      <Link className="text-accent-600 hover:underline" to="/_dev/preview/dashboard">Dashboard</Link>
      <Link className="text-accent-600 hover:underline" to="/_dev/preview/ingresos">Ingresos</Link>
      <Link className="text-accent-600 hover:underline" to="/_dev/preview/gastos">Gastos</Link>
      <Link className="text-accent-600 hover:underline" to="/_dev/preview/facturas">Facturas</Link>
      <Link className="text-accent-600 hover:underline" to="/_dev/preview/contabilidad">Contabilidad</Link>
      <Link className="text-accent-600 hover:underline" to="/_dev/preview/impuestos">Impuestos</Link>
      <Link className="text-accent-600 hover:underline" to="/_dev/preview/inversiones">Inversiones</Link>
      <Link className="text-accent-600 hover:underline" to="/_dev/preview/socios">Socios</Link>
      <Link className="text-accent-600 hover:underline" to="/_dev/preview/clientes">Clientes</Link>
      <Link className="text-accent-600 hover:underline" to="/_dev/preview/admin">Administración → Emisores fiscales</Link>
    </div>
  </div>
);

export function DevPreview() {
  const navigate = useNavigate();
  useEffect(() => {
    seedFixtures();
    return () => { useAuthStore.setState({profile:null,user:null,session:null,isAuthenticated:false,status:'ready'}); };
  }, []);
  void navigate;
  return (
    <Routes>
      <Route index element={<Menu />} />
      <Route path="dashboard" element={<Layout><Dashboard /></Layout>} />
      <Route path="ingresos" element={<Layout><IngresosPage area="montada" /></Layout>} />
      <Route path="gastos" element={<Layout><GastosPage area="montada" /></Layout>} />
      <Route path="facturas" element={<Layout><FacturasAreaPage area="todos" /></Layout>} />
      <Route path="contabilidad" element={<Layout><ResumenContablePage /></Layout>} />
      <Route path="impuestos" element={<Layout><ImpuestosPage /></Layout>} />
      <Route path="inversiones" element={<Layout><InversionesPage area="montada" /></Layout>} />
      <Route path="socios" element={<Layout><RepartoSociosPage /></Layout>} />
      <Route path="clientes" element={<Layout><ClientesPage /></Layout>} />
      <Route path="admin" element={<Layout><AdminDatosFiscales /></Layout>} />
    </Routes>
  );
}
