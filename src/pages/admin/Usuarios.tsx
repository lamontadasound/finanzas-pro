import { useState } from 'react';
import { Plus, Edit2, Trash2, Shield, User } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import { hashPassword } from '../../store/useAuthStore';
import type { Usuario, UserRol, AreaKey, Permisos } from '../../types';
import { NO_PERMS, ALL_PERMS } from '../../types';

const AREAS: { key: AreaKey; label: string }[] = [
  { key: 'montada',     label: 'La Montada Sound' },
  { key: 'dj',          label: 'DJs' },
  { key: 'pagos',       label: 'Contabilidad · Pagos recibidos' },
  { key: 'facturas',    label: 'Contabilidad · Facturas' },
  { key: 'inversiones', label: 'Contabilidad · Inversiones' },
  { key: 'informes',    label: 'Informes' },
  { key: 'impuestos',   label: 'Contabilidad · Impuestos' },
];

const DEFAULT_PERMISOS = (): Permisos => JSON.parse(JSON.stringify(NO_PERMS));

const EMPTY_USER = (): Partial<Usuario> & { password: string } => ({
  email: '', nombre: '', rol: 'usuario', activo: true,
  permisos: DEFAULT_PERMISOS(), password: '',
});

const PermToggle = ({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded w-3 h-3" />
    {label}
  </label>
);

export const AdminUsuarios = () => {
  const usuarios    = useStore((s) => s.usuarios);
  const addUsuario  = useStore((s) => s.addUsuario);
  const updateUsuario = useStore((s) => s.updateUsuario);
  const deleteUsuario = useStore((s) => s.deleteUsuario);
  const showConfirm = useConfirmStore((s) => s.show);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Usuario | null>(null);
  const [form, setForm]           = useState(EMPTY_USER());
  const [saving, setSaving]       = useState(false);

  const openNew = () => { setEditing(null); setForm(EMPTY_USER()); setShowModal(true); };
  const openEdit = (u: Usuario) => {
    setEditing(u);
    setForm({ ...u, password: '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const setRol = (rol: UserRol) => {
    setForm((f) => ({
      ...f,
      rol,
      permisos: rol === 'admin' ? ALL_PERMS : DEFAULT_PERMISOS(),
    }));
  };

  const setPerm = (area: AreaKey, key: keyof Permisos[AreaKey], val: boolean) => {
    setForm((f) => ({
      ...f,
      permisos: {
        ...f.permisos!,
        [area]: { ...f.permisos![area], [key]: val },
      },
    }));
  };

  const setAreaAll = (area: AreaKey, val: boolean) => {
    setForm((f) => ({
      ...f,
      permisos: {
        ...f.permisos!,
        [area]: { ver: val, crear: val, editar: val, eliminar: val },
      },
    }));
  };

  const save = async () => {
    if (!form.email || !form.nombre) return;
    setSaving(true);
    try {
      if (editing) {
        const patch: Partial<Usuario> = {
          email: form.email, nombre: form.nombre,
          rol: form.rol, activo: form.activo, permisos: form.permisos,
        };
        if (form.password) {
          patch.passwordHash = await hashPassword(form.password);
        }
        updateUsuario(editing.id, patch);
      } else {
        if (!form.password) { alert('La contraseña es obligatoria'); return; }
        const passwordHash = await hashPassword(form.password);
        addUsuario({
          id: uid(), createdAt: new Date().toISOString(),
          email: form.email!, nombre: form.nombre!, rol: form.rol!,
          activo: form.activo ?? true, permisos: form.permisos!,
          passwordHash,
        });
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500">{usuarios.length} usuarios registrados</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors">
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      <div className="grid gap-3">
        {usuarios.length === 0 && <p className="text-center py-12 text-gray-400 text-sm">Sin usuarios adicionales</p>}
        {usuarios.map((u) => (
          <div key={u.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${u.rol === 'admin' ? 'bg-amber-100' : 'bg-gray-100'}`}>
              {u.rol === 'admin' ? <Shield size={18} className="text-amber-600" /> : <User size={18} className="text-gray-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{u.nombre}</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${u.rol === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{u.rol}</span>
                {!u.activo && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 uppercase">Inactivo</span>}
              </div>
              <p className="text-sm text-gray-500">{u.email}</p>
              {u.rol !== 'admin' && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {AREAS.filter((a) => u.permisos[a.key].ver).map((a) => (
                    <span key={a.key} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">{a.label}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(u)} className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
              <button onClick={() => showConfirm(`¿Eliminar usuario ${u.nombre}?`, () => deleteUsuario(u.id))} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar usuario' : 'Nuevo usuario'} size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-form">Nombre *</label>
              <input value={form.nombre ?? ''} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Email *</label>
              <input type="email" value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">{editing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="input-form" />
            </div>
            <div>
              <label className="label-form">Rol</label>
              <select value={form.rol} onChange={(e) => setRol(e.target.value as UserRol)} className="input-form">
                <option value="usuario">Usuario</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} className="rounded" />
                Usuario activo
              </label>
            </div>
          </div>

          {form.rol === 'usuario' && (
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Permisos por área</p>
              <div className="space-y-3 border border-gray-200 rounded-xl p-4">
                {AREAS.map((area) => {
                  const p = form.permisos![area.key];
                  const allOn = p.ver && p.crear && p.editar && p.eliminar;
                  return (
                    <div key={area.key} className="flex items-center gap-4 flex-wrap">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none w-36">
                        <input type="checkbox" checked={allOn} onChange={(e) => setAreaAll(area.key, e.target.checked)} className="rounded w-3.5 h-3.5" />
                        <span className="text-sm font-medium text-gray-800">{area.label}</span>
                      </label>
                      <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                        <PermToggle label="Ver" checked={p.ver} onChange={(v) => setPerm(area.key, 'ver', v)} />
                        <PermToggle label="Crear" checked={p.crear} onChange={(v) => setPerm(area.key, 'crear', v)} />
                        <PermToggle label="Editar" checked={p.editar} onChange={(v) => setPerm(area.key, 'editar', v)} />
                        <PermToggle label="Eliminar" checked={p.eliminar} onChange={(v) => setPerm(area.key, 'eliminar', v)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 disabled:opacity-60">
              {saving ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Crear usuario')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
