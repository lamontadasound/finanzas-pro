import {createClient} from 'npm:@supabase/supabase-js@2.107.0';
import {serve,json} from '../_shared/http.ts';
import {validateUserInput} from '../_shared/permissions.ts';
serve(async req=>{
 const url=Deno.env.get('SUPABASE_URL')!;
 const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')??''}}});
 const {data:{user},error:authError}=await caller.auth.getUser();
 if(authError||!user)return json({error:'Sesión no válida.'},401);
 const {data:admin}=await caller.rpc('is_admin',{p_user_id:user.id});
 if(admin!==true)return json({error:'No tienes permiso para invitar usuarios.'},403);
 const body=await req.json();const invalid=validateUserInput(body);if(invalid)return json({error:invalid},400);
 const redirect=Deno.env.get('APP_URL')??'https://finanzas-pro10.vercel.app';if(!redirect)return json({error:'Falta configurar la dirección de la aplicación.'},503);
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data,error}=await service.auth.admin.inviteUserByEmail(body.email.trim().toLowerCase(),{redirectTo:redirect+'/reset-password',data:{nombre:body.nombre.trim()}});
 if(error||!data.user)return json({error:'No se pudo invitar. Comprueba si esa cuenta ya existe.'},400);
 const {error:saveError}=await caller.rpc('admin_save_user',{p_user_id:data.user.id,p_nombre:body.nombre,p_rol:body.rol,p_activo:true,p_lineas:body.permisosLineas,p_modulos:body.permisosModulos,p_facturacion:body.permisosFacturacion});
 if(saveError){
  const {error:cleanup}=await service.auth.admin.deleteUser(data.user.id);
  return json({error:cleanup?'La cuenta se creó pero no se completó el perfil. Requiere revisión administrativa.':'No se guardaron los permisos. Se retiró la cuenta incompleta; la invitación enviada ya no permite acceder.'},500);
 }
 return json({ok:true,userId:data.user.id});
});
