# Eliminar usuarios

Disponible para administradores en Usuarios y permisos, con confirmación por nombre/email, estado de progreso y errores recuperables. No permite borrarse a uno mismo ni dejar la aplicación sin administrador.

Edge Function admin-user-actions versión 3: valida JWT, sesión con getUser y rol mediante is_admin de la base de datos. Desactiva perfil con RLS del solicitante y trigger serializado protect_last_admin; Auth deleteUser(id,true) elimina acceso de forma irreversible conservando referencias históricas; por último retira profile y sus permisos en cascada. La clave service_role solo se usa en servidor. No elimina presupuestos, archivos ni otros registros financieros. Si hay un fallo parcial, mantiene el perfil inactivo y permite reintentar.

Verificación: 208 pruebas incluidas pruebas de interfaz y secuencia de borrado; build y lint. Comprobación SQL transaccional con cuentas ficticias, rollback final: protege el acceso propio, permite desactivar otra cuenta, retira permisos y conserva el presupuesto asociado. Ninguna cuenta real eliminada. No se ha realizado un borrado completo de una cuenta real como prueba.
