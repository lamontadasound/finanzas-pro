# Editar numeración de facturas

Botón Editar numeración en la factura abierta, Mis facturas y archivo. Número precargado, confirmación, guardado por RPC y recarga de la factura/PDF.

RPC editar_numero_factura: requiere edición de línea y gestión de numeración. Bloquea la fila y el contador. Rechaza números usados por otras facturas (incluidas ocultas), reservas y Drive. Registra el cambio, conserva la reserva anterior y no retrocede el contador. Solo modifica número, número solicitado e historial. Las facturas enviadas o con PDF en Drive requieren rectificación para evitar divergencia con documentos ya distribuidos.

Validación acotada: dos pruebas de interfaz, TypeScript/ESLint de archivos modificados y transacción SQL revertida que comprobó cambio, rechazo de 83, restauración del número propio, rechazo de enviada y falta de autenticación. La factura real 84 conserva su número. No se ejecutó la batería anterior ni se cambiaron importes. Sin QA visual autenticada por el bloqueo previo del navegador.
