import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, Package,
  BarChart3, Building2, Music2, DollarSign,
  X, Menu, LogOut, HardDrive,
} from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/montada', icon: Building2, label: 'La Montada Sound' },
  { to: '/dj', icon: Music2, label: 'DJ Personal' },
  { to: '/facturas', icon: Receipt, label: 'Facturas & IVA' },
  { to: '/equipo', icon: Package, label: 'Inversiones & Equipo' },
  { to: '/informes', icon: BarChart3, label: 'Informes' },
];

const generateBackup = () => {
  const s = useStore.getState();
  const backup = {
    version: '3',
    exportedAt: new Date().toISOString(),
    data: {
      eventos: s.eventos,
      ingresos: s.ingresos,
      gastos: s.gastos,
      suplidos: s.suplidos,
      facturas: s.facturas,
      equipo: s.equipo,
    },
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finanzas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const bottomSection = (
    <div className="mt-auto pt-4 border-t border-surface-400/15 space-y-1">
      <button
        onClick={generateBackup}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-200 hover:bg-surface-600 transition-all"
        title="Descargar copia de seguridad JSON"
      >
        <HardDrive size={15} />
        <span>Copia de seguridad</span>
      </button>
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
      >
        <LogOut size={15} />
        <span>Cerrar sesión</span>
      </button>
    </div>
  );

  const navContent = (
    <nav className="flex flex-col gap-1">
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive
                ? 'bg-gold-500/15 text-gold-400 border border-gold-500/20'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-surface-600'
            )
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden bg-surface-700 border border-surface-400/30 p-2 rounded-lg text-zinc-400"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-64 h-full bg-surface-800 border-r border-surface-400/20 p-4 flex flex-col gap-6">
            <SidebarHeader />
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200">
              <X size={18} />
            </button>
            {navContent}
            {bottomSection}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 xl:w-60 bg-surface-800 border-r border-surface-400/15 min-h-screen p-4 gap-6 sticky top-0 h-screen overflow-y-auto">
        <SidebarHeader />
        {navContent}
        {bottomSection}
      </aside>
    </>
  );
};

const SidebarHeader = () => (
  <div className="flex items-center gap-2.5 px-1">
    <div className="w-8 h-8 rounded-lg bg-gold-500 flex items-center justify-center">
      <DollarSign size={16} className="text-black font-bold" />
    </div>
    <div>
      <p className="text-sm font-bold text-white leading-tight">Finanzas Pro</p>
      <p className="text-xs text-zinc-600 leading-tight">La Montada Sound</p>
    </div>
  </div>
);
