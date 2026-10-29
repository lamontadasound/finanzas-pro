import {LINEA_NAV_ITEMS} from '../../config/lineaNavItems';
import {SECTION_LABELS,sectionForPath} from '../../config/serviceSections';
import {LimitedList} from '../../components/kit/LimitedList';
import {PageHeader,FormGroup,Field} from '../../components/kit';
import { useMemo, useState } from 'react';
import { Plus, Edit2, ShieldOff, ShieldCheck, Search, Shield, User, ChevronDown, Mail, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Switch';
import { EmptyState } from '../../components/ui/EmptyState';
import { useConfirmStore } from '../../store/useConfirmStore';
import { BUSINESS_LINES, LINEA_IDS } from '../../config/businessLines';
import { NO_PERM_CRUD, MODULO_IDS, NO_PERMS_FACTURACION } from '../../types';
import type { Usuario, UserRol, PermisosLineas, PermisosModulos, PermisoCRUD, ModuloId, PermisosFacturacion } from '../../types';

const MODULO_LABEL: Record<ModuloId, string> = {
  contabilidad: 'Contabilidad',
  informes: 'Informes',
  impuestos: 'Impuestos',
  administracion: 'Administración',
};

const emptyLineas = (): PermisosLineas => Object.fromEntries(LINEA_IDS.map((id) => [id, { ...NO_PERM_CRUD }])) as PermisosLineas;
const emptyModulos = (): PermisosModulos => Object.fromEntries(MODULO_IDS.map((id) => [id, { ...NO_PERM_CRUD }])) as PermisosModulos;
const allLineas = (): PermisosLineas => Object.fromEntries(LINEA_IDS.map((id) => [id, { ver: true, crear: true, editar: true, eliminar: true }])) as PermisosLineas;
const allModulos = (): PermisosModulos => Object.fromEntries(MODULO_IDS.map((id) => [id, { ver: true, crear: true, editar: true, eliminar: true }])) as PermisosModulos;

interface FormState {
  id?: string;
  nombre: string;
  email: string;
  rol: UserRol;
  activo: boolean;
  permisosLineas: PermisosLineas;
  permisosModulos: PermisosModulos;
  permisosFacturacion: PermisosFacturacion;
}

const EMPTY_FORM = (): FormState => ({
  nombre: '', email: '', rol: 'usuario', activo: true,
  permisosLineas: emptyLineas(), permisosModulos: emptyModulos(),
  permisosFacturacion: { ...NO_PERMS_FACTURACION },
});

// ── Fila de la matriz — una línea o un módulo con sus 4 switches ────────────
const MatrixRow = ({ label, perm, onChange, disabled }: {
  label: string; perm: PermisoCRUD; onChange: (p: PermisoCRUD) => void; disabled?: boolean;
}) => {
  const allOn = perm.ver && perm.crear && perm.editar && perm.eliminar;
  const set = (k: keyof PermisoCRUD, v: boolean) => onChange({ ...perm, [k]: v, ...(k === 'ver' && !v ? { crear: false, editar: false, eliminar: false } : {}) });
  return (
    <div className="flex flex-wrap items-center gap-3 py-4 border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => onChange(allOn ? { ...NO_PERM_CRUD } : { ver: true, crear: true, editar: true, eliminar: true })}
        disabled={disabled}
        className="w-full text-left text-sm font-medium disabled:opacity-50"
      >
        {label}
      </button>
      <div className="flex justify-center"><Switch label="Ver" checked={perm.ver} onChange={(v) => set('ver', v)} disabled={disabled} /></div>
      <div className="flex justify-center"><Switch label="Crear" checked={perm.crear} onChange={(v) => set('crear', v)} disabled={disabled || !perm.ver} /></div>
      <div className="flex justify-center"><Switch label="Editar" checked={perm.editar} onChange={(v) => set('editar', v)} disabled={disabled || !perm.ver} /></div>
      <div className="flex justify-center"><Switch label="Eliminar" checked={perm.eliminar} onChange={(v) => set('eliminar', v)} disabled={disabled || !perm.ver} /></div>
    </div>
  );
};

const SkeletonRow = () => (
  <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
    <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-32 bg-gray-100 rounded" />
      <div className="h-3 w-48 bg-gray-100 rounded" />
    </div>
    <div className="w-16 h-6 bg-gray-100 rounded-full" />
  </div>
);

export const AdminUsuarios = () => {
  const usuarios = useStore((s) => s.usuarios);
  const loaded = useStore((s) => s._loaded);
  const initData = useStore((s) => s.initData);
  const permisosFacturacionMap = useStore((s) => s.permisosFacturacion);
  const currentUser = useAuthStore((s) => s.user);
  const showConfirm = useConfirmStore((s) => s.show);

  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteNotice, setDeleteNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filterRol, setFilterRol] = useState<'todos' | UserRol>('todos');
  const [filterEstado, setFilterEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [showModal, setShowModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [permSection, setPermSection] = useState<'lineas' | 'modulos'>('lineas');

  // ── Protección: no se puede dejar la sociedad sin ningún admin activo ────
  const numAdminsActivos = useMemo(() => usuarios.filter((u) => u.rol === 'admin' && u.activo).length, [usuarios]);
  const esUltimoAdmin = (u: Usuario) => u.rol === 'admin' && u.activo && numAdminsActivos <= 1;
  const editandoAUnoMismo = (u: Usuario) => !!currentUser && currentUser.id !== 'admin' && currentUser.id === u.id;

  const filtered = useMemo(() => {
    let list = usuarios;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (filterRol !== 'todos') list = list.filter((u) => u.rol === filterRol);
    if (filterEstado !== 'todos') list = list.filter((u) => (filterEstado === 'activo') === u.activo);
    return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [usuarios, search, filterRol, filterEstado]);

  const [createError, setCreateError] = useState('');

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM()); setCreateError(''); setShowModal(true); };
  const openEdit = (u: Usuario) => {
    setEditing(u);
    setForm({
      id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo,
      permisosLineas: { ...emptyLineas(), ...u.permisosLineas },
      permisosModulos: { ...emptyModulos(), ...u.permisosModulos },
      permisosFacturacion: { ...NO_PERMS_FACTURACION, ...permisosFacturacionMap[u.id] },
    });
    setCreateError('');
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setShowPermModal(false); };

  const setRol = (rol: UserRol) => setForm((f) => ({
    ...f, rol,
    permisosLineas: rol === 'admin' ? allLineas() : f.permisosLineas,
    permisosModulos: rol === 'admin' ? allModulos() : f.permisosModulos,
  }));

  // Convierte el shape del formulario al que espera la Edge Function
  // `create-user` (ver supabase/functions/create-user/index.ts).
  const permisosParaFuncion = () => ({
    permisosLineas: emptyLineas(),
    permisosModulos: Object.fromEntries(MODULO_IDS.map((id) => [id, form.permisosModulos[id] ?? { ...NO_PERM_CRUD }])),
  });

  const save = async () => {
    if (!form.nombre || !form.email) return;
    // Protección: nunca guardar un cambio que deje a la sociedad sin admin.
    if (editing && editing.rol === 'admin' && form.rol !== 'admin' && numAdminsActivos <= 1) {
      showConfirm('No puedes quitar el rol de administrador al último admin activo. Crea o activa otro admin primero.', () => {});
      return;
    }
    // Protección: un usuario no-admin no puede editar sus propios permisos.
    if (editing && editandoAUnoMismo(editing)) {
      showConfirm('No puedes modificar tus propios permisos. Pide a otro administrador que lo haga.', () => {});
      return;
    }
    setSaving(true);
    setCreateError('');
    try {
      if (editing) {
        const {error}=await supabase.rpc('admin_save_user', {p_user_id:editing.id,p_nombre:form.nombre,p_rol:form.rol,p_activo:form.activo,p_lineas:form.permisosLineas,p_modulos:form.permisosModulos,p_facturacion:form.permisosFacturacion});
        if(error){setCreateError(error.message);return;}
        await initData();
        closeModal();
      } else {
        // Creación — SIEMPRE vía Edge Function: nunca se introduce ni se
        // genera una contraseña desde Administración. La función no está
        // desplegada todavía (Fase G), así que esta llamada fallará de
        // forma controlada hasta entonces — comportamiento esperado.
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: { email: form.email, nombre: form.nombre, rol: form.rol, ...permisosParaFuncion(), permisosFacturacion: form.permisosFacturacion },
        });
        if (error || !data?.ok) {
          setCreateError(data?.error || error?.message || 'No se pudo invitar al usuario.');
          return;
        }
        const {error:permissionsError}=await supabase.rpc('admin_save_user',{p_user_id:data.userId,p_nombre:form.nombre,p_rol:form.rol,p_activo:form.activo,p_lineas:form.permisosLineas,p_modulos:form.permisosModulos,p_facturacion:form.permisosFacturacion});
        if(permissionsError){setCreateError('Invitación creada. No se han activado los accesos por servicio: '+permissionsError.message);await initData();return;}
        await initData();
        closeModal();
      }
    } catch(e) {setCreateError(e instanceof Error?e.message:"No se pudo guardar.");} finally {
      setSaving(false);
    }
  };

  const toggleActivo = (u: Usuario) => {
    if (esUltimoAdmin(u)) {
      showConfirm('No puedes desactivar al último administrador activo. La sociedad se quedaría sin acceso de administración.', () => {});
      return;
    }
    showConfirm(
      u.activo ? `¿Desactivar a ${u.nombre}? Perderá acceso inmediatamente.` : `¿Reactivar a ${u.nombre}?`,
      async () => {const {error}=await supabase.from('profiles').update({activo:!u.activo}).eq('id',u.id); if(error) useStore.setState({_saveError:error.message}); else await initData();},
    );
  };

  const deleteUser = (u: Usuario) => {
    if (deleting || editandoAUnoMismo(u) || esUltimoAdmin(u) || currentUser?.rol !== 'admin') return;
    showConfirm(`¿Eliminar a ${u.nombre} (${u.email})? No podrá volver a acceder y desaparecerá de la lista. Se conservarán sus presupuestos y registros financieros. Esta acción no se puede deshacer.`, async () => {
      setDeleting(u.id); setDeleteError(''); setDeleteNotice('');
      try {
        const { data, error } = await supabase.functions.invoke('admin-user-actions', { body: { action: 'delete_user', userId: u.id } });
        let message = data?.error;
        if (error && 'context' in error && error.context instanceof Response) {
          const details = await error.context.json().catch(() => null);
          message = details?.error ?? message;
        }
        if (error || !data?.ok) throw new Error(message || 'No se pudo eliminar el usuario. Vuelve a intentarlo.');
        setDeleteNotice(`Usuario ${u.nombre} eliminado.`);
        await initData();
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar el usuario.');
        await initData();
      } finally { setDeleting(null); }
    });
  };

  const lineasDe = (u: Usuario) => u.rol === 'admin' ? LINEA_IDS : LINEA_IDS.filter((id) => u.permisosLineas?.[id]?.ver);

  return (
    <div className="space-y-5">
      {deleteError && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-4 text-sm">{deleteError}</p>}
      {deleteNotice && <p role="status" className="rounded-xl bg-emerald-50 text-emerald-800 p-4 text-sm">{deleteNotice}</p>}
      <PageHeader title="Usuarios y permisos"><Button variant="primary" icon={<Plus size={16}/>} onClick={openNew}>Nuevo usuario</Button></PageHeader>
      {/* Buscador y filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre o email…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-gold-400 transition-colors" />
        </div>
        <select value={filterRol} onChange={(e) => setFilterRol(e.target.value as 'todos' | UserRol)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="todos">Todos los roles</option>
          <option value="admin">Administrador</option>
          <option value="usuario">Usuario</option>
        </select>
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value as 'todos' | 'activo' | 'inactivo')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {/* Lista */}
      {!loaded ? (
        <div className="grid gap-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<User size={22} />} title="Sin usuarios" description={search || filterRol !== 'todos' || filterEstado !== 'todos' ? 'Prueba a cambiar la búsqueda o los filtros.' : 'Crea el primero con el botón «Nuevo usuario».'} />
      ) : (
        <div className="grid gap-3">
          <LimitedList>{filtered.map((u) => (
            <div key={u.id} className="widget list-row flex-wrap">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${u.rol === 'admin' ? 'bg-gold-100' : 'bg-gray-100'}`}>
                {u.rol === 'admin' ? <Shield size={18} className="text-gold-600" /> : <User size={18} className="text-gray-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-900">{u.nombre}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${u.rol === 'admin' ? 'bg-gold-100 text-gold-700' : 'bg-gray-100 text-gray-600'}`}>{u.rol}</span>
                  {!u.activo && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 uppercase">Inactivo</span>}
                  {editandoAUnoMismo(u) && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 uppercase">Tú</span>}
                </div>
                <p className="text-sm text-gray-500 truncate">{u.email}</p>
                {/* Último acceso: solo si el dato existe realmente — hoy no se persiste, así que nunca se muestra un valor inventado. */}
                {u.ultimoAcceso && <p className="text-xs text-gray-400 mt-0.5">Último acceso: {u.ultimoAcceso}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {lineasDe(u).length === 0 && u.rol !== 'admin' ? (
                    <span className="text-[10px] text-gray-400 italic">Sin líneas asignadas</span>
                  ) : (
                    lineasDe(u).map((id) => (
                      <span key={id} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">{BUSINESS_LINES[id].shortLabel}</span>
                    ))
                  )}
                  {u.rol !== 'admin' && MODULO_IDS.filter((m) => u.permisosModulos?.[m]?.ver).map((m) => (
                    <span key={m} className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">{MODULO_LABEL[m]}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0 self-start sm:self-center">
                {currentUser?.rol === 'admin' && <button
                  onClick={() => deleteUser(u)}
                  disabled={!!deleting || esUltimoAdmin(u) || editandoAUnoMismo(u)}
                  className="inline-flex items-center gap-1 min-h-11 px-2 text-xs text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={`Eliminar usuario ${u.nombre}`}
                  title={editandoAUnoMismo(u) ? 'No puedes eliminar tu propia cuenta' : esUltimoAdmin(u) ? 'Debe quedar un administrador activo' : 'Eliminar usuario'}
                ><Trash2 size={14}/>{deleting === u.id ? 'Eliminando…' : 'Eliminar'}</button>}
                <button onClick={() => openEdit(u)} className="p-2 text-gray-400 hover:text-gold-500 hover:bg-gold-50 rounded-lg transition-colors" aria-label="Editar / permisos"><Edit2 size={14} /></button>
                <button
                  onClick={() => toggleActivo(u)}
                  disabled={esUltimoAdmin(u)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  aria-label={u.activo ? 'Desactivar' : 'Reactivar'}
                  title={esUltimoAdmin(u) ? 'No puedes desactivar al último administrador' : undefined}
                >
                  {u.activo ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                </button>
              </div>
            </div>
          ))}</LimitedList>
        </div>
      )}

      {/* Modal crear/editar + matriz de permisos */}
      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar usuario' : 'Nuevo usuario'} size="lg">
        <div className="space-y-5">
          <FormGroup title="Datos del usuario"><div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nombre *">
              <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className="input-form" />
            </Field>
            <Field label="Email *">
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input-form" />
            </Field>
            {!editing && (
              <div className="sm:col-span-2 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                <Mail size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">Se enviará una invitación por correo para que la persona establezca su propia contraseña. Nunca se introduce aquí.</p>
              </div>
            )}
            <div>
              <label className="label-form">Rol</label>
              <select
                value={form.rol}
                onChange={(e) => setRol(e.target.value as UserRol)}
                disabled={!!editing && editandoAUnoMismo(editing) || !!editing && editing.rol === 'admin' && numAdminsActivos <= 1}
                className="input-form"
              >
                <option value="usuario">Usuario</option>
                <option value="admin">Admin</option>
              </select>
              {editing && editing.rol === 'admin' && numAdminsActivos <= 1 && (
                <p className="text-xs text-amber-700 mt-1">Es el último administrador activo — no se le puede quitar el rol.</p>
              )}
            </div>
            <div className="col-span-2">
              <Switch
                checked={form.activo}
                onChange={(v) => setForm((f) => ({ ...f, activo: v }))}
                label="Usuario activo"
                disabled={!!editing && esUltimoAdmin(editing) && form.activo}
              />
            </div>
          </div></FormGroup>

          {form.rol === 'usuario' && (
            <div>
              <button
                type="button"
                onClick={() => setShowPermModal((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 hover:border-gold-400 transition-colors"
              >
                Permisos por línea y módulo
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${showPermModal ? 'rotate-180' : ''}`} />
              </button>
              {showPermModal && (
                <div className="border border-gray-200 rounded-xl mt-2 p-4">
                  {editing && editandoAUnoMismo(editing) && (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                      No puedes modificar tus propios permisos.
                    </p>
                  )}
                  <div className="flex gap-1 bg-gray-100 rounded-full p-1 mb-3 w-fit">
                    {(['lineas', 'modulos'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setPermSection(s)}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors ${permSection === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                      >
                        {s === 'lineas' ? 'Líneas de negocio' : 'Módulos'}
                      </button>
                    ))}
                  </div>

                  {permSection === 'lineas' ? (
                    LINEA_IDS.map((id) => (
                      <div key={id}><MatrixRow
                        label={BUSINESS_LINES[id].label}
                        perm={form.permisosLineas[id] ?? { ...NO_PERM_CRUD }}
                        disabled={!!editing && editandoAUnoMismo(editing)}
                        onChange={(p) => setForm((f) => ({ ...f, permisosLineas: { ...f.permisosLineas, [id]: {...p,secciones:f.permisosLineas[id]?.secciones} } }))}
                      />{form.permisosLineas[id]?.ver&&<fieldset className="pl-4 pb-4" disabled={!!editing&&editandoAUnoMismo(editing)}><legend className="text-sm font-semibold">Apartados disponibles</legend><p className="text-xs text-gray-500 mb-2">Crear, editar y eliminar se aplican solo a los apartados seleccionados. Resumen e informes incluyen datos financieros.</p><div className="grid sm:grid-cols-2 gap-2">{[...new Set(LINEA_NAV_ITEMS[id].map(item=>sectionForPath(item.to)))].map(section=><label key={section} className="flex gap-2 text-sm"><input type="checkbox" checked={form.permisosLineas[id]?.secciones==null||form.permisosLineas[id]?.secciones?.includes(section)} onChange={e=>setForm(f=>{const current=f.permisosLineas[id]??NO_PERM_CRUD;const all=[...new Set(LINEA_NAV_ITEMS[id].map(item=>sectionForPath(item.to)))];const selected=current.secciones??all;return {...f,permisosLineas:{...f.permisosLineas,[id]:{...current,secciones:e.target.checked?[...selected,section]:selected.filter(s=>s!==section)}}};})}/>{SECTION_LABELS[section]??section}</label>)}</div></fieldset>}</div>
                    ))
                  ) : (
                    MODULO_IDS.map((id) => (
                      <MatrixRow
                        key={id}
                        label={MODULO_LABEL[id]}
                        perm={form.permisosModulos[id] ?? { ...NO_PERM_CRUD }}
                        disabled={!!editing && editandoAUnoMismo(editing)}
                        onChange={(p) => setForm((f) => ({ ...f, permisosModulos: { ...f.permisosModulos, [id]: p } }))}
                      />
                    ))
                  )}
                  {permSection === 'modulos' && (
                    <p className="text-xs text-gray-400 mt-3">
                      "Administración" concede acceso a esta pantalla de usuarios. "Impuestos" incluye siempre la nota orientativa — nunca se presenta como liquidación definitiva.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {form.rol !== 'admin' && (
            <div className="border border-gray-100 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700">Permisos de facturación (independientes de "Contabilidad")</p>
              {([
                ['emitir', 'Emitir facturas'],
                ['rectificar', 'Rectificar facturas emitidas'],
                ['gestionarNumeracion', 'Gestionar numeración (confirmar número inicial)'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between text-sm text-gray-600">
                  {label}
                  <Switch
                    checked={form.permisosFacturacion[key]}
                    onChange={(v) => setForm((f) => ({ ...f, permisosFacturacion: { ...f.permisosFacturacion, [key]: v } }))}
                  />
                </label>
              ))}
            </div>
          )}
          {editing && form.rol === 'admin' && (
            <p className="text-xs text-gray-400">Un administrador tiene siempre permiso para emitir, rectificar y gestionar la numeración — no hace falta concederlo aquí.</p>
          )}

          {createError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button variant="primary" onClick={save} loading={saving} className="flex-1">
              {editing ? 'Guardar cambios' : 'Enviar invitación'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
