# Recuperación de formularios, facturas y contratos

- Presupuestos: copia local versionada, por usuario y línea, incluyendo fotografía y revisión original para mantener el control de concurrencia al guardar. Conserva campos al remontar la pantalla. Advierte si el navegador no permite persistir.
- Facturas independientes: conceptos múltiples, cantidades, precios, descuentos por unidad; totales por concepto y documento. Detalle legible persistido en concepto y reproducido en tabla PDF, compatible con documentos anteriores.
- Borradores: guardado en facturas sin numeración, datos fiscales editables en datos_cliente_borrador, separados de los snapshots inmutables. Abrir, editar y eliminar desde Mis facturas. El archivo muestra la app y las facturas inmediatamente, sin exigir seleccionar año/trimestre/mes. Las emitidas usan rectificación y conservan su número.
- Recuperación local también en facturas vinculadas a ingresos. El borrador local es del navegador; Guardar borrador lo persiste en la app.
- Visor PDF en ventana amplia mediante el modal existente, descarga directa, sin quedar encajado en una fila animada.
- Contratos: plantilla basada en el PDF facilitado, con identidad marrón, ocho apartados en bodas/corporativos, campos de cliente/evento/equipo e importe; condiciones desplegables editables y anexo. Alquiler conserva sus condiciones específicas. No se copian datos personales ni firmas del ejemplo. Se usa el NIF configurado B21642913, corrigiendo la discrepancia tipográfica de la referencia. Plantilla de usuario, no dictamen de validez jurídica.

Validación acotada: pruebas de los editores, almacenamiento local, conceptos/PDF, contratos y mapeo/recuperación de facturas; SQL en transacción con rollback para crear/editar/eliminar borrador y conservar inmutabilidad tras emitir. PDFs de factura y contrato (3 páginas) renderizados e inspeccionados. Sin QA visual autenticada de la app por bloqueo del navegador.
