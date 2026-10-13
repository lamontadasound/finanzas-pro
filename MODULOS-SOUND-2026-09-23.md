# CRM, Clientes, Contratos y Facturas independientes

## CRM y Clientes

CRM usa `sound_leads`, sin claves externas ni sincronización con Clientes. Contacto completo, canal libre con sugerencias, servicio, fecha de captación, pendiente/convertido/no convertido, cierre, motivo y notas. Carpetas y filtros por canal y fechas. Informe: convertidos / todos los captados durante el periodo de entrada; incluye los pendientes en el denominador y detalla los tres resultados por canal. No estima canales no informados.

Clientes usa carpetas creadas manualmente (`crear_carpeta_sound`) y guardado separado (`guardar_carpeta_sound`). Información y documentos existentes preservados. La migración copia una sola vez los contactos activos al CRM y marca las antiguas carpetas ganadas o con documentos. Los borrados previos no se reactivan: al aplicar la migración había 16 registros antiguos, todos borrados lógicamente, por lo que ambos módulos comienzan vacíos. No se inventan contactos para poblar gráficas.

## Contratos

Menú debajo de Presupuestos, tres grupos: bodas, eventos corporativos y alquileres. Datos de ambas partes, servicio, fecha/lugar/horario, importes, IVA, pago, condiciones, entrega/devolución/fianza para alquiler, representantes y contrayentes según tipo. Guardado en `sound_contracts` con RLS de Sound y descarga PDF corporativa con logo. Los nuevos documentos pueden reutilizar pago/condiciones del último contrato de su tipo; los datos personales no se reutilizan automáticamente.

No se recibió una plantilla contractual aprobada: se proporcionan tres textos base editables por tipo y se exige completar datos, pago y condiciones antes de descargar. Los textos base recogen alcance, coordinación, cambios por escrito y, para alquiler, inventario y devolución. No se inventan penalizaciones, renuncias o políticas de cancelación. La descarga no firma ni certifica el contrato. Referencia consultada: Código Civil, reglas generales de contratación: https://www.boe.es/eli/es/rd/1889/07/24/(1)/con

## Facturas

Nuevo apartado Generar facturas en cada línea y Contabilidad, y acceso desde el archivo. Emisión sin ingreso obligatorio, sin crear ingresos ficticios. Vincular un ingreso es opcional y utiliza el flujo existente de facturación parcial. Datos fiscales independientes, emisor configurado, vista previa, numeración atómica, registro, PDF y reintento Drive. Identificador persistente por usuario/línea para reintentos de una emisión pendiente; la RPC mantiene la idempotencia. No se crea otra factura cuando solo falla Drive.

La rectificación existente acepta originales sin ingreso y conserva permisos y bloqueo. No se añade vinculación posterior a la emisión de una factura ya inmutable; la relación se elige antes de emitir. El archivo y contador de Drive importado siguen formando parte de la numeración, pero la sincronización Google del servidor continúa pendiente de verificar.

## Gastos y validación

Todas las líneas comparten las tablas existentes de gastos y gastos por evento con su filtro de línea. Se unifica el menú Gastos / Por eventos, Por actuación o Por instalación / Generales.

Migración `20260923094115_crm_independiente_contratos_facturas.sql` aplicada. SQL transaccional con rollback comprueba independencia de CRM/Clientes, permisos de tablas, emisión sin ingreso, numeración/reintento y rectificación. No se emitieron facturas reales en las pruebas. PDFs de los tres tipos renderizados e inspeccionados; compresión reduce cada ejemplo a unos 73 KB. Revisión visual autenticada de la app pendiente por bloqueo previo del navegador.

RLS habilitada y grant explícito, sin acceso anónimo. El advisor no reporta problemas en las dos tablas nuevas. Señala RPC SECURITY DEFINER expuestas intencionalmente a authenticated: se conservan auth.uid(), comprobaciones de permisos, search_path fijo y revocación de PUBLIC/anon. Detalle: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
