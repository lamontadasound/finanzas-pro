import {createClient} from 'npm:@supabase/supabase-js@2.107.0';
import {deleteManagedUser} from '../_shared/delete-user.ts';
import {serve,json} from '../_shared/http.ts';
serve(async req=>{
 const url=Deno.env.get('SUPABASE_URL')!;
 const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')??''}}});
 const {data:{user},error:authError}=await caller.auth.getUser();
 if(authError||!user)return json({error:'Sesión no válida.'},401);
 const {data:admin}=await caller.rpc('is_admin',{p_user_id:user.id});
 if(admin!==true)return json({error:'No tienes permiso para administrar usuarios.'},403);
 const body=await req.json();
 if(!body||typeof body.userId!=='string'||body.userId===user.id)return json({error:'No puedes modificar tu propio acceso.'},400);
 const {data:target,error}=await caller.from('profiles').select('id,email').eq('id',body.userId).single();
 if(error||!target)return json({error:'Cuenta no encontrada.'},404);
 if(body.action==='delete_user') {
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const result=await deleteManagedUser(user.id,target.id,admin===true,{
   deactivate:async()=>{const {data,error}=await caller.from('profiles').update({activo:false}).eq('id',target.id).select('id').single();return {error:error||(!data?'Cuenta no disponible':null)};},
   // Irreversible Auth soft deletion keeps foreign keys and financial history.
   removeAuth:()=>service.auth.admin.deleteUser(target.id,true),
   removeProfile:()=>service.from('profiles').delete().eq('id',target.id),
  });
  return json(result,result.status);
 }
 if(body.action==='set_active') {
  if(typeof body.activo!=='boolean')return json({error:'Estado inválido.'},400);
  const {error}=await caller.from('profiles').update({activo:body.activo}).eq('id',target.id);
  return error?json({error:'No se pudo cambiar el acceso. Debe quedar un administrador activo.'},400):json({ok:true});
 }
 if(body.action==='update_profile') {
  const {error}=await caller.rpc('admin_save_user',{p_user_id:target.id,p_nombre:body.nombre,p_rol:body.rol,p_activo:body.activo,p_lineas:body.permisosLineas,p_modulos:body.permisosModulos,p_facturacion:body.permisosFacturacion});
  return error?json({error:'No se pudieron guardar el perfil y los permisos.'},400):json({ok:true});
 }
 if(body.action==='reset_access'||body.action==='resend_invite') {
  const appUrl=Deno.env.get('APP_URL')??'https://finanzas-pro10.vercel.app';if(!appUrl)return json({error:'Falta configurar la aplicación.'},503);
  const {error}=await caller.auth.resetPasswordForEmail(target.email,{redirectTo:appUrl+'/reset-password'});
  return error?json({error:'No se pudo enviar el enlace.'},400):json({ok:true});
 }
 return json({error:'Acción desconocida.'},400);
});
