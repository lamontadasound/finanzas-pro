import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, Package, BarChart3, Building2, Music2,
  Users, LogOut, Menu, X, ChevronDown, TrendingUp, Wallet,
  Calendar, CreditCard, FileText, HardDrive, ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';

const SUB_MONTADA = [
  { to: '/montada/resumen',     label: 'Resumen',          icon: LayoutDashboard },
  { to: '/montada/ingresos',    label: 'Ingresos',         icon: TrendingUp },
  { to: '/montada/gastos',      label: 'Gastos generales', icon: Wallet },
  { to: '/montada/eventos',     label: 'Eventos',          icon: Calendar },
  { to: '/montada/pagos',       label: 'Pagos recibidos',  icon: CreditCard },
  { to: '/montada/facturas',    label: 'Facturas',         icon: Receipt },
  { to: '/montada/inversiones', label: 'Inversiones',      icon: Package },
  { to: '/montada/informes',    label: 'Informes',         icon: BarChart3 },
];

const SUB_DJ = [
  { to: '/dj/resumen',     label: 'Resumen',         icon: LayoutDashboard },
  { to: '/dj/ingresos',    label: 'Ingresos',        icon: TrendingUp },
  { to: '/dj/gastos',      label: 'Gastos generales',icon: Wallet },
  { to: '/dj/eventos',     label: 'Actuaciones',     icon: Calendar },
  { to: '/dj/pagos',       label: 'Pagos recibidos', icon: CreditCard },
  { to: '/dj/facturas',    label: 'Facturas',        icon: Receipt },
  { to: '/dj/inversiones', label: 'Inversiones',     icon: Package },
  { to: '/dj/informes',    label: 'Informes',        icon: BarChart3 },
];

const generateBackup = () => {
  const s = useStore.getState();
  const blob = new Blob([JSON.stringify({ version: '4', exportedAt: new Date().toISOString(), data: { eventos: s.eventos, ingresos: s.ingresos, gastos: s.gastos, suplidos: s.suplidos, facturas: s.facturas, equipo: s.equipo } }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `finanzas-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

export const Sidebar = () => {
  const { logout, isAdmin, canView, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [montadaOpen, setMontadaOpen] = useState(location.pathname.startsWith('/montada'));
  const [djOpen, setDjOpen] = useState(location.pathname.startsWith('/dj'));

  const close = () => setMobileOpen(false);
  const handleLogout = () => { logout(); navigate('/login'); };

  const SectionToggle = ({
    label, icon: Icon, color, open, onToggle, items,
  }: {
    label: string; icon: typeof Building2; color: string;
    open: boolean; onToggle: () => void;
    items: typeof SUB_MONTADA;
  }) => (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold text-white hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-5 h-5 rounded flex items-center justify-center ${color}`}>
            <Icon size={11} className="text-black" />
          </div>
          <span>{label}</span>
        </div>
        <ChevronDown size={14} className={clsx('text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-0.5 ml-2 pl-3 border-l border-white/10 space-y-0.5">
          {items.map(({ to, label: l, icon: Ic }) => (
            <NavLink
              key={to}
              to={to}
              onClick={close}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                  isActive
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )
              }
            >
              <Ic size={13} />
              {l}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );

  const NavContent = () => (
    <div className="flex flex-col h-full gap-1">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 mb-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
          <FileText size={15} className="text-black" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">Finanzas Pro</p>
          <p className="text-xs text-gray-500 leading-tight">La Montada Sound</p>
        </div>
      </div>

      {/* Dashboard */}
      <NavLink
        to="/"
        end
        onClick={close}
        className={({ isActive }) =>
          clsx(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
            isActive ? 'bg-amber-500/15 text-amber-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
          )
        }
      >
        <LayoutDashboard size={15} />
        Dashboard
      </NavLink>

      <div className="my-2 border-t border-white/10" />

      {/* La Montada Sound */}
      {canView('montada') && (
        <SectionToggle
          label="La Montada Sound"
          icon={Building2}
          color="bg-amber-500"
          open={montadaOpen}
          onToggle={() => setMontadaOpen((v) => !v)}
          items={SUB_MONTADA}
        />
      )}

      {/* DJ Personal */}
      {canView('dj') && (
        <SectionToggle
          label="DJ Personal"
          icon={Music2}
          color="bg-purple-400"
          open={djOpen}
          onToggle={() => setDjOpen((v) => !v)}
          items={SUB_DJ}
        />
      )}

      {/* Admin */}
      {isAdmin() && (
        <>
          <div className="my-2 border-t border-white/10" />
          <p className="px-3 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Administración</p>
          <NavLink
            to="/admin/usuarios"
            onClick={close}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                isActive ? 'bg-amber-500/15 text-amber-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
              )
            }
          >
            <Users size={15} />
            Usuarios
          </NavLink>
        </>
      )}

      {/* Bottom */}
      <div className="mt-auto pt-4 border-t border-white/10 space-y-0.5">
        {user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-white truncate">{user.nombre}</p>
            <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
          </div>
        )}
        {isAdmin() && (
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

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden bg-gray-900 p-2 rounded-lg text-gray-300"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={close} />
          <aside className="relative w-64 h-full bg-gray-950 p-4 flex flex-col overflow-y-auto sidebar-scroll">
            <button onClick={close} className="absolute top-4 right-4 text-gray-500 hover:text-white">
              <X size={18} />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 xl:w-64 bg-gray-950 min-h-screen p-4 sticky top-0 h-screen overflow-y-auto sidebar-scroll flex-shrink-0">
        <NavContent />
      </aside>
    </>
  );
};
