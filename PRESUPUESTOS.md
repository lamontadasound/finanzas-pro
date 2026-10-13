# Presupuestos por línea de negocio

## Uso

Entra en una línea de negocio → Presupuestos → Nuevo presupuesto.
Escribe un servicio por línea y pulsa «Crear conceptos desde la descripción».
Ejemplo: `2 x Técnico de sonido a 180 €`. Se interpreta como dos unidades a 180 € sin IVA cada una.
Los servicios sin precio quedan pendientes. Se pueden guardar como borrador; para exportar el PDF o cambiar a un estado final debe constar el cliente y todos los precios.

El generador organiza texto con reglas explícitas: no usa un proveedor de IA ni propone tarifas de mercado. Fechas, aforo y horas sin símbolo de moneda no se convierten en precios. También se pueden añadir y editar conceptos manualmente.

Se guardan título, cliente, dirección, fechas, conceptos, porcentaje de IVA, condiciones y estado. La numeración PRE- es única y automática. Los presupuestos no alteran ingresos, pagos ni facturas.

## Implementación

- Página compartida con cuatro rutas protegidas por RequireLinea y la misma navegación de las líneas existentes.
- Supabase `public.presupuestos`, con permisos de lectura, creación, edición y borrado por línea. Las columnas de identidad y línea son inmutables para el cliente.
- Actualizaciones por revisión: una versión antigua no puede sobrescribir otra recién guardada.
- Cálculo en céntimos, redondeo por concepto y posterior IVA. Precio pendiente se distingue de precio cero.
- PDF multipágina generado en el dispositivo. Biblioteca cargada solo al exportar. Cliente y condiciones tienen ajuste de líneas.
- Editor y resumen adaptables a móvil, siguiendo la superficie clara y tipografía de la versión premium.

## Validación — 15/09/2026

- Build de producción correcto. Se mantiene la advertencia previa sobre el tamaño del bundle principal.
- ESLint correcto.
- 181 pruebas pasan, incluidas 9 nuevas para extracción, cálculos, validaciones, PDF, permisos del editor y errores de guardado.
- `supabase/tests/presupuestos_rls.sql` ejecutado contra el proyecto configurado dentro de una transacción que termina en ROLLBACK: CRUD, separación entre líneas, lectura sin edición, acceso anónimo denegado, inmutabilidad de línea y revisiones antiguas. No quedan usuarios ni registros de prueba. Las secuencias pueden tener saltos por esas inserciones revertidas.
- PDF de ejemplo renderizado e inspeccionado visualmente con datos ficticios.
- No se ha podido realizar una comprobación visual interactiva de la web debido al bloqueo de seguridad del navegador de esta sesión; no se eludió ese bloqueo.

El asesor de seguridad no identifica avisos sobre la tabla nueva. Conserva avisos preexistentes sobre funciones SECURITY DEFINER y configuración de contraseñas; no se modificaron esas funciones como parte del módulo. Referencias: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable y https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Plantilla corporativa y archivo — 15/09/2026

Diseño adaptado a la captura aportada: papel crema, marco fino, tabla y total dorados, logo oficial blanco sobre placa dorada, cliente y datos de empresa, fecha de evento/temporada y pie de contacto. Logo original obtenido de https://www.lamontada.es/brand/logo-blanco-360.png, conservado en `public/brand/la-montada-oficial.png`.

Los datos de contacto predeterminados proceden de la captura del usuario. Se pueden editar dentro del presupuesto y se guardan como una copia propia; no cambian la configuración fiscal general. Campos opcionales compatibles con los presupuestos anteriores.

Se añaden descuento en euros por unidad y concepto incluido. Subtotal = cantidad × (precio por unidad − descuento por unidad); incluido = 0. El ejemplo de referencia arroja 3.000 € sin IVA + 630 € IVA = 3.630 €.

