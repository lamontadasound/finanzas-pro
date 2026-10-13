# CRM y carpetas de clientes — 18 septiembre 2026

Sound añade CRM y Clientes. CRM por contacto, propuesta, negociación, ganado y perdido; próxima acción, fecha y notas. Cada cliente tiene Información/listados, Contratos, Presupuestos y Facturas. Fichas enlazadas a clientes existentes de Contabilidad; guardado conjunto mediante RPC transaccional.

Inicialización: 15 carpetas a partir de clientes identificados de Sound en ingresos, presupuestos y facturas. Se crean solo nombres ausentes y se vinculan nombres únicos. No se inventan datos fiscales ni se modifica actividad financiera. Los contactos nuevos o compartidos pueden crearse/vincularse con el botón Nuevo cliente.

Documentos: archivos privados PDF/JPEG/PNG/Word/Excel/CSV/TXT hasta 20 MB, sin sobrescritura. Notas persistentes. Documentos adjuntos de ingresos y facturas se muestran por asociación. Presupuestos e invoices de la app se reúnen por identidad fiscal/id o nombre exacto no ambiguo; PDF descargable sin reemitir ni consumir número. Facturas de Drive reconocidas únicamente por formato Factura N - Cliente.pdf y coincidencia exacta de cliente, respetando los permisos existentes del archivo Drive. Otros documentos deben adjuntarse en su carpeta; no se asignan por coincidencias parciales.

Permisos: RLS de Sound en perfiles CRM y documentos; Storage privado crm-sound. crear_cliente_sound es SECURITY DEFINER intencional para insertar atómicamente la ficha compartida y su asociación: auth.uid y permiso create Sound; vincular ficha existente requiere además view Contabilidad. Sin acceso anon/PUBLIC. guardar_cliente_sound es SECURITY INVOKER y transaccional. Identidad de carpeta no modificable por authenticated. Asesor de seguridad solo advierte del RPC autenticado SECURITY DEFINER intencional, sin avisos sobre las tablas CRM.

Validación: build/lint correctos, 222 pruebas de la suite y 5 pruebas finales CRM (una añadida después de la suite). SQL con rollback verifica creación/guardado, lectura privada, aislamiento entre líneas, solo lectura y bloqueo de cambio de identidad. No se han dejado clientes ni archivos de prueba. Navegador no verificado visualmente por bloqueo de herramienta.

## 21 septiembre 2026 — editar y borrar

Acciones visibles en tarjetas, tabla CRM y ficha. Borrado con confirmación y permiso `montada_sound:delete`; edición conserva su permiso independiente. `borrar_cliente_sound` realiza borrado lógico (`eliminado_en`): desaparece de CRM/Clientes y conserva registros fiscales y documentos. No se han borrado clientes reales durante la implementación. No es una eliminación permanente de datos personales ni una purga documental.

Migración 20260921210248 aplicada. Función SECURITY DEFINER intencional para no conceder UPDATE directo al indicador de borrado; verifica auth.uid(), view y delete explícitamente, fija search_path y revoca ejecución pública/anónima. El aviso 0029 del advisor corresponde a esta exposición autenticada intencional y comprobada: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

Validación: 7 pruebas de interfaz correctas, build y lint correctos. Prueba SQL transaccional con rollback: usuario sin permisos rechazado; admin marca borrado y conserva registro fiscal. La comprobación visual autenticada sigue pendiente por el bloqueo previo del navegador.
