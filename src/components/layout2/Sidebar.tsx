import { Sidebar001, Sidebar001Content, Sidebar001Item } from '../unlumen-ui/sidebar-001';
import { useEffect } from 'react';
import { lockPageScroll } from '../../lib/scrollLock';
import { useMatch, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CreditCard, Clock,
  Receipt, BarChart3, PieChart,
  Users, Settings, LogOut, X, HardDrive, Landmark,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { LINEA_IDS } from '../../config/businessLines';
import { SlideMenuLineas } from './SlideMenuLineas';
import { BrandMark } from '../ui/BrandMark';

// "Inversiones" NO vive aquí — permanece dentro de cada línea de negocio
// que las tenga (La Montada Sound, Real Madrid). Contabilidad es la vista
// consolidada de la sociedad completa (Fase E).
// `modulo` coincide EXACTAMENTE con el `RequireModulo` que protege cada
// ruta en App.tsx — misma fuente de verdad, así el menú nunca muestra un
// enlace a una ruta que el usuario en realidad no puede abrir (Fase F).
const SUB_CONTABILIDAD = [
  { to: '/contabilidad/resumen',          label: 'Resumen contable',    icon: PieChart,    modulo: 'contabilidad' as const },
  { to: '/contabilidad/pagos',            label: 'Pagos recibidos',     icon: CreditCard,  modulo: 'contabilidad' as const },
  { to: '/contabilidad/pagos-pendientes', label: 'Pagos pendientes',    icon: Clock,       modulo: 'contabilidad' as const },
  { to: '/contabilidad/facturas',         label: 'Facturas',            icon: Receipt,     modulo: 'contabilidad' as const },
  { to: '/contabilidad/impuestos',        label: 'Impuestos',           icon: Landmark,    modulo: 'impuestos' as const },
  { to: '/contabilidad/informes',         label: 'Informe contable',    icon: BarChart3,   modulo: 'informes' as const },
];

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

// Enlace animado sobre la barra lateral marrón.
const SubLink = ({ to, label, icon: Icon, onClick, end }: {
  to: string; label: string; icon: typeof LayoutDashboard; onClick?: () => void; end?: boolean;
}) => {
  const match=useMatch({path:to,end:end ?? false});
  const navigate=useNavigate();
  return <Sidebar001Item href={to} isActive={!!match} label={<span className="flex items-center gap-2"><Icon size={15}/>{label}</span>} onClick={e => { if(e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {e.preventDefault();navigate(to);onClick?.();} }}/ >;
};

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-3 pt-2 pb-1">
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{label}</span>
  </div>
);

const NavContent = ({ onClose }: { onClose?: () => void }) => {
  const { logout, isAdmin, canViewLinea, canViewModulo, user } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const close = () => onClose?.();

  const showAdmin   = isAdmin();
  const showAdminModulo = canViewModulo('administracion');
  const visibleLineas = LINEA_IDS.filter((id) => canViewLinea(id));
  const contabilidadItems = SUB_CONTABILIDAD.filter((item) => canViewModulo(item.modulo) && !['/contabilidad/informes','/contabilidad/pagos','/contabilidad/pagos-pendientes'].includes(item.to));
  const showContabilidad  = contabilidadItems.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-accent-500">
          <BrandMark size={38} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-tight">Mi espacio</p>
          
        </div>
      </div>

      <Sidebar001Content className="sidebar-scroll px-3 py-1"><nav className="space-y-0.5">
        {visibleLineas.length > 0 && (
          <div className="pt-1">
            <SlideMenuLineas visibleLineas={visibleLineas} onNavigate={close} />
          </div>
        )}

        <SectionHeader label="Mi espacio" />
        <SubLink to="/" label="Resumen" icon={LayoutDashboard} onClick={close} end />
        {canViewModulo('informes') && <SubLink to="/contabilidad/informes" label="Informes" icon={BarChart3} onClick={close} />}
        {canViewModulo('contabilidad') && <SubLink to="/contabilidad/pagos" label="Pagos" icon={CreditCard} onClick={close} />}



        {showContabilidad && (
          <div>
            <SectionHeader label="Contabilidad" />
            <div className="space-y-0.5">
              {contabilidadItems.map((item) => (
                <SubLink key={item.to} to={item.to} label={item.label} icon={item.icon} onClick={close} />
              ))}
            </div>
          </div>
        )}

        {(showAdminModulo || showAdmin) && (
          <div>
            <SectionHeader label="Administración" />
            <div className="space-y-0.5">
              {showAdminModulo && <SubLink to="/admin/usuarios" label="Usuarios y permisos" icon={Users} onClick={close} />}
              {showAdmin && <SubLink to="/admin/ajustes"  label="Configuración"             icon={Settings} onClick={close} />}
            </div>
          </div>
        )}
      </nav></Sidebar001Content>

      <div className="flex-shrink-0 px-3 pt-2 pb-4 border-t border-gray-100 space-y-0.5">
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-500 flex-shrink-0">
              {user.nombre?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user.nombre}</p>
              <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
        )}
        {showAdmin && (
          <button
            onClick={generateBackup}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-gray-900 hover:bg-white transition-colors duration-150"
          >
            <HardDrive size={13} strokeWidth={1.75} />
            Copia de seguridad
          </button>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors duration-150"
        >
          <LogOut size={13} strokeWidth={1.75} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

interface SidebarProps { mobileOpen: boolean; onMobileClose: () => void }

export const Sidebar2 = ({ mobileOpen, onMobileClose }: SidebarProps) => {
  useEffect(() => { if (mobileOpen) return lockPageScroll(); }, [mobileOpen]);
  return (
  <>
    <AnimatePresence>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40" onClick={onMobileClose}
          />
          <motion.aside
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-72 max-w-[85vw] h-full finance-sidebar flex flex-col shadow-2xl"
          >
            <button
              onClick={onMobileClose}
              aria-label="Cerrar menú"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-900 p-1.5 rounded-full hover:bg-white z-10"
            >
              <X size={18} />
            </button>
            <Sidebar001 defaultWidth={288} minWidth={220} maxWidth={288} className="finance-sidebar max-w-full"><NavContent onClose={onMobileClose} /></Sidebar001>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>

    <Sidebar001 defaultWidth={256} minWidth={220} maxWidth={360} className="hidden lg:flex finance-sidebar sticky top-0 h-screen">
      <NavContent />
    </Sidebar001>
  </>
);
};
