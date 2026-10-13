> Documento histórico recibido con el proyecto. Para el estado verificado de esta entrega, consultar `INFORME_ENTREGA.md` y `ACTIVACION.md`.

# Diseño de políticas RLS por línea de negocio — NO EJECUTAR TODAVÍA

_Preparado en la Fase C, para revisión. No se ha ejecutado ningún SQL de esta
página contra Supabase. Corresponde a la Fase F ("Administración y
seguridad") del plan — aquí solo se deja diseñado._

## 1. Tablas afectadas

`ingresos`, `gastos`, `gastos_evento`, `pagos_evento`, `suplidos`, `facturas`,
`equipo`, `documentos`, `impuestos`, `usuarios`. (`eventos`, `socios`,
`movimientos_socios` quedan fuera de este primer diseño — sin datos o de uso
exclusivo de administración.)

## 2. Políticas actuales (ver `supabase/schema.sql:200-209`)

```sql
CREATE POLICY "acceso_total" ON <tabla> FOR ALL USING (true) WITH CHECK (true);
```

Sin excepción, en las 10 tablas. Cualquier fila es legible y escribible por
cualquier petición autenticada con la anon key — el control de acceso actual
vive enteramente en la UI (`useAuthStore.canView/canCreate/canEdit/canDelete`),
nunca en la base de datos.

## 3. Políticas nuevas propuestas (diseño, no SQL final)

Requiere primero que exista una tabla de sesión con el usuario autenticado
real (hoy el login contra `usuarios` no usa Supabase Auth — es una tabla
propia con `password_hash`). Dos caminos posibles, a decidir contigo antes de
escribir el SQL definitivo:

**Opción A — migrar a Supabase Auth** (recomendado a medio plazo): cada fila
de `usuarios` se vincula a un `auth.uid()`; las políticas usan
`auth.uid()` para resolver permisos vía una función `current_user_permisos()`.
Requiere migrar el login actual.

**Opción B — mantener el login propio, aplicar RLS vía una función seguridad
definida en la propia tabla `usuarios`** usando un header/JWT personalizado
firmado por un Edge Function tras el login. Más trabajo pero no obliga a
cambiar el sistema de autenticación actual.

Esqueleto de política (independiente de la opción elegida), una vez resuelto
"quién es el usuario actual" como `current_user_id()`:

```sql
-- Ejemplo para "ingresos" — sustituye a "acceso_total"
CREATE POLICY "ver_ingresos_por_linea" ON ingresos
  FOR SELECT USING (
    linea_negocio = ANY (permisos_lineas(current_user_id()))
  );

CREATE POLICY "crear_ingresos_por_linea" ON ingresos
  FOR INSERT WITH CHECK (
    linea_negocio = ANY (permisos_lineas_crear(current_user_id()))
  );
-- análogas para UPDATE (editar) y DELETE (eliminar)
```

Donde `permisos_lineas(uid)` es una función SQL que lee la nueva matriz de
permisos por línea (Fase F) y devuelve el array de `linea_negocio` permitidas
para ese usuario y esa acción. Julia (admin) tendría una política adicional
`OR is_admin(current_user_id())` que la exime de la restricción.

## 4. Impacto por rol

| Rol | Efecto de las nuevas políticas |
|---|---|
| Julia (admin) | Ninguno — acceso completo preservado explícitamente en cada política |
| Socio de una línea | Solo ve/edita filas de esa `linea_negocio`; antes ya no las veía en la UI, ahora tampoco puede leerlas por API directa |
| Gestoría (Contabilidad) | Acceso de solo lectura a todas las líneas en las tablas de Contabilidad, sin acceso a Administración |
| Cliente anon sin login | Sin ninguna fila visible (hoy vería todo si tuviera la anon key) |

## 5. Plan de reversión

Cada política nueva se crea con `CREATE POLICY` bajo un nombre distinto al
actual (`acceso_total`); el cambio se aplica en una migración que:
1. Crea las políticas nuevas.
2. Solo si la verificación en staging es correcta, elimina `acceso_total`
   (`DROP POLICY "acceso_total" ON <tabla>`) en una migración **separada**,
   para poder revertir el paso 2 sin perder las políticas nuevas si algo falla.
Si algo se rompe tras el paso 2: `CREATE POLICY "acceso_total" ON <tabla> FOR ALL USING (true) WITH CHECK (true);`
restaura el comportamiento actual en segundos, sin pérdida de datos (RLS solo
filtra lecturas/escrituras, nunca borra filas).

## 6. Pendiente antes de escribir el SQL definitivo

- Decidir Opción A vs. B de autenticación (sección 3).
- Terminar la matriz de permisos por línea de la Fase F (módulos globales,
  acciones por línea) — las políticas dependen directamente de esa forma de
  datos.
- Confirmar qué acceso exacto tiene la gestoría (¿todas las líneas en modo
  lectura, o algo más granular?).