Numeración PRE- correlativa y única conservada en la base de datos. No se reinicia al editar. Al descargar, el PDF se guarda en el bucket privado `presupuestos`, en `linea/id/rREVISION.pdf`. Las descargas posteriores recuperan los mismos bytes. Cada nueva edición guardada tiene una revisión diferente, sin sobrescribir archivos anteriores. La interfaz abre la revisión actual; los archivos anteriores se conservan. Usuarios con acceso de lectura pueden descargar; para archivar se exige edición o ser el creador con permiso de creación.

Validación actualizada: 186 pruebas pasan, ESLint y build correctos. PDF de una página y ejemplo de tres páginas renderizados e inspeccionados. Permisos de almacenamiento verificados con `supabase/tests/presupuestos_archivo_rls.sql` dentro de transacción revertida: subida por línea y revisión, bloqueo de escritura por lectores y de sobrescritura, y ocultación tras borrar el presupuesto. No hay nuevos avisos del asesor sobre presupuestos. La inspección interactiva del navegador sigue bloqueada por la política de la sesión.

## Nueva referencia corporativa marrón — 15/09/2026

Plantilla sustituida por la nueva composición aportada por el usuario: título superior, empresa y logo, línea separadora marrón, dos tarjetas de datos, tabla de concepto y descripción detallada, y tarjeta de totales. Color exacto del logo suministrado: #4B3836. El original `Logo Marrón.png` se conserva sin editar en `public/brand/la-montada-marron.png`; se posiciona usando sus márgenes transparentes. No se han copiado los datos de la empresa ajena de la referencia.

Campo opcional `detalle` por concepto, compatible con registros previos. Se conservan los descuentos, incluidos, numeración y total sin IVA. Nueva ruta de archivo por versión de plantilla: `linea/id/corporativo-marron/rREVISION.pdf`. Las descargas usan el diseño nuevo; las versiones anteriores permanecen archivadas. La política de Storage ya admite este subdirectorio y su verificación transaccional se ha actualizado y ejecutado correctamente.

PDF de cinco conceptos revisado en una página, y PDF largo revisado en tres páginas. Se añade prueba de descripción detallada y paginación compacta. Logo suministrado por el usuario, sin dependencia de webs externas al generar el PDF.

## Foto del montaje — 15/09/2026

Nuevo apartado opcional al final del editor, con selector, previsualización y retirada. JPG, PNG o WebP, hasta 10 MB. La app normaliza a JPEG conservando proporciones, máximo 1600 px y aproximadamente 210 KB. La imagen optimizada se guarda en `contenido.fotoMontaje` con el presupuesto y sus permisos existentes.

El PDF incorpora la foto después de condiciones y totales, centrada y sin deformar, con límite 178 × 115 mm. Si falta espacio pasa a una página nueva. Sustituir o quitar la foto y guardar crea una nueva revisión, conservando los PDF archivados anteriores.

190 pruebas, lint y build correctos. Verificados formatos, límites, dimensiones, liberación de URL temporal y tamaño máximo del documento. PDF de prueba con imagen generado y renderizado para comprobar ubicación y márgenes. La revisión interactiva del navegador continúa bloqueada por la política de la sesión.

## Actualización de líneas y foto lateral

Presupuestos disponibles en Sound e Installations; DJ y Real Madrid no tienen ruta ni acción de creación. INSERT/UPDATE se restringen también mediante RLS adicional; pruebas transaccionales verificadas. Los documentos históricos permanecen guardados. Archivo por años/meses mediante File Tree, lista animada e interruptor Apple para Incluido. Foto en columna lateral del editor y a izquierda en PDF, hasta 178 × 150 mm sin deformación; nuevo prefijo corporativo-lateral mantiene los archivos anteriores. 200 pruebas, build y lint correctos.

## Foto sin título repetido

Retirado el título del servicio junto a la foto, que quedaba suelto en la segunda página. Nuevas descargas utilizan corporativo-foto-limpia para no recuperar el PDF anterior. Verificado PDF de dos páginas.
