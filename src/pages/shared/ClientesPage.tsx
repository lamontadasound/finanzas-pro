// ── Clientes — gestión y autocompletado para facturas (Fase H) ─────────────
// Ficha con datos fiscales reutilizados por GenerarFacturaModal (autocompleta
// NIF/dirección/email al facturar) y por el PDF (cliente_snapshot). No
// inventa ningún dato: cada campo empieza vacío hasta que se rellena aquí.
import { useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Building2, User } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { Modal } from '../../components/ui/Modal';
import { Button2 } from '../../components/ui2/Button';
import { ContentCard2 } from '../../components/ui2/ContentCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { uid } from '../../utils/helpers';
import type { Cliente } from '../../types';

const EMPTY = (): Partial<Cliente> => ({ nombre: '', esEmpresa: false });

export const ClientesPage = () => {
  const clientes = useStore((s) => s.clientes);
  const addCliente = useStore((s) => s.addCliente);
  const updateCliente = useStore((s) => s.updateCliente);
  const deleteCliente = useStore((s) => s.deleteCliente);
  const canCreateModulo = useAuthStore((s) => s.canCreateModulo);
  const canEditModulo = useAuthStore((s) => s.canEditModulo);
  const canDeleteModulo = useAuthStore((s) => s.canDeleteModulo);
  const showConfirm = useConfirmStore((s) => s.show);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Partial<Cliente>>(EMPTY());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q) || c.nifCif?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
  }, [clientes, search]);

  const openNew = () => { setEditing(null); setForm(EMPTY()); setShowModal(true); };
  const openEdit = (c: Cliente) => { setEditing(c); setForm({ ...c }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const save = async () => {
    if (!form.nombre?.trim()) return;
    if (editing) {
      if (!await updateCliente(editing.id, form)) return;
    } else {
      if (!await addCliente({ ...EMPTY(), ...form, id: uid(), createdAt: new Date().toISOString() } as Cliente)) return;
    }
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          
        </div>
        {canCreateModulo('contabilidad') && (
          <Button2 variant="primary" icon={<Plus size={16} />} onClick={openNew}>Nuevo cliente</Button2>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, NIF o email…"
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-2xl bg-white outline-none focus:border-accent-400"
        />
      </div>

      {filtered.length === 0 ? (
        <ContentCard2 padding="lg">
          <EmptyState icon={<User size={22} />} title="Sin clientes" description="Añade el primero para poder autocompletarlo al generar una factura." />
        </ContentCard2>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <ContentCard2 key={c.id} padding="md" className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-accent-50 text-accent-600 flex items-center justify-center flex-shrink-0">
                    {c.esEmpresa ? <Building2 size={16} /> : <User size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{c.nombre}</p>
                    <p className="text-xs text-gray-400">{c.esEmpresa ? 'Empresa' : 'Particular'}{c.nifCif ? ` · ${c.nifCif}` : ''}</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {canEditModulo('contabilidad') && (
                    <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-accent-500 hover:bg-accent-50 rounded-lg"><Edit2 size={13} /></button>
                  )}
                  {canDeleteModulo('contabilidad') && (
                    <button onClick={() => showConfirm('¿Eliminar este cliente?', () => deleteCliente(c.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              {(c.direccion || c.email || c.telefono) && (
                <div className="text-xs text-gray-500 space-y-0.5 pt-1 border-t border-gray-50">
                  {c.direccion && <p className="truncate">{c.direccion}</p>}
                  {c.email && <p>{c.email}</p>}
                  {c.telefono && <p>{c.telefono}</p>}
                </div>
              )}
            </ContentCard2>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar cliente' : 'Nuevo cliente'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label-form">Nombre / razón social *</label>
            <input className="input-form" value={form.nombre ?? ''} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="es-empresa" checked={!!form.esEmpresa} onChange={(e) => setForm((f) => ({ ...f, esEmpresa: e.target.checked }))} className="rounded border-gray-300 text-accent-600" />
            <label htmlFor="es-empresa" className="text-sm text-gray-600">Es una empresa (no particular)</label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-form">NIF / CIF</label>
              <input className="input-form" value={form.nifCif ?? ''} onChange={(e) => setForm((f) => ({ ...f, nifCif: e.target.value }))} />
            </div>
            <div>
              <label className="label-form">Teléfono</label>
              <input className="input-form" value={form.telefono ?? ''} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label-form">Dirección</label>
              <input className="input-form" value={form.direccion ?? ''} onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label-form">Email</label>
              <input type="email" className="input-form" value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label-form">Observaciones</label>
              <textarea className="input-form" rows={2} value={form.observaciones ?? ''} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button2 variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button2>
            <Button2 variant="primary" onClick={save} className="flex-1">{editing ? 'Guardar' : 'Añadir cliente'}</Button2>
          </div>
        </div>
      </Modal>
    </div>
  );
};
