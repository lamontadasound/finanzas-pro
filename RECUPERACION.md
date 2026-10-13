# Mi espacio — código recuperado

Código original recuperado el 15 de septiembre de 2026 del despliegue `dpl_73pzxByN48KDZ1gf1oDFm1sW5fxU`.
Proyecto de Vercel: `finanzas-pro10` · equipo: `la-montada-s-projects`.
URL: https://finanzas-pro10.vercel.app

## Cambios

- Categoría Estructuras disponible en inventario y equipo.
- Retirado el bloque duplicado de pagos pendientes de Informes. La sección Pagos continúa disponible.
- Carpetas de ingresos, gastos, gastos de evento, facturas, pagos e inventario muestran Total sin IVA. Los importes de cobros/pagos individuales permanecen intactos.
- La columna mensual Base imp. de Informes se llama Total sin IVA, también en CSV.
- No se han modificado registros ni el esquema de la base de datos.

## Trabajar con esta copia

1. `npm ci`
2. Configurar `.env.local` usando `.env.example`, con la conexión del proyecto existente.
3. `npm run dev`
4. Validación: `npm test` y `npm run build`.

La copia descargable excluye credenciales, dependencias y archivos compilados. Las variables de producción permanecen configuradas en el proyecto de Vercel.

La validación del cambio comprende 167 pruebas correctas y compilación de producción. La comprobación visual en navegador no estuvo disponible por el bloqueo de la herramienta de navegación.
