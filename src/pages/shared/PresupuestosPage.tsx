import {useLocalDraft} from '../../hooks/useLocalDraft';
import { FinancialDigits } from '../../components/ui/FinancialDigits';
import { AnimatedList } from '../../components/unlumen-ui/animated-list';
import { FileTree, type FileTreeElement } from '../../components/unlumen-ui/file-tree';
import { AppleSwitch } from '../../components/unlumen-ui/apple-switch';
import { motion, useReducedMotion } from 'framer-motion';
import { CardsViewIcon } from '../../components/unlumen-ui/cards-view-icon';
import { ListViewIcon } from '../../components/unlumen-ui/list-view-icon';
import { useEffect, useState, useRef } from 'react';
import { Plus, ArrowLeft, Download, Trash2 } from 'lucide-react';
import { BUSINESS_LINES, type LineaId } from '../../config/businessLines';
import { useAuthStore } from '../../store/useAuthStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { Button2 } from '../../components/ui2/Button';
import { conceptosDesdeTexto, MARCA_MONTADA, dinero, nuevoPresupuesto, referenciaPresupuesto, totalesPresupuesto, validarPresupuesto, type Presupuesto, type PresupuestoContenido } from '../../lib/presupuestos';
import { listarPresupuestos, guardarPresupuesto, eliminarPresupuesto } from '../../lib/presupuestosDb';

