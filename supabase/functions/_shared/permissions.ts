const lines=['montada_sound','dj','real_madrid','montada_installations'];
const modules=['contabilidad','informes','impuestos','administracion'];
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateUserInput(body:unknown): string|null {
 if(!object(body))return 'Petición inválida.';
 if(Object.keys(body).some(k=>!['email','nombre','rol','permisosLineas','permisosModulos','permisosFacturacion'].includes(k)))return 'Campo desconocido.';
 if(typeof body.email!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||typeof body.nombre!=='string'||!body.nombre.trim()||!['admin','usuario'].includes(String(body.rol)))return 'Datos de usuario inválidos.';
 for(const [field,keys] of [['permisosLineas',lines],['permisosModulos',modules]] as const){
  const map=body[field];if(!object(map))return 'Matriz inválida.';
  for(const [k,v] of Object.entries(map)) {
   if(!keys.includes(k)||!object(v)||Object.keys(v).length!==4||!['ver','crear','editar','eliminar'].every(a=>typeof v[a]==='boolean'))return 'Permiso desconocido o manipulado.';
   if(!v.ver&&(v.crear||v.editar||v.eliminar))return 'La escritura requiere lectura.';
  }
 }
 const fine=body.permisosFacturacion;
 if(!object(fine)||Object.keys(fine).length!==3||!['emitir','rectificar','gestionarNumeracion'].every(k=>typeof fine[k]==='boolean'))return 'Permisos de facturación inválidos.';
 return null;
}
