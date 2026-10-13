import {createClient} from 'npm:@supabase/supabase-js@2.107.0';
import {serve,json} from '../_shared/http.ts';
import {obtenerAccessToken,obtenerTokenOAuth,generarFileId,archivoPorId,subirArchivo} from './googleDrive.ts';
serve(async req=>{
 const url=Deno.env.get('SUPABASE_URL')!;
 const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')??''}}});
 const {data:{user},error:authError}=await caller.auth.getUser();
 if(authError||!user)return json({error:'Sesión no válida.'},401);
 const body=await req.json();
 if(!body||typeof body.facturaId!=='string'||body.facturaId.length>150)return json({error:'Factura inválida.'},400);
 const {data:allowed,error:permissionError}=await caller.rpc('puede_sincronizar_factura',{p_factura_id:body.facturaId});
 if(permissionError||allowed!==true)return json({error:'No tienes permiso para sincronizar esta factura.'},403);
 const {data:invoice,error:invoiceError}=await caller.from('facturas').select('id,numero,tipo,fecha,numero_secuencial,drive_file_id,drive_folder_id,drive_link').eq('id',body.facturaId).single();
 if(invoiceError||!invoice)return json({error:'Factura no disponible.'},404);
 if(invoice.tipo!=='emitida')return json({error:'Las facturas de gastos se consultan únicamente desde Drive.'},403);
 if(invoice.drive_file_id)return json({fileId:invoice.drive_file_id,folderId:invoice.drive_folder_id,link:invoice.drive_link});
 if(body.accion==='buscar_existente')return json(null);
 if(body.accion!=='upload')return json({error:'Acción desconocida.'},400);
 if(invoice.tipo==='emitida'&&invoice.numero_secuencial===null)return json({error:'El borrador no se sincroniza como factura emitida.'},400);
 if(typeof body.contenidoBase64!=='string'||body.contenidoBase64.length>14_000_000||!['application/pdf','image/png','image/jpeg'].includes(body.mimeType))return json({error:'Formato no permitido o archivo mayor de 10 MB.'},400);
 let bytes:Uint8Array<ArrayBuffer>;try{bytes=Uint8Array.from(atob(body.contenidoBase64),c=>c.charCodeAt(0));}catch{return json({error:'Archivo inválido.'},400);}
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==body.contenidoHash||bytes.length===0)return json({error:'El contenido del archivo no coincide.'},400);
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const [year,month]=String(invoice.fecha).split('-').map(Number);
 const {data:monthly,error:folderError}=await service.from('drive_invoice_folders').select('id').eq('anio',year).eq('mes',month).eq('tipo',invoice.tipo).single();
 if(folderError||!monthly)return json({error:'No se encuentra la carpeta mensual de Drive. Actualiza el archivo de facturas antes de sincronizar.'},409);
 const folder=monthly.id;
 const refresh=Deno.env.get('GOOGLE_REFRESH_TOKEN');const sa=Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
 if(!refresh&&!sa)return json({error:'Conecta Google Drive para sincronizar tus facturas.'},503);
 const token=refresh?await obtenerTokenOAuth(Deno.env.get('GOOGLE_CLIENT_ID')!,Deno.env.get('GOOGLE_CLIENT_SECRET')!,refresh):await obtenerAccessToken(JSON.parse(sa!));

 const {data:pending,error:pendingError}=await service.from('drive_uploads').select('*').eq('factura_id',invoice.id).maybeSingle();
 if(pendingError)return json({error:'No se pudo comprobar la subida pendiente.'},500);
 const candidate=pending?.file_id??await generarFileId(token);
 const extension=body.mimeType==='application/pdf'?'pdf':body.mimeType==='image/png'?'png':'jpg';
 const name=`Factura ${String(invoice.numero||invoice.id).replace(/[^\p{L}\p{N}._-]/gu,'_')}.${extension}`;
 const {data:reservations,error:reserveError}=await service.rpc('reserve_drive_upload',{p_factura_id:invoice.id,p_actor:user.id,p_file_id:candidate,p_folder:folder,p_hash:hash,p_nombre:name});
 if(reserveError||!reservations?.[0])return json({error:'No se pudo reservar la subida. Comprueba si ya hay otro archivo para esta factura.'},409);
 const reservation=reservations[0];
 let remote=await archivoPorId(token,reservation.file_id);
 if(remote&&(remote.appProperties?.contenidoHash!==hash||remote.appProperties?.facturaId!==invoice.id||!remote.parents?.includes(reservation.folder_id)))return json({error:'El archivo remoto no coincide con esta factura.'},409);
 if(!remote){await subirArchivo(token,{fileId:reservation.file_id,carpetaId:reservation.folder_id,nombreArchivo:reservation.nombre,mimeType:body.mimeType,contenidoBase64:body.contenidoBase64,facturaId:invoice.id,contenidoHash:hash});remote=await archivoPorId(token,reservation.file_id);}
 if(!remote)return json({error:'No se pudo verificar la subida. Reintenta.'},502);
 const {error:completeError}=await service.rpc('complete_drive_upload',{p_factura_id:invoice.id,p_actor:user.id,p_file_id:reservation.file_id});
 if(completeError)return json({error:'Archivo subido; falta confirmar su registro. Reintenta para recuperar el mismo archivo.'},503);
 return json({fileId:reservation.file_id,folderId:reservation.folder_id,link:`https://drive.google.com/file/d/${reservation.file_id}/view`});
});
