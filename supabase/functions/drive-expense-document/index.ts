import {createClient} from 'npm:@supabase/supabase-js@2.107.0';
import {serve,json} from '../_shared/http.ts';
import {obtenerAccessToken,obtenerTokenOAuth} from '../drive-sync/googleDrive.ts';
serve(async req=>{
 const url=Deno.env.get('SUPABASE_URL')!;
 const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')??''}}});
 const {data:{user},error}=await caller.auth.getUser();
 if(error||!user)return json({error:'Sesión no válida.'},401);
 const {data:admin}=await caller.rpc('is_admin',{p_user_id:user.id});
 if(admin!==true)return json({error:'Solo un administrador puede leer los importes.'},403);
 const {fileId}=await req.json();
 if(typeof fileId!=='string'||! /^[\w-]+$/.test(fileId))return json({error:'Documento no válido.'},400);
 // Only catalogued expense documents, never arbitrary Drive IDs supplied by the browser.
 const {data:file}=await caller.from('drive_invoice_files').select('id,mime_type,actualizado_en').eq('id',fileId).eq('tipo','recibida').maybeSingle();
 if(!file)return json({error:'El documento no pertenece al archivo de gastos.'},404);
 if(!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.mime_type))return json({error:'Formato no compatible con la lectura automática.'},422);
 const refresh=Deno.env.get('GOOGLE_REFRESH_TOKEN'),sa=Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
 if(!refresh&&!sa)return json({error:'Falta conectar Google Drive al servidor.'},503);
 const token=refresh?await obtenerTokenOAuth(Deno.env.get('GOOGLE_CLIENT_ID')!,Deno.env.get('GOOGLE_CLIENT_SECRET')!,refresh):await obtenerAccessToken(JSON.parse(sa!),'https://www.googleapis.com/auth/drive.readonly');
 const headers={Authorization:`Bearer ${token}`};
 const meta=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime,size&supportsAllDrives=true`,{headers});
 if(!meta.ok)return json({error:'No se pudo consultar el documento de Drive.'},502);
 const info=await meta.json();
 if(new Date(info.modifiedTime).getTime()!==new Date(file.actualizado_en).getTime())return json({error:'El documento ha cambiado. Actualiza Drive antes de leerlo.'},409);
 if(Number(info.size)>20*1024*1024)return json({error:'El documento supera 20 MB. Revisa sus importes manualmente.'},422);
 const response=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,{headers});
 if(!response.ok)return json({error:'No se pudo descargar el documento de Drive.'},502);
 return new Response(response.body,{headers:{'Content-Type':file.mime_type==='application/pdf'?'application/pdf':'application/octet-stream','Cache-Control':'no-store'}});
});
