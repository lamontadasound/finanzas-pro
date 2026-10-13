import { supabase } from './supabase';
import type { LineaId } from '../config/businessLines';
import { validarPresupuesto, type Presupuesto, type PresupuestoContenido } from './presupuestos';
export async function listarPresupuestos(linea: LineaId): Promise<Presupuesto[]> {
  const { data, error } = await supabase.from('presupuestos').select('id,numero,linea_negocio,contenido,revision').eq('linea_negocio', linea).order('numero', { ascending: false });
  if (error) throw new Error('No se pudieron cargar los presupuestos. Inténtalo de nuevo.');
  return data as Presupuesto[];
}
export async function guardarPresupuesto(linea: LineaId, contenido: PresupuestoContenido, anterior: Presupuesto | null): Promise<Presupuesto> {
  if (linea !== 'montada_sound' && linea !== 'montada_installations') throw new Error('Los presupuestos solo están disponibles en Sound e Installations.');
  const invalid = validarPresupuesto(contenido);
  if (invalid) throw new Error(invalid);
  const query = anterior
    ? supabase.from('presupuestos').update({ contenido, revision: anterior.revision + 1 }).eq('id', anterior.id).eq('linea_negocio', linea).eq('revision', anterior.revision)
    : supabase.from('presupuestos').insert({ linea_negocio: linea, contenido });
  const { data, error } = await query.select('id,numero,linea_negocio,contenido,revision').maybeSingle();
  if (error) throw new Error('No se pudo guardar el presupuesto. Comprueba la conexión y tus permisos.');
  if (!data) throw new Error('Este presupuesto ha cambiado en otra sesión. Recarga la lista y vuelve a abrirlo para editarlo.');
  return data as Presupuesto;
}
export async function eliminarPresupuesto(p: Presupuesto) {
  const { data, error } = await supabase.from('presupuestos').delete().eq('id', p.id).eq('linea_negocio', p.linea_negocio).eq('revision', p.revision).select('id');
  if (error || !data?.length) throw new Error('No se pudo eliminar. Recarga la lista y comprueba tus permisos.');
}
