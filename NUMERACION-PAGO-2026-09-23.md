# Numeración, evento y pago

Diagnóstico: la factura 83 existe como emitida y está oculta del listado; 84 está emitida y visible. El contador y el registro de numeración indican 84. No se renumeraron documentos ni se reutilizó 83.

Generación independiente: numeración solicitada opcional (permiso gestionar numeración), validada transaccionalmente contra contador, facturas, registro e índice Drive. Debe superar el último utilizado; vacía mantiene asignación automática. Reintentos conservan el número. Fecha del evento y número solicitado sobreviven al guardado del borrador.

Configuración de La Montada: web www.lamontada.es e IBAN ES82 0182 1941 7302 0172 1518. Se guardan en nuevos snapshots; PDF regenerados del emisor B21642913 completan datos de pago y web cuando faltaban, sin alterar número ni importes. Se mantiene el teléfono/email configurado. Los archivos existentes de Drive no se sobrescribieron.

Validación acotada: diez pruebas de generador/conceptos/PDF, ESLint de archivos modificados, tipos, SQL con rollback para número ocupado, número manual, reintento, continuación automática y snapshot de fecha/IBAN/web. IBAN checksum válido. PDF de muestra renderizado e inspeccionado; no se emitieron facturas reales durante las pruebas.
