# Eliminación y navegación

- Facturas generadas: botón Eliminar factura con confirmación; se ocultan de los listados de generación y archivo. Conservan sus datos contables, numeración y archivos en Drive. La RPC exige permiso de eliminación de la línea y no modifica importes ni estado fiscal.
- Contratos: borrado confirmado en listado y editor, con RLS por línea; elimina también el borrador local si corresponde al contrato abierto.
- Generar facturas retirado del menú y acceso de Contabilidad. La ruta antigua lleva al archivo; la generación permanece en las líneas.

Validación solo del cambio: dos pruebas del botón; SQL con rollback para permisos de eliminación, conservación del número/importes y borrado de contratos. ESLint de los archivos tocados y compilación para publicar. Sin repetir pruebas generales ni QA visual autenticada.
