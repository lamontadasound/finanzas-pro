import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Wallet, Calendar, CreditCard,
  Receipt, Package, BarChart3, Building2, Music2,
  Users, Settings, LogOut, Menu, X, FileText, HardDrive, Landmark,
} from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';

// ── Subnav items ──────────────────────────────────────────────────────────────

const SUB_MONTADA = [
  { to: '/montada/ingresos',       label: 'Ingresos de eventos',  icon: TrendingUp },
  { to: '/montada/gastos-eventos', label: 'Gastos de eventos',    icon: Calendar },
  { to: '/montada/gastos',         label: 'Gastos generales',     icon: Wallet },
  { to: '/montada/beneficio',      label: 'Beneficio',            icon: BarChart3 },
  { to: '/montada/informes',       label: 'Informes',             icon: FileText },
  { to: '/montada/reparto-socios', label: 'Reparto socios',       icon: Users },
];

const SUB_DJ = [
  { to: '/dj/ingresos',         label: 'Ingresos de actuaciones', icon: TrendingUp },
  { to: '/dj/gastos-actuacion', label: 'Gastos de actuación',     icon: Calendar },
  { to: '/dj/gastos',           label: 'Gastos',                  icon: Wallet },
  { to: '/dj/beneficio',        label: 'Beneficio',               icon: BarChart3 },
  { to: '/dj/informes',         label: 'Informes',                icon: FileText },
];

const SUB_CONTABILIDAD = [
  { to: '/contabilidad/pagos',       label: 'Pagos recibidos',    icon: CreditCard,  perm: 'pagos' as const },
  { to: '/contabilidad/facturas',    label: 'Facturas',           icon: Receipt,     perm: 'facturas' as const },
  { to: '/contabilidad/inversiones', label: 'Inversiones',        icon: Package,     perm: 'inversiones' as const },
  { to: '/contabilidad/informes',    label: 'Informes contables', icon: BarChart3,   perm: 'informes' as const },
  { to: '/contabilidad/impuestos',   label: 'Impuestos',          icon: Landmark,    perm: 'impuestos' as const },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateBackup = () => {
  const s = useStore.getState();
  const blob = new Blob(
    [JSON.stringify({
      version: '4',
      exportedAt: new Date().toISOString(),
      data: { eventos: s.eventos, ingresos: s.ingresos, gastos: s.gastos, suplidos: s.suplidos, facturas: s.facturas, equipo: s.equipo },
    }, null, 2)],
    { type: 'application/json' },
  );
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `finanzas-backup-${new Date().toISOString().slice(0, 10)}.json`,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// ── Sub-link ──────────────────────────────────────────────────────────────────

const SubLink = ({ to, label, icon: Icon, onClick }: {
  to: string; label: string; icon: typeof LayoutDashboard; onClick?: () => void;
}) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      clsx(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
        isActive
          ? 'bg-amber-500/15 text-amber-400 font-semibold'
          : 'text-gray-400 hover:text-white hover:bg-white/5',
      )
    }
  >
    <Icon size={14} className="flex-shrink-0" />
    <span className="truncate">{label}</span>
  </NavLink>
);

// ── Section header (no colapsable) ────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, label, color }: {
  icon: typeof Building2; label: string; color: string;
}) => (
  <div className="flex items-center gap-2 px-3 pt-1 pb-1.5">
    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon size={11} className="text-black" />
    </div>
    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest truncate">{label}</span>
  </div>
);

// ── Nav content ───────────────────────────────────────────────────────────────

const NavContent = ({ onClose }: { onClose?: () => void }) => {
  const { logout, isAdmin, canView, user } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };
  const close = () => onClose?.();

  const showMontada = canView('montada');
  const showDj      = canView('dj');
  const showAdmin   = isAdmin();
  const contabilidadItems = SUB_CONTABILIDAD.filter((item) => canView(item.perm));
  const showContabilidad  = contabilidadItems.length > 0;

  return (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 mb-1 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
          <FileText size={15} className="text-black" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight">Finanzas Pro</p>
          <p className="text-xs text-gray-500 leading-tight truncate">La Montada Sound</p>
        </div>
      </div>

      {/* Scrollable nav area */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll space-y-0.5 px-2 pb-2">

        {/* Dashboard global — solo admin */}
        {showAdmin && (
          <>
            <NavLink
              to="/"
              end
              onClick={close}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
                  isActive
                    ? 'bg-amber-500/15 text-amber-400 font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-white/5',
                )
              }
            >
              <LayoutDashboard size={14} className="flex-shrink-0" />
              <span>Dashboard global</span>
            </NavLink>
            <div className="my-2 border-t border-white/8" />
          </>
        )}

        {/* ── La Montada Sound ── */}
        {showMontada && (
          <div className="mb-1">
            <SectionHeader icon={Building2} label="La Montada Sound" color="bg-amber-500" />
            <div className="space-y-0.5">
              {SUB_MONTADA.map((item) => (
                <SubLink key={item.to} {...item} onClick={close} />
              ))}
            </div>
          </div>
        )}

        {showMontada && showDj && <div className="my-3 border-t border-white/8" />}

        {/* ── DJs ── */}
        {showDj && (
          <div className="mb-1">
            <SectionHeader icon={Music2} label="DJs" color="bg-purple-400" />
            <div className="space-y-0.5">
              {SUB_DJ.map((item) => (
                <SubLink key={item.to} {...item} onClick={close} />
              ))}
            </div>
          </div>
        )}

        {(showMontada || showDj) && showContabilidad && <div className="my-3 border-t border-white/8" />}

        {/* ── Contabilidad (conjunta) ── */}
        {showContabilidad && (
          <div className="mb-1">
            <SectionHeader icon={Wallet} label="Contabilidad" color="bg-blue-400" />
            <div className="space-y-0.5">
              {contabilidadItems.map((item) => (
                <SubLink key={item.to} to={item.to} label={item.label} icon={item.icon} onClick={close} />
              ))}
            </div>
          </div>
        )}

        {/* ── Administración ── */}
        {showAdmin && (
          <>
            <div className="my-3 border-t border-white/8" />
            <div className="mb-1">
              <SectionHeader icon={Settings} label="Administración" color="bg-gray-500" />
              <div className="space-y-0.5">
                <SubLink to="/admin/usuarios" label="Usuarios y permisos" icon={Users} onClick={close} />
                <SubLink to="/admin/ajustes"  label="Ajustes"             icon={Settings} onClick={close} />
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Footer fijo */}
      <div className="flex-shrink-0 px-2 pt-2 pb-3 border-t border-white/8 space-y-0.5">
        {user && (
          <div className="px-3 py-2 mb-0.5">
            <p className="text-xs font-semibold text-white truncate">{user.nombre}</p>
            <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
          </div>
        )}
        {showAdmin && (
          <button
            onClick={generateBackup}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <HardDrive size={13} />
            Copia de seguridad
          </button>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────

export const Sidebar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Botón móvil */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden bg-gray-900 p-2 rounded-lg text-gray-300 shadow-lg"
        aria-label="Abrir menú"
      >
        <Menu size={18} />
      </button>

      {/* Overlay móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-gray-950 flex flex-col shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 z-10"
              aria-label="Cerrar menú"
            >
              <X size={18} />
            </button>
            <NavContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-60 xl:w-64 bg-gray-950 min-h-screen sticky top-0 h-screen flex-shrink-0">
        <NavContent />
      </aside>
    </>
  );
};
