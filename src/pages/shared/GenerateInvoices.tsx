import {REAL_MADRID_REFERENCE,matchInvoiceDescription} from '../../lib/realMadridInvoice';
import {billingProfiles} from '../../lib/billingProfiles';
import {useEliminarFactura} from '../../hooks/useEliminarFactura';
import {EliminarFacturaButton} from '../../components/facturacion/EliminarFacturaButton';
import {useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useStore} from '../../store/useStore';
import {useAuthStore} from '../../store/useAuthStore';
import {useLocalDraft} from '../../hooks/useLocalDraft';
import {useConfirmStore} from '../../store/useConfirmStore';
import {supabase} from '../../lib/supabase';
import {db} from '../../lib/db';
import {syncInvoice} from '../../lib/invoiceSync';
import {generarFacturaPdf} from '../../lib/facturaPdf';
import {resolverEmisorParaLinea,porcentajePendienteDeFacturar} from '../../lib/facturacion';
import {lineaDeIngreso,lineaDeFactura} from '../../lib/contabilidad';
import {BUSINESS_LINES,LINEA_IDS,type LineaId} from '../../config/businessLines';
import {invoiceAmounts,newInvoiceConcept,serializeConcepts,parseConcepts,conceptAmount,roundMoney as round,type InvoiceConcept} from '../../lib/invoiceConcepts';
import type {Factura} from '../../types';
import {Btn as Button,PageHeader,Widget,Pill} from '../../components/kit';
import {RowMenu2} from '../../components/ui2/RowMenu';
import {Modal} from '../../components/ui/Modal';
import {GenerarFacturaModal} from '../../components/facturacion/GenerarFacturaModal';
import {VerPdfFacturaButton} from '../../components/facturacion/VerPdfFacturaButton';
const coalesceSerie=(s?:string)=>s??'';
const emptyClient=()=>({nombre:'',nifCif:'',direccion:'',email:'',telefono:'',referenciaFactura:''});
const fresh=(linea?:LineaId)=>({id:crypto.randomUUID() as string,cliente:{...emptyClient(),...(linea==='real_madrid'?{nombre:'Real Madrid',referenciaFactura:REAL_MADRID_REFERENCE}:{})},partido:'',conceptos:[newInvoiceConcept()],iva:21,fecha:new Date().toISOString().slice(0,10),notas:'',linked:'',fechaEvento:'',numeroSolicitado:''});
const fromInvoice=(f:Factura)=>({id:f.id,partido:'',cliente:{...emptyClient(),...(f.clienteSnapshot??f.clienteBorrador),nombre:f.clienteSnapshot?.nombre||f.clienteBorrador?.nombre||f.cliente},conceptos:parseConcepts(f.concepto)??[{...newInvoiceConcept(),descripcion:f.concepto,precio:f.baseImponible}],iva:f.porcentajeIVA,fecha:f.fecha,notas:f.notas??'',linked:'',fechaEvento:f.fechaEvento??'',numeroSolicitado:(f.numeroSecuencial??f.numeroSolicitado)?.toString()??''});
export function GenerateInvoices({linea}:{linea?:LineaId}){
 const [params]=useSearchParams();const requested=params.get('borrador');
 const visible=useAuthStore(s=>s.lineasVisibles()),userId=useAuthStore(s=>s.user?.id);
 const [selected,setSelected]=useState<LineaId>(linea??visible[0]??'montada_sound');
 const active=linea??selected;
 return <div className="space-y-5">{!linea&&<label className="block text-sm">Línea de negocio<select className="input-form max-w-sm" value={selected} onChange={e=>setSelected(e.target.value as LineaId)}>{LINEA_IDS.filter(l=>visible.includes(l)).map(l=><option key={l} value={l}>{BUSINESS_LINES[l].label}</option>)}</select></label>}{visible.includes(active)&&<InvoiceWorkspace key={`${userId}:${active}`} linea={active} requested={requested}/>}</div>;
}
function InvoiceWorkspace({linea,requested}:{linea:LineaId;requested:string|null}){
 const facturas=useStore(s=>s.facturas),emisores=useStore(s=>s.emisores),map=useStore(s=>s.proyectoEmisorMap);
 const canCreate=useAuthStore(s=>s.canEmitirFacturas()&&s.canCreateLinea(linea)),canEdit=useAuthStore(s=>s.canEmitirFacturas()&&s.canEditLinea(linea)),canDelete=useAuthStore(s=>s.canDeleteLinea(linea));
 const confirm=useConfirmStore(s=>s.show);
 const userId=useAuthStore(s=>s.user?.id);
 const [restoring,setRestoring]=useState(false);
 const [editor,setEditor]=useState<string|null>(requested),[pdf,setPdf]=useState(''),[error,setError]=useState('');
 const deletion=useEliminarFactura();
 const invoices=facturas.filter(f=>f.tipo==='emitida'&&lineaDeFactura(f)===linea).sort((a,b)=>b.fecha.localeCompare(a.fecha)||(b.numeroSecuencial??0)-(a.numeroSecuencial??0));
 useEffect(()=>()=>{if(pdf)URL.revokeObjectURL(pdf);},[pdf]);
 const openInvoice=(f:Factura)=>{
  if(!f.ocultaEn){setEditor(f.id);return;}
  if(!canEdit||restoring)return;
  confirm(`¿Restaurar la factura ${f.numero} para editarla? Mantendrá su número y sus datos.`,async()=>{
   setRestoring(true);setError('');try{
    const {error:e}=await supabase.rpc('restaurar_factura_generada',{p_id:f.id});if(e)throw e;
    const updated=await db.facturas.getById(f.id);
    if(useAuthStore.getState().user?.id!==userId)return;
    useStore.setState(s=>({facturas:s.facturas.map(x=>x.id===f.id?updated:x)}));setEditor(f.id);
   }catch(e){setError(e&&typeof e==='object'&&'message' in e?String(e.message):'No se pudo restaurar la factura.');}finally{setRestoring(false);}
  },{title:'Restaurar factura',confirmLabel:'Restaurar y editar'});
 };

 const showPdf=(f:Factura,download=false)=>{setError('');try{
  const emisor=f.numeroSecuencial!=null?f.emisorSnapshot:resolverEmisorParaLinea(emisores,map,linea);
  if(!emisor)throw Error('Esta factura no tiene datos fiscales del emisor para generar el PDF.');
  const doc=generarFacturaPdf({factura:f,configuracionFiscal:emisor,cliente:{...emptyClient(),...(f.clienteSnapshot??f.clienteBorrador),nombre:f.cliente}});
  if(download)doc.save(`Factura-${f.numero||'borrador'}.pdf`);else setPdf(URL.createObjectURL(doc.output('blob')));
 }catch(e){setError(e instanceof Error?e.message:'No se pudo generar el PDF.');}};
 return <>
  <PageHeader title="Facturas"><Button size="lg" variant="primary" disabled={!canCreate} onClick={()=>setEditor('nuevo')}>Crear factura</Button></PageHeader>
  {(error||deletion.error)&&<p role="alert" className="text-red-700">{error||deletion.error}</p>}
  <Widget pad={false}><ul className="divide-y divide-black/5" aria-label="Facturas de la línea">{invoices.map(f=><li key={f.id} className="flex items-center gap-3 p-4 sm:p-5">
   <button className="min-w-0 flex-1 text-left" disabled={restoring} onClick={()=>openInvoice(f)} aria-label={`Abrir ${f.numeroSecuencial!=null?'factura '+f.numero:'borrador'} · ${f.cliente}`}><strong className="block break-words">{f.numero||(f.numeroSolicitado?'Borrador · nº solicitado '+f.numeroSolicitado:'Borrador')} · {f.cliente}</strong><span className="text-sm text-gray-500">{f.fecha}</span></button>
   <div className="text-right space-y-1"><strong className="block tabular-nums">{f.total.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</strong><div className="flex flex-wrap justify-end gap-1">{f.ocultaEn&&<Pill>Archivada</Pill>}<Pill tone={f.numeroSecuencial==null?'neutral':f.pagada?'positive':'info'}>{f.numeroSecuencial==null?'Borrador':f.pagada?'Cobrada':'Emitida'}</Pill>{f.driveFileId&&<Pill>En Drive</Pill>}</div></div>
   <RowMenu2 label={`Opciones de factura ${f.numero||f.cliente}`} actions={[...(canEdit?[{label:f.ocultaEn?'Restaurar y editar':'Editar',onClick:()=>openInvoice(f)}]:[]),{label:'Ver PDF',onClick:()=>showPdf(f)},{label:'Descargar PDF',onClick:()=>showPdf(f,true)},...(canDelete&&!f.ocultaEn?[{label:'Eliminar',danger:true,onClick:()=>{if(!deletion.busy)deletion.remove(f);}}]:[])]}/>
  </li>)}</ul>{!invoices.length&&<p className="p-6 text-gray-500">Todavía no hay facturas en esta línea.</p>}</Widget>
  {editor!==null&&<InvoiceForm key={editor} linea={linea} requested={editor==='nuevo'?null:editor} onClose={()=>setEditor(null)}/>}
  <Modal isOpen={!!pdf} title="Vista previa de factura" size="xl" onClose={()=>setPdf('')}><iframe title="PDF de factura" src={pdf} className="w-full h-[65vh]"/></Modal>
 </>;
}
function InvoiceForm({linea,requested,onClose}:{linea:LineaId;requested:string|null;onClose:()=>void}){
 const canNumber=useAuthStore(s=>s.canGestionarNumeracion());
 const user=useAuthStore(s=>s.user),allowed=useAuthStore(s=>s.canEmitirFacturas()&&(requested?s.canEditLinea(linea):s.canCreateLinea(linea))),canEdit=useAuthStore(s=>s.canEditLinea(linea)),canDelete=useAuthStore(s=>s.canDeleteLinea(linea));
 const facturas=useStore(s=>s.facturas),ingresos=useStore(s=>s.ingresos),emisores=useStore(s=>s.emisores),map=useStore(s=>s.proyectoEmisorMap),confirm=useConfirmStore(s=>s.show);
 const savedClients=billingProfiles(facturas);
 const emisor=resolverEmisorParaLinea(emisores,map,linea),pendingKey=`mi-espacio:factura-libre:${user?.id}:${linea}`;
 const [draft,setDraft,draftError]=useLocalDraft(`mi-espacio:factura-editor:${user?.id}:${linea}:${requested??'nuevo'}`,()=>{const existing=facturas.find(f=>f.id===requested&&lineaDeFactura(f)===linea);if(existing)return fromInvoice(existing);const d=fresh(linea);if(linea==='real_madrid'){const saved=savedClients.find(c=>/real madrid/i.test(c.nombre));if(saved)d.cliente={...d.cliente,nombre:saved.nombre,nifCif:saved.nifCif,direccion:saved.direccion,email:saved.email,telefono:saved.telefono};}try{d.id=localStorage.getItem(pendingKey)||d.id;}catch{/* storage warning handled by draft hook */}return d;});
 const {id,cliente,conceptos,iva,fecha,notas,linked}=draft;
 const fechaEvento=draft.fechaEvento??'',numeroSolicitado=draft.numeroSolicitado??'';
 const [uploadOffer,setUploadOffer]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preview,setPreview]=useState('');const working=useRef(false);
 const current=facturas.find(f=>f.id===id),issued=current?.numeroSecuencial!=null?current:null;
 const {base:totalBase,tax,total,suplidos}=invoiceAmounts(conceptos,iva),income=ingresos.find(i=>i.id===linked);
 const patch=(p:Partial<typeof draft>)=>{setPreview('');setDraft(d=>({...d,...p}));};
 const changeConcept=(index:number,p:Partial<InvoiceConcept>)=>patch({conceptos:conceptos.map((c,i)=>i===index?{...c,...p}:c)});
 const prepareMatch=()=>{setError('');try{const detalle=matchInvoiceDescription(fechaEvento,draft.partido??'');const first=conceptos[0]??newInvoiceConcept();patch({cliente:{...cliente,referenciaFactura:cliente.referenciaFactura||REAL_MADRID_REFERENCE},conceptos:[{...first,descripcion:first.descripcion||'Servicio para partido',detalle},...conceptos.slice(1)]});}catch(e){setError(e instanceof Error?e.message:'Revisa la fecha y el partido.');}};
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 const build=():Factura=>({id,area:linea==='montada_sound'?'montada':'dj',lineaNegocio:linea,tipo:'emitida',numero:'',cliente:cliente.nombre.trim(),concepto:serializeConcepts(conceptos),baseImponible:totalBase,porcentajeIVA:iva,importeIVA:tax,total,fecha,fechaEvento,numeroSolicitado:numeroSolicitado?Number(numeroSolicitado):undefined,pagada:false,ivaDeducible:false,notas,estado:'borrador',porcentajeFacturado:100,syncEstado:'sin_sincronizar',emitidaPor:user?.id,clienteBorrador:cliente});
 const validate=(emitting=true)=>{
  if(issued&&!numeroSolicitado)throw Error('Indica el número de factura.');
  if(numeroSolicitado&&((!canNumber&&Number(numeroSolicitado)!==issued?.numeroSecuencial)||!Number.isSafeInteger(Number(numeroSolicitado))||Number(numeroSolicitado)<=0))throw Error('Indica un número entero positivo; necesitas permiso de numeración.');
  if(numeroSolicitado&&facturas.some(f=>f.id!==id&&f.numeroSecuencial===Number(numeroSolicitado)&&f.emisorId===(issued?.emisorId??emisor?.id??'default')&&coalesceSerie(f.serie)===coalesceSerie(issued?.serie??emisor?.serieFormato)))throw Error('Ese número pertenece a otra factura del listado. Abre esa factura para editarla o restaurarla.');
  if(!cliente.nombre.trim()||!fecha||!conceptos.length||conceptos.some(c=>!c.descripcion.trim()||!Number.isFinite(c.cantidad)||c.cantidad<=0||!Number.isFinite(c.precio)||c.precio<0||!Number.isFinite(c.descuento)||c.descuento<0||c.descuento>c.precio||round(c.precio)!==c.precio||round(c.descuento)!==c.descuento)||!Number.isFinite(totalBase)||total<=0)throw Error('Completa cliente, fecha y conceptos con cantidades positivas y precios válidos.');
  if(emitting&&(!cliente.nifCif.trim()||!cliente.direccion.trim()))throw Error('Completa el NIF/CIF y la dirección fiscal del cliente.');
  if(emitting&&!issued&&(!emisor?.razonSocial||!emisor.nifCif||!emisor.direccionFiscal))throw Error('No hay emisor fiscal completo asignado a esta línea.');
 };
 const store=(f:Factura)=>{if(useAuthStore.getState().user?.id===user?.id)useStore.setState(s=>({facturas:[...s.facturas.filter(x=>x.id!==f.id),f]}));};
  const save=async()=>{if(working.current)return;working.current=true;setBusy(true);setError('');try{
  if(!allowed||(current&&!canEdit))throw Error('Sin permiso para guardar este borrador.');validate(false);
  const f=build();if(current){const remote=await db.facturas.getById(id);if(remote.numeroSecuencial!=null){store(remote);throw Error('La factura ya está emitida. Puedes abrirla desde el archivo.');}await db.facturas.upsert(f);}else await db.facturas.insertIfMissing(f);
  store(await db.facturas.getById(id));setNotice('Borrador guardado en la app. Puedes abrirlo, editarlo o eliminarlo desde el listado.');
 }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el borrador.');}finally{working.current=false;setBusy(false);}};
 const emit=async()=>{if(working.current)return;working.current=true;setBusy(true);setError('');try{
  if(!allowed)throw Error('Sin permiso de emisión para esta línea.');validate();localStorage.setItem(pendingKey,id);const f=build();await db.facturas.insertIfMissing(f);
  if(useAuthStore.getState().user?.id!==user?.id)throw Error('La sesión ha cambiado. Vuelve a abrir el borrador.');
  const {error:e}=await supabase.rpc('emitir_factura_independiente',{p_factura_id:id,p_area:f.area,p_tipo:'emitida',p_cliente:f.cliente,p_concepto:f.concepto,p_base_imponible:f.baseImponible,p_porcentaje_iva:iva,p_importe_iva:tax,p_total:total,p_fecha:fecha,p_ingreso_id:null,p_porcentaje_facturado:100,p_notas:notas||null,p_datos_cliente:cliente,p_numero_solicitado:numeroSolicitado?Number(numeroSolicitado):null,p_fecha_evento:fechaEvento||null});if(e)throw e;
  const result=await db.facturas.getById(id);if(!result.numeroSecuencial)throw Error('No se pudo confirmar el número. Reintenta el mismo intento.');store(result);setDraft(fromInvoice(result));localStorage.removeItem(pendingKey);
  try{store(await syncInvoice(result));setNotice(`Factura ${result.numero} emitida y subida a Drive.`);}catch{setNotice(`Factura ${result.numero} emitida. La subida a Drive queda pendiente; puedes reintentar desde Facturas sin emitir otra.`);}
 }catch(e){setError(e instanceof Error?e.message:'No se pudo emitir. Conservamos el intento para reintentarlo.');}finally{setBusy(false);working.current=false;}};
 const showPreview=()=>{setError('');try{validate();setPreview(URL.createObjectURL(generarFacturaPdf({factura:{...build(),numero:numeroSolicitado?`${numeroSolicitado} · VISTA PREVIA`:'BORRADOR · SIN EMITIR'},configuracionFiscal:emisor,cliente}).output('blob')));}catch(e){setError(e instanceof Error?e.message:'Revisa los campos');}};
 const close=()=>{if(busy)return;if(issued&&!requested){try{localStorage.removeItem(`mi-espacio:factura-editor:${user?.id}:${linea}:nuevo`);}catch{/* no persistent draft available */}}onClose();};
 const saveIssued=()=>{
  setError('');try{if(!allowed||!canEdit||!issued)throw Error('Sin permiso para editar esta factura.');validate();}catch(e){setError(e instanceof Error?e.message:'Revisa los campos.');return;}
  confirm('Esta factura ya está emitida. Si ya la enviaste al cliente o está en Drive, tendrás que volver a enviarla y subirla.',async()=>{
   if(working.current)return;working.current=true;setBusy(true);setError('');
   try{
    const {error:e}=await supabase.rpc('editar_factura_emitida',{p_id:id,p_numero:Number(numeroSolicitado),p_fecha:fecha,p_fecha_evento:fechaEvento||null,p_cliente:cliente.nombre.trim(),p_concepto:serializeConcepts(conceptos),p_base_imponible:totalBase,p_porcentaje_iva:iva,p_importe_iva:tax,p_total:total,p_notas:notas||null,p_datos_cliente:cliente});
    if(e)throw e;const updated=await db.facturas.getById(id);store(updated);setDraft(fromInvoice(updated));setUploadOffer(!!issued.driveFileId);setPreview('');setNotice('Cambios guardados.');
   }catch(e){setError(e&&typeof e==='object'&&'message' in e?String(e.message):'No se pudieron guardar los cambios.');}finally{working.current=false;setBusy(false);}
  },{title:'Guardar cambios',confirmLabel:'Guardar cambios'});
 };
 const upload=async()=>{if(working.current||!issued)return;working.current=true;setBusy(true);setError('');try{const updated=await syncInvoice(await db.facturas.getById(id));store(updated);setUploadOffer(false);setNotice('PDF corregido subido a Drive.');}catch(e){setError(e instanceof Error?e.message:'No se pudo subir el PDF. Los cambios están guardados.');}finally{working.current=false;setBusy(false);}};
 return <Modal isOpen size="xl" title={issued?`Factura ${issued.numero}`:requested?'Editar borrador':'Crear factura'} onClose={close}><div className="space-y-5">{draftError&&<p role="alert">{draftError}</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <div className="finance-card p-5 grid sm:grid-cols-2 gap-4"><label>{issued?'Número de factura':'Numeración solicitada (opcional)'}<input className="input-form" aria-label={issued?'Número de factura':'Numeración solicitada (opcional)'} type="number" min="1" step="1" placeholder="Automática" disabled={busy||!canNumber||!allowed} value={numeroSolicitado} onChange={e=>patch({numeroSolicitado:e.target.value})}/><span className="text-xs text-gray-500">{issued?'Puedes cambiar el número si no pertenece a otra factura.':'Si lo dejas vacío, sigue la numeración. Para usar una factura archivada, ábrela desde el listado.'}</span></label>{!issued&&numeroSolicitado&&<Button onClick={()=>{patch({numeroSolicitado:''});setError('');}}>Usar numeración automática</Button>}<label>Fecha del evento<input className="input-form" type="date" disabled={busy||!allowed} value={fechaEvento} onChange={e=>patch({fechaEvento:e.target.value})}/></label></div>
 {!issued&&<label className="block text-sm max-w-2xl">Relacionar con un ingreso (opcional)<select className="input-form" disabled={busy} value={linked} onChange={e=>patch({linked:e.target.value})}><option value="">Sin ingreso relacionado · crear factura independiente</option>{ingresos.filter(i=>lineaDeIngreso(i)===linea&&porcentajePendienteDeFacturar(facturas,i.id)>0).map(i=><option key={i.id} value={i.id}>{i.cliente} · {i.concepto}</option>)}</select></label>}{!issued&&income&&<GenerarFacturaModal ingreso={income} onClose={()=>patch({linked:''})}/>}
 <fieldset disabled={busy||!allowed||!!income} className="space-y-4"><div className="grid md:grid-cols-2 gap-4"><div className="finance-card p-5"><h2 className="font-semibold mb-3">Emisor</h2><p>{(issued?.emisorSnapshot??emisor)?.razonSocial}</p><p>{(issued?.emisorSnapshot??emisor)?.nifCif}</p><p>{(issued?.emisorSnapshot??emisor)?.direccionFiscal}</p></div><div className="finance-card p-5 space-y-3"><h2 className="font-semibold">Datos fiscales del cliente</h2><label className="block text-sm">Empresa / cliente guardado<select aria-label="Empresa / cliente guardado" className="input-form" value="" onChange={e=>{const c=savedClients.find(x=>x.key===e.target.value);if(c)patch({cliente:{...cliente,nombre:c.nombre,nifCif:c.nifCif,direccion:c.direccion,email:c.email,telefono:c.telefono}});}}><option value="">Selecciona para rellenar sus datos</option>{savedClients.map(c=><option key={c.key} value={c.key}>{c.nombre} · {c.nifCif||'Sin NIF'}</option>)}</select></label><p className="text-xs text-gray-500">Los datos se conservan al guardar el borrador o emitir la factura.</p>{(['nombre','referenciaFactura','nifCif','direccion','email','telefono'] as const).map(k=><label className="block text-sm" key={k}>{{nombre:'Nombre / razón social',referenciaFactura:'Referencia del cliente / nº de pedido (opcional)',nifCif:'NIF/CIF',direccion:'Dirección fiscal',email:'Email',telefono:'Teléfono'}[k]}<input className="input-form" type="text" maxLength={k==='referenciaFactura'?250:undefined} value={cliente[k]??''} onChange={e=>patch({cliente:{...cliente,[k]:e.target.value}})}/></label>)}</div></div>
 {linea==='real_madrid'&&<div className="finance-card p-5 space-y-3"><h2 className="font-semibold">Factura del partido</h2><label className="block">Partido<input className="input-form" placeholder="Real Madrid vs Málaga" value={draft.partido??''} onChange={e=>patch({partido:e.target.value})}/></label><p className="text-xs text-gray-500">Usa la fecha del evento indicada arriba. Rellena la descripción del primer concepto; puedes editarla después.</p><Button onClick={prepareMatch}>Rellenar descripción del partido</Button></div>}
 <div className="finance-card p-5 space-y-4"><h2 className="font-semibold">Conceptos</h2>{conceptos.map((c,i)=><div key={c.id} className="grid sm:grid-cols-4 gap-3 border-b pb-4"><label className="sm:col-span-4">Concepto {i+1}<textarea className="input-form" value={c.descripcion} onChange={e=>changeConcept(i,{descripcion:e.target.value})}/></label><label className="sm:col-span-4">Descripción {i+1}<textarea className="input-form" rows={3} placeholder="Detalla el producto o servicio…" value={c.detalle??''} onChange={e=>changeConcept(i,{detalle:e.target.value})}/></label><label className="sm:col-span-4 flex items-center gap-2"><input type="checkbox" aria-label={`Suplido ${i+1}`} checked={!!c.suplido} onChange={e=>changeConcept(i,{suplido:e.target.checked})}/>Suplido · sin IVA</label><label>Cantidad<input className="input-form" aria-label={`Cantidad ${i+1}`} type="number" min="0.01" step="0.01" value={c.cantidad} onChange={e=>changeConcept(i,{cantidad:Number(e.target.value)})}/></label><label>Precio sin IVA<input className="input-form" aria-label={`Precio ${i+1}`} type="number" min="0" step="0.01" value={c.precio} onChange={e=>changeConcept(i,{precio:Number(e.target.value)})}/></label><label>Descuento por unidad<input className="input-form" aria-label={`Descuento ${i+1}`} type="number" min="0" step="0.01" value={c.descuento} onChange={e=>changeConcept(i,{descuento:Number(e.target.value)})}/></label><div><p>{conceptAmount(c).toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions)}</p><Button onClick={()=>patch({conceptos:conceptos.filter((_,n)=>n!==i)})}>Quitar concepto {i+1}</Button></div></div>)}<Button disabled={conceptos.length>=100} onClick={()=>patch({conceptos:[...conceptos,newInvoiceConcept()]})}>Añadir concepto</Button>
 <div className="grid sm:grid-cols-2 gap-4"><label>Fecha de emisión<input type="date" className="input-form" value={fecha} onChange={e=>patch({fecha:e.target.value})}/></label><label>IVA<select className="input-form" value={iva} onChange={e=>patch({iva:Number(e.target.value)})}>{[0,4,10,21].map(v=><option key={v} value={v}>{v}%</option>)}</select></label><label className="sm:col-span-2">Observaciones<textarea className="input-form" value={notas} onChange={e=>patch({notas:e.target.value})}/></label></div><p>Total sin IVA: {totalBase.toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions)}</p><p>IVA: {tax.toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions)}</p>{suplidos>0&&<p>Suplidos (sin IVA): {suplidos.toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions)}</p>}<p className="text-xl font-semibold">Total con IVA: {total.toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions)}</p></div></fieldset>
 <div className="flex flex-wrap gap-3">{issued?<>
 <Button variant="primary" disabled={busy||!allowed||!canEdit} onClick={saveIssued}>{busy?'Guardando…':'Guardar cambios'}</Button>
 {uploadOffer&&<Button disabled={busy} onClick={()=>void upload()}>Volver a subir a Drive</Button>}
 <VerPdfFacturaButton key={`${issued.numero}:${issued.historial?.length}`} factura={issued}/>
 </>:<><Button disabled={busy||!allowed||!!income} onClick={save}>Guardar borrador</Button><Button disabled={busy||!allowed||!!income} onClick={showPreview}>Vista previa</Button><Button variant="primary" disabled={busy||!allowed||!!income} onClick={emit}>{busy?'Guardando…':'Emitir factura'}</Button></>}
 {current&&canDelete&&<EliminarFacturaButton factura={current} disabled={busy} onDeleted={close}/>}
 <Button disabled={busy} onClick={close}>Cerrar editor</Button></div>
 {preview&&<iframe title="Vista previa de factura" src={preview} className="w-full h-96 border rounded-xl"/>}
 </div></Modal>;
}