const estados = { borrador: 'Borrador', pendiente: 'Pendiente de respuesta', aceptado: 'Aceptado', rechazado: 'Rechazado' };
export function PresupuestosPage({ linea }: { linea: LineaId }) {
  const userId=useAuthStore(s=>s.user?.id);
  if(linea !== 'montada_sound' && linea !== 'montada_installations') return <p role="status">Los presupuestos están disponibles en La Montada Sound e Installations.</p>;
  return <PresupuestosEditor key={`${userId}:${linea}`} linea={linea}/>;
}
function PresupuestosEditor({ linea }: { linea: LineaId }) {
  const reduceMotion = useReducedMotion();
  const canCreate = useAuthStore(s => s.canCreateLinea(linea));
  const canEdit = useAuthStore(s => s.canEditLinea(linea));
  const canDelete = useAuthStore(s => s.canDeleteLinea(linea));
  const showConfirm = useConfirmStore(s => s.show);
  const [items, setItems] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'cards'>('list');
  const [filter, setFilter] = useState('todos');
  const userId=useAuthStore(s=>s.user?.id);
  const [draft,setDraft,draftError]=useLocalDraft<{form:PresupuestoContenido|null;editing:Presupuesto|null;dirty:boolean}>(`mi-espacio:presupuesto:${userId}:${linea}`,()=>({form:null,editing:null,dirty:false}));
  const {form,editing,dirty}=draft;
  const setForm=(value:React.SetStateAction<PresupuestoContenido|null>)=>setDraft(d=>({...d,form:typeof value==='function'?value(d.form):value}));
  const setEditing=(editing:Presupuesto|null)=>setDraft(d=>({...d,editing}));
  const setDirty=(dirty:boolean)=>setDraft(d=>({...d,dirty}));
  const [busy, setBusy] = useState(false);
  const photoRequest = useRef(0);
  useEffect(() => () => { photoRequest.current++; }, []);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    let active = true;
    listarPresupuestos(linea).then(data => { if (active) setItems(data); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [linea, reload]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const writable = editing ? canEdit : canCreate;
  const change = (patch: Partial<PresupuestoContenido>) => { if (!writable || busy) return; setForm(f => f ? { ...f, ...patch } : f); setDirty(true); setNotice(''); };
  const open = (p: Presupuesto | null) => { setEditing(p); setForm(p ? { ...structuredClone(p.contenido), marca: { ...(p.contenido.marca ?? MARCA_MONTADA) } } : nuevoPresupuesto()); setDirty(false); setError(''); setNotice(''); };
  const close = () => {
    if (photoBusy) return;
    const done = () => { setForm(null); setEditing(null); setDirty(false); setError(''); };
    if (dirty) showConfirm('¿Descartar los cambios sin guardar de este presupuesto?', done); else done();
  };
  const selectPhoto = async (file?: File) => {
    if (!file || !writable || busy) return;
    const request = ++photoRequest.current; setPhotoBusy(true); setError('');
    try { const { prepararFotoMontaje } = await import('../../lib/fotoMontaje'); const photo=await prepararFotoMontaje(file); if(request===photoRequest.current) change({fotoMontaje:photo}); }
    catch(e){ if(request===photoRequest.current) setError((e as Error).message); }
    finally { if(request===photoRequest.current) setPhotoBusy(false); }
  };
  const save = async (): Promise<Presupuesto | null> => {
    if (!form || !writable || photoBusy) return null;
    const invalid = validarPresupuesto(form); if (invalid) { setError(invalid); return null; }
    setBusy(true); setError('');
    try {
      const p = await guardarPresupuesto(linea, form, editing);
      setItems(old => [p, ...old.filter(x => x.id !== p.id)].sort((a, b) => b.numero - a.numero));
      setEditing(p); setDirty(false); setNotice('Presupuesto guardado.'); return p;
    } catch (e) { setError((e as Error).message); return null; } finally { setBusy(false); }
  };
  const pdf = async () => {
    if (!form) return;
    const invalid = validarPresupuesto(form, true); if (invalid) { setError(invalid); return; }
    const p = dirty || !editing ? await save() : editing; if (!p) return;
    setBusy(true); setError('');
    try {
      const { prepararArchivoPresupuesto, descargarArchivoPresupuesto } = await import('../../lib/presupuestoArchivo');
      const file = await prepararArchivoPresupuesto(p, canCreate || canEdit);
      descargarArchivoPresupuesto(file.blob, p);
      setNotice(file.archivado ? 'PDF guardado en el archivo de este presupuesto y descargado.' : 'PDF descargado. Solo los usuarios con permiso de edición pueden archivarlo.');
    }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo generar el PDF. Inténtalo de nuevo.'); } finally { setBusy(false); }
  };
  const remove = (p: Presupuesto) => showConfirm(`¿Eliminar ${referenciaPresupuesto(p)}?`, async () => {
    setBusy(true); setError('');
    try { await eliminarPresupuesto(p); setItems(old => old.filter(x => x.id !== p.id)); setForm(null); setEditing(null); setDirty(false); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  });
  const generate = () => {
    if (!form?.solicitud.trim()) return;
    const apply = () => change({ conceptos: conceptosDesdeTexto(form.solicitud), titulo: form.titulo || `Servicios · ${BUSINESS_LINES[linea].shortLabel}` });
    if (form.conceptos.length) showConfirm('¿Sustituir los conceptos actuales por los de la descripción?', apply); else apply();
  };
  const visibleItems = items.filter(p => (filter === 'todos' || p.contenido.estado === filter) && `${p.contenido.titulo} ${p.contenido.cliente} ${referenciaPresupuesto(p)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const years = [...new Set(items.map(p => p.contenido.fecha.slice(0,4)))].sort().reverse();
  const archive: FileTreeElement[] = years.map(year => ({ id:year, name:year, type:'folder', defaultOpen:years.length === 1, children:[...new Set(items.filter(p => p.contenido.fecha.startsWith(year)).map(p => p.contenido.fecha.slice(0,7)))].sort().reverse().map(month => ({ id:month, name:new Date(`${month}-15T12:00:00`).toLocaleDateString('es-ES',{month:'long'}), type:'folder', children:items.filter(p => p.contenido.fecha.startsWith(month)).map(p => ({id:p.id,name:`${referenciaPresupuesto(p)} · ${p.contenido.cliente || p.contenido.titulo}`,onSelect:()=>open(p)})) })) }));
  const totals = form ? totalesPresupuesto(form) : null;
  return <div className="quotes-page">
    <header className="quotes-heading">
      <div><p className="quotes-eyebrow">{BUSINESS_LINES[linea].label}</p><h1>Presupuestos</h1></div>
      {!form && canCreate && <Button2 variant="primary" icon={<Plus size={16}/>} onClick={() => open(null)}>Nuevo presupuesto</Button2>}
      {form && <Button2 disabled={busy || photoBusy} icon={<ArrowLeft size={16}/>} onClick={close}>Volver a presupuestos</Button2>}
    </header>
    {draftError&&<p role="alert" className="quotes-error">{draftError}</p>}
    {error && <div role="alert" className="quotes-error">{error}{!form && <button onClick={() => { setError(''); setLoading(true); setReload(n => n + 1); }}>Reintentar</button>}</div>}
    {notice && <p role="status" className="quotes-notice">{notice}</p>}
    {!form ? <>
      <div className="quotes-toolbar"><input aria-label="Buscar presupuestos" placeholder="Buscar cliente, título o referencia" value={search} onChange={e => setSearch(e.target.value)}/><select aria-label="Filtrar por estado" value={filter} onChange={e => setFilter(e.target.value)}><option value="todos">Todos los estados</option>{Object.entries(estados).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select><div className="quotes-view-switch" role="group" aria-label="Vista de presupuestos"><button type="button" aria-label="Vista de lista" aria-pressed={view === 'list'} onClick={() => setView('list')}><ListViewIcon isActive={view === 'list'}/></button><button type="button" aria-label="Vista de tarjetas" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><CardsViewIcon isActive={view === 'cards'}/></button></div></div>
      {items.length > 0 && <details className="quotes-archive"><summary>Archivo por año y mes</summary><FileTree elements={archive} highlightColor="#4b3836"/></details>}
      {loading ? <p role="status">Cargando presupuestos…</p> : <div className={`quotes-list ${view === 'cards' ? 'quotes-list-cards' : ''}`}>
        <AnimatedList items={visibleItems} maxVisible={visibleItems.length} animation="slide" gap={view === 'cards' ? 16 : 0} className={view === 'cards' ? 'quotes-animated-cards' : ''} renderItem={p => {
          const t = totalesPresupuesto(p.contenido);
          return <motion.button layout={!reduceMotion} transition={{ type: 'spring', bounce: 0, duration: .45 }} key={p.id} className="quotes-row" onClick={() => open(p)}><span><small>{referenciaPresupuesto(p)} · {p.contenido.fecha}</small><strong>{p.contenido.titulo}</strong><span>{p.contenido.cliente || 'Cliente pendiente'}</span></span><span className="quotes-row-total"><small>{estados[p.contenido.estado]}</small><strong>{t.pendientes ? 'Por completar' : <FinancialDigits value={dinero(t.base)}/>}</strong><small>Total sin IVA</small></span></motion.button>;
        }}/>
        {items.length === 0 && !error && <div className="quotes-empty"><h2>Tu próxima propuesta empieza aquí.</h2><p>Describe los servicios, revisa los importes y descarga un presupuesto con el estilo de tu negocio.</p></div>}
        {items.length > 0 && !items.some(p => (filter === 'todos' || p.contenido.estado === filter) && `${p.contenido.titulo} ${p.contenido.cliente} ${referenciaPresupuesto(p)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <p className="quotes-empty">No hay presupuestos con estos filtros.</p>}
      </div>}
    </> : <div className="quotes-workspace">
      <div className="quotes-editor">
        <section className="quotes-panel"><div className="quotes-section-title"><span>01</span><h2>Cuéntame qué necesitas</h2></div>
          <label htmlFor="quote-description">Servicios que quieres presupuestar</label>
          <textarea id="quote-description" rows={4} maxLength={20000} disabled={!writable || busy} value={form.solicitud} onChange={e => change({ solicitud: e.target.value })} placeholder={'Sonido para una boda\n2 x Técnico de sonido a 180 €\nTransporte a 90 €'}/>
          <p className="quotes-help">Escribe un servicio por línea. Puedes indicar «2 x Técnico a 180 €». Los precios y descuentos son por unidad y sin IVA; si no los indicas, quedan pendientes.</p>
          {writable && <Button2 disabled={busy || !form.solicitud.trim()} onClick={generate}>Crear conceptos desde la descripción</Button2>}
        </section>
        <section className="quotes-panel"><div className="quotes-section-title"><span>02</span><h2>Los detalles</h2></div>
          <fieldset disabled={!writable || busy} className="quotes-fields">
            <label className="quotes-full">Título<input value={form.titulo} maxLength={180} onChange={e => change({ titulo: e.target.value })} placeholder="Sonido e iluminación · Boda"/></label>
            <label className="quotes-full">Cliente<input value={form.cliente} maxLength={300} onChange={e => change({ cliente: e.target.value })} placeholder="Nombre o empresa"/></label>
            <label className="quotes-full">Dirección y datos del cliente<textarea rows={2} maxLength={1500} value={form.direccion} onChange={e => change({ direccion: e.target.value })}/></label>
            <label className="quotes-full">Fecha del evento o temporada<input maxLength={200} placeholder="Ej. 20/09/2026 o Temporada 2026–2027" value={form.fechaEvento ?? ''} onChange={e => change({ fechaEvento: e.target.value })}/></label>
            <label>Fecha<input type="date" value={form.fecha} onChange={e => change({ fecha: e.target.value })}/></label>
            <label>Válido hasta<input type="date" value={form.validez} min={form.fecha} onChange={e => change({ validez: e.target.value })}/></label>
          </fieldset>
        </section>
        <details className="quotes-panel"><summary>Logo y datos de la empresa</summary><p className="quotes-help">Logo oficial de La Montada. Estos datos se guardan en este presupuesto; puedes revisarlos antes de generar el PDF.</p><div className="quote-brand-logo"><img src="/brand/la-montada-marron.png" alt="La Montada Sound"/></div><fieldset disabled={!writable || busy} className="quotes-fields">{([['nombre','Empresa'],['nif','NIF / CIF'],['direccion','Dirección de la empresa'],['telefono','Teléfono de contacto'],['email','Email de contacto'],['web','Página web'],['instagram','Instagram']] as const).map(([key,label]) => <label key={key}>{label}<input value={(form.marca ?? MARCA_MONTADA)[key]} maxLength={300} onChange={e => change({ marca: { ...(form.marca ?? MARCA_MONTADA), [key]:e.target.value } })}/></label>)}</fieldset></details>
        <section className="quotes-panel"><div className="quotes-section-title"><span>03</span><h2>Conceptos e importes</h2></div>
          {form.conceptos.map((c, i) => <fieldset disabled={!writable || busy} key={c.id} className="quote-concept">
            <label className="quote-concept-name">Concepto {i+1}<textarea rows={2} maxLength={2000} value={c.descripcion} onChange={e => change({ conceptos: form.conceptos.map(x => x.id === c.id ? { ...x, descripcion: e.target.value } : x) })}/></label>
            <label className="quote-concept-name">Descripción detallada<textarea rows={2} maxLength={3000} value={c.detalle ?? ''} placeholder="Características, material incluido, montaje, horarios…" onChange={e => change({ conceptos: form.conceptos.map(x => x.id === c.id ? { ...x, detalle: e.target.value } : x) })}/></label>
            <label>Cantidad<input type="number" step="0.01" min="0.01" max="1000000" value={c.cantidad} onChange={e => change({ conceptos: form.conceptos.map(x => x.id === c.id ? { ...x, cantidad: Number(e.target.value) } : x) })}/></label>
            <label>Precio sin IVA<input type="number" step="0.01" min="0" max="10000000" placeholder="Pendiente" value={c.precio ?? ''} onChange={e => change({ conceptos: form.conceptos.map(x => x.id === c.id ? { ...x, precio: e.target.value === '' ? null : Number(e.target.value) } : x) })}/></label>
            <label>Descuento por unidad<input type="number" step="0.01" min="0" max={c.precio ?? undefined} value={c.descuento ?? 0} onChange={e => change({ conceptos: form.conceptos.map(x => x.id === c.id ? { ...x, descuento: Number(e.target.value) } : x) })}/></label>
            <AppleSwitch size="sm" label="Incluido" checked={c.incluido ?? false} disabled={!writable || busy} onCheckedChange={included => change({ conceptos: form.conceptos.map(x => x.id === c.id ? { ...x, incluido: included } : x) })}/>
            {writable && <button type="button" aria-label={`Eliminar concepto ${i+1}`} className="quote-remove" onClick={() => change({ conceptos: form.conceptos.filter(x => x.id !== c.id) })}><Trash2 size={16}/></button>}
          </fieldset>)}
          {writable && <Button2 disabled={busy || form.conceptos.length >= 100} icon={<Plus size={15}/>} onClick={() => change({ conceptos: [...form.conceptos, { id: crypto.randomUUID(), descripcion: '', cantidad: 1, precio: null }] })}>Añadir concepto</Button2>}
          <fieldset disabled={!writable || busy} className="quotes-fields quotes-bottom-fields"><label>IVA (%)<input type="number" min="0" max="100" step="0.01" value={form.iva} onChange={e => change({ iva: Number(e.target.value) })}/></label><label>Estado<select value={form.estado} onChange={e => change({ estado: e.target.value as PresupuestoContenido['estado'] })}>{Object.entries(estados).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><label className="quotes-full">Condiciones y observaciones<textarea rows={4} maxLength={10000} placeholder="Forma de pago, montaje, horarios, servicios incluidos…" value={form.notas} onChange={e => change({ notas: e.target.value })}/></label></fieldset>
        </section>

      </div>
      <div className="quotes-side-column">        <section className="quotes-panel quote-photo-editor"><div className="quotes-section-title"><span>04</span><h2>Foto del montaje</h2></div>
          <p className="quotes-help">Aparecerá a la izquierda, en un bloque amplio y proporcionado. Si necesita más espacio, continuará en la página siguiente. JPG, PNG o WebP, hasta 10 MB.</p>
          {writable && <label>Seleccionar foto<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || photoBusy} onChange={e => { void selectPhoto(e.target.files?.[0]); e.target.value=''; }}/></label>}
          {photoBusy && <p role="status">Preparando la foto…</p>}
          {form.fotoMontaje && <figure className="quote-montaje"><img src={form.fotoMontaje.dataUrl} alt="Foto del montaje incluida en el presupuesto"/><figcaption>{form.fotoMontaje.nombre}</figcaption>{writable && <Button2 disabled={busy || photoBusy} variant="ghost" onClick={() => change({fotoMontaje:undefined})}>Quitar foto</Button2>}</figure>}
          <p className="quotes-help">La foto se guarda al pulsar «Guardar presupuesto».</p>
        </section><aside className="quotes-panel quotes-summary" aria-label="Resumen del presupuesto"><p className="quotes-eyebrow">{editing ? referenciaPresupuesto(editing) : 'Nuevo presupuesto'}</p><h2>{form.titulo || 'Tu propuesta'}</h2><p>{form.cliente || 'Cliente pendiente'}</p><div className="quote-summary-rule"/><span>Total sin IVA{totals!.pendientes > 0 ? ' · parcial' : ''}</span><strong className="quote-total"><FinancialDigits value={dinero(totals!.base)}/></strong><dl><div><dt>IVA ({form.iva}%)</dt><dd>{dinero(totals!.iva)}</dd></div><div><dt>Total con IVA</dt><dd>{dinero(totals!.total)}</dd></div></dl>{totals!.pendientes > 0 && <p className="quotes-help">{totals!.pendientes} concepto(s) con precio pendiente.</p>}<div className="quotes-actions">{writable && <Button2 loading={busy || photoBusy} variant="primary" onClick={() => void save()}>Guardar presupuesto</Button2>}<Button2 disabled={busy || photoBusy} icon={<Download size={16}/>} onClick={() => void pdf()}>Descargar PDF</Button2>{editing && canDelete && <Button2 disabled={busy || photoBusy} variant="ghost" onClick={() => remove(editing)}>Eliminar presupuesto</Button2>}</div><p className="quotes-help">Numeración automática y única. Borrador recuperable en este navegador. Guardar lo guarda en la app; el PDF queda archivado al descargarlo.</p></aside></div>
    </div>}
  </div>;
}
