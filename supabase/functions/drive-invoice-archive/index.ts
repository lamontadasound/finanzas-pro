import {createClient} from 'npm:@supabase/supabase-js@2.107.0';
import {serve,json} from '../_shared/http.ts';
import {obtenerAccessToken,obtenerTokenOAuth} from '../drive-sync/googleDrive.ts';
import {readArchive} from './catalog.ts';
serve(async req=>{
 const url=Deno.env.get('SUPABASE_URL')!;
 const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')??''}}});
 const {data:{user},error}=await caller.auth.getUser();if(error||!user)return json({error:'Sesión no válida.'},401);
 const {data:admin}=await caller.rpc('is_admin',{p_user_id:user.id});if(admin!==true)return json({error:'Solo un administrador puede actualizar el archivo.'},403);
 const refresh=Deno.env.get('GOOGLE_REFRESH_TOKEN'),sa=Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
 if(!refresh&&!sa)return json({error:'El archivo importado está disponible. Para actualizarlo automáticamente falta conectar Google Drive al servidor de la app.'},503);
 try{
 const token=refresh?await obtenerTokenOAuth(Deno.env.get('GOOGLE_CLIENT_ID')!,Deno.env.get('GOOGLE_CLIENT_SECRET')!,refresh):await obtenerAccessToken(JSON.parse(sa!),'https://www.googleapis.com/auth/drive.readonly');
 const archive=await readArchive(token,Deno.env.get('DRIVE_ARCHIVE_ROOT_ID')??'1CtKBXtEeBZdMSmo2bER5SODsF9NScpXC');
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {error:saveError}=await service.rpc('replace_drive_invoice_archive',{p_files:archive.files,p_folders:archive.folders});
 if(saveError)return json({error:'No se pudo guardar el archivo actualizado; reintenta.'},500);
 return json({ok:true,count:archive.files.length});
 }catch(e){return json({error:e instanceof Error?e.message:'No se pudo leer Drive.'},502);}
});
