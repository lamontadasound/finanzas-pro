## Facturación y Drive — 16 septiembre 2026

Líneas de negocio antes de Mi espacio. Eliminado el acceso Datos fiscales y facturación; ruta antigua redirige a Facturas. Emisor LA MONTADA SOUND SL / B21642913 / CALLE PORTUGALETE 68, 28223, POZUELO DE ALARCÓN, MADRID.

Archivo Drive: 80 documentos de ingresos (incluye una proforma) y 105 de gastos, agrupados por sus carpetas originales de mes. Solo índice documental; no se han inventado importes ni duplicado asientos contables. RLS exige acceso completo a contabilidad para el archivo mixto sin clasificación por línea.

Factura PDF corporativa marrón con logo, sin fotos. Numeración transaccional: contador 80, siguiente 81; tiene en cuenta el índice Drive y facturas internas, sin retroceder. Prueba SQL con rollback: 81, reintento 81, siguiente 82; ninguna emisión real. La numeración externa depende de actualizar el archivo.

217 pruebas, build y lint correctos. PDF local renderizado e inspeccionado. Sin comprobación visual del navegador por bloqueo de la herramienta.

Edge drive-invoice-archive v1 ACTIVE. Lee Drive y reemplaza el índice de forma atómica; falta verificar las credenciales de Google del servidor (la conexión del asistente no equivale a conexión de la app).

El usuario autorizó expresamente subir las facturas de ingresos generadas a su mes de Drive. Desplegada drive-sync v3: destino según fecha y carpeta mensual catalogada; nombre Factura <número>.pdf; rechaza recibidas en servidor. Sin carpeta mensual devuelve error recuperable sin perder ni volver a emitir la factura. Las credenciales Google del servidor siguen pendientes de verificación; no se ha hecho una subida real ni creado una factura ficticia.

UI: gastos solo Archivo Drive, sin registro manual ni selector de origen. Datos contables antiguos conservados. Cliente syncInvoice también rechaza recibidas antes de acceder a documentos o red. 217 pruebas completas más nueva prueba de no exportación de gastos (12 pruebas de recovery correctas); build y lint correctos.
