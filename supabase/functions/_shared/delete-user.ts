type Result = { error: unknown };
export interface DeleteUserSteps {
  deactivate: () => PromiseLike<Result>;
  removeAuth: () => PromiseLike<Result>;
  removeProfile: () => PromiseLike<Result>;
}
// The caller must be an active administrator verified from the database.
// Deactivation goes through caller RLS and the serialized last-admin trigger.
export async function deleteManagedUser(callerId: string, targetId: string, admin: boolean, steps: DeleteUserSteps) {
  if (!admin) return { status: 403, error: 'No tienes permiso para eliminar usuarios.' };
  if (callerId === targetId) return { status: 400, error: 'No puedes eliminar tu propia cuenta.' };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) return { status: 400, error: 'Cuenta no válida.' };
  if ((await steps.deactivate()).error) return { status: 409, error: 'No se puede eliminar: debe quedar otro administrador activo.' };
  if ((await steps.removeAuth()).error) return { status: 500, error: 'Se ha desactivado el acceso, pero no se pudo completar el borrado. Puedes reintentarlo.' };
  if ((await steps.removeProfile()).error) return { status: 500, error: 'La cuenta ya no tiene acceso. Falta retirarla de la lista; vuelve a pulsar Eliminar.' };
  return { status: 200, ok: true };
}
