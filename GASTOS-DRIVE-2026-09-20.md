# Gastos y resumen contable — 20 septiembre 2026

Eliminadas las descripciones redundantes de gastos compartidos y gastos por evento, incluidas las variantes de instalaciones. Clientes desaparece de Contabilidad y su antigua ruta redirige al resumen; datos y CRM de Sound conservados.

El resumen contable y las facturas recibidas comparten el archivo de gastos de Drive. Solo los documentos recibidos presentes en ese archivo aportan importes a la estimación documental. Los gastos manuales siguen como control operativo separado. Impuestos enlaza a esta estimación y ya no calcula otro IVA a partir de gastos manuales.

Archivo actualizado: 236 documentos (82 ingresos, 154 gastos). Gastos: 115 leídos, 36 pendientes de revisión, 3 excluidos (dos duplicados y un documento de otra entidad). Los pendientes no se consideran cero ni permiten presentar un resultado fiscal completo. La agrupación temporal sigue las carpetas de Drive; la deducibilidad y el periodo fiscal requieren revisión profesional.

Nueva tabla drive_expense_amounts con RLS para contabilidad completa y edición administrativa. La versión del archivo invalida importes anteriores. Comprobaciones de importes, retenciones y duplicados en cliente y base de datos. Migración 20260920184716 aplicada.

La app solicita actualizar el índice al abrir y cada cinco minutos mientras la sección está visible. Las credenciales Google del servidor siguen sin poder verificarse: la conexión del asistente no prueba la conexión de la app. Los nuevos documentos o documentos modificados quedan pendientes; no existe extracción OCR automática en el servidor. La lectura inicial se hizo desde Drive y con OCR local, guardando solo datos revisados.

Validación: compilación y lint correctos; pruebas de cálculos, duplicados, filtros y estados pendientes. Consulta sin permisos devuelve cero filas; importes con versión obsoleta rechazados. Verificación visual autenticada pendiente por bloqueo de la herramienta de navegador.
