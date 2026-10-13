# Facturación independiente de Clientes

Generar factura tiene dos bloques fiscales: emisor resuelto desde la configuración real de La Montada y destinatario editable (razón social, NIF/CIF, dirección, email y teléfono). No lee ni modifica el CRM para completar datos fiscales. Reutiliza únicamente el destinatario de una factura anterior del mismo ingreso. PDF corporativo existente, sin fotografías.

Acceso desde Ingresos y nuevo botón Generar factura en Facturas, con selección de ingreso pendiente y filtrado de permisos/línea. Los datos introducidos se fijan en cliente_snapshot al emitir. La ficha comercial permanece independiente. El borrador previo conserva su comportamiento de borrador 0% sin numeración; los datos fiscales se fijan en la emisión, no en la ficha CRM.

RPC emitir_factura_con_datos_fiscales conserva la autorización de línea/emisión, bloqueo del ingreso/factura/contador, validación de importes, protección de porcentajes e idempotencia de la función anterior. Valida el destinatario enviado sin buscarlo por nombre en Clientes. La función anterior permanece para compatibilidad con clientes desplegados previamente.

Número = máximo del contador, facturas emitidas de la serie y archivo importado de Drive + 1, bajo bloqueo transaccional. El archivo actual indica 82; no se reserva ningún número para la vista previa ni se inventa uno en el navegador. La conexión automática de Google en el servidor sigue sin verificar; la numeración externa depende de que el índice de Drive esté actualizado.

Prueba SQL factura_fiscal_independiente.sql con rollback: cliente inexistente en CRM, destinatario fiscal distinto al nombre operativo, campos incompletos rechazados, usuario sin permiso rechazado, número consecutivo, reintento sin consumo y snapshot de La Montada. Ninguna factura real emitida en pruebas.

Advisor 0029 identifica la nueva RPC SECURITY DEFINER; exposición autenticada intencional, auth.uid + permisos verificados, search_path fijo y EXECUTE revocado a PUBLIC/anon, igual que la emisión anterior: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

Retirado “¿Qué es el CRM?”; acciones Editar/Borrar conservadas en la tabla CRM. Verificación visual autenticada pendiente por el bloqueo previo del navegador.
