# Rentabilidad por ingreso — 20 septiembre 2026

- Todas las líneas usan la tabla compartida de ingresos: total sin IVA, total con IVA, gastos sin IVA, beneficio, margen y estado. Móvil muestra los importes y acceso al detalle.
- Al pulsar una fila o el concepto se abre una ficha con importes, margen, cobrado/pendiente, desglose de costes y notas. Acciones de la fila permanecen independientes.
- Los gastos se enlazan exclusivamente por `ingresoId` y área, con los datos ya cargados y sujetos a permisos. Sin asociaciones por nombre o importes.
- Beneficio del evento = ingreso sin IVA − costes directos sin IVA. Antes de gastos generales e impuestos; no confundir con dinero cobrado.
- Costes: `baseImponible` explícita, o `importe - importeIVA` cuando se conoce IVA; registros antiguos sin desglose conservan su importe y muestran aviso. El total bruto usa `totalConIva` o el histórico `importe`.
- Margen = beneficio / ingreso sin IVA. Para ingreso cero no se divide; muestra «No calculable». Pérdidas en rojo.
- Cobros siguen `cobradoDe` y `pendienteDe`, con reservas e históricos marcados pagados.
- «Abrir gastos de este evento» usa el ID en la ruta y abre directamente su carpeta. La vista de gastos usa el mismo cálculo y muestra sin/con IVA. Gastos generales también muestra ambos importes.
- No se cambian datos, tablas, permisos ni cálculos de otras secciones financieras.

Validación: 237 pruebas correctas, TypeScript/Vite y ESLint correctos. Pruebas de IVA, vínculo/área, gastos sin desglose, costes cero, pérdidas, reservas y navegación al detalle. Revisión visual pendiente por denegación del control de seguridad de navegador (no se usó otro mecanismo para eludirlo).

Despliegue Vercel: `dpl_FDF8A316TyC5kbvz6AcwLrY8s6pN` (Ready). https://finanzas-pro10-krmhkv28q-la-montada-s-projects.vercel.app
