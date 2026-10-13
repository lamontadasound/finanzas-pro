# CRM comercial y configuración — 20 septiembre 2026

## Resultado

- Barra de Sound: Resumen, Ingresos, Gastos (Por eventos / Generales), CRM, Presupuestos, Clientes, Inversiones, Reparto, Pagos, Informes.
- Eliminado el acceso «Ir a un apartado» del encabezado y los nombres de componentes de los textos de gráficos.
- Configuración exclusiva de administración en `/admin/ajustes`: crear categorías, elegir un color fijo y escoger uso en gastos generales, eventos o ambos. Catálogo compartido guardado en `expense_categories`, RLS de lectura para perfiles activos y escritura solo admin. Categorías históricas preservadas. Nombres no se renombran para evitar desvincular gastos históricos.
- Gastos generales y de evento consumen el catálogo. Gráfico de categorías usa color por nombre (independiente del orden), barras de color uniforme, leyenda accesible con nombre e importe; sin tooltip negro. Los gráficos temporales conservan su panel, sin la pequeña píldora de fecha y con ancho mínimo.
- CRM en tabla desplazable tipo hoja de cálculo, avatares de iniciales, búsqueda, filtro de estado y servicio, orden por nombre/estado/seguimiento. Editor guarda datos de contacto, origen, servicio, estado, fecha de cierre, motivo de pérdida, acción y seguimiento. Pérdida exige motivo; cierres nuevos exigen fecha.
- Clientes muestra solo ganados, agrupados por servicio, conserva información, listados, contratos, presupuestos y facturas privados. Los enlaces automáticos siguen exigiendo coincidencia exacta y única.
- Histórico: 12 clientes confirmados con ingresos de Sound; 11 se clasificaron por tipo explícito (5 boda, 4 corporativo, 2 alquiler), 1 mixto sin clasificar. Tres contactos sin ingresos permanecen abiertos. No se inventaron orígenes ni fechas de cierre.
- Rediseño financiero pendiente de la sesión anterior incluido: tarjetas, tipografía, formularios, login, gráfica real de balance y dock glass solo móvil.

## Validación

- Compilación TypeScript/Vite y ESLint correctos.
- Suite: 229 pruebas correctas; dos pruebas adicionales de flujo `SoundCRM.test.tsx` correctas (231 total).
- SQL `supabase/tests/crm_comercial_categorias.sql` ejecutado contra el proyecto real dentro de BEGIN/ROLLBACK: permisos admin/usuario/anon, persistencia de campos, rechazo de pérdida sin motivo, guardado atómico, reapertura, compatibilidad con cliente antiguo. Sin datos de prueba persistidos.
- Migraciones: `20260920182313_crm_comercial_categorias.sql`, `20260920182640_clasificar_clientes_sound.sql` aplicadas.
- Revisión visual NO realizada: CUA denegó el acceso a la vista local porque no pudo verificar la política de seguridad administrada del navegador. No se usó otro navegador para eludir el bloqueo.

## Seguridad

Nuevos campos heredan RLS de Sound. El RPC de guardado sigue SECURITY INVOKER; sin acceso anónimo. El RPC existente de creación conserva autorización explícita Sound. El asesor no señaló problemas nuevos en las tablas/función modificadas. Sí devolvió avisos preexistentes de otras funciones DEFINER y de configuración Auth, fuera de este cambio: [referencia del asesor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). No se cambiaron sus permisos en este trabajo.

## Despliegue

Vercel `dpl_12BkQdF1NBcVKe2wJddAgAQdifTn`, Ready. URL: https://finanzas-pro10-lxbs7mlov-la-montada-s-projects.vercel.app. Entrada JS `index-HDU0aa-T.js`, CSS `index-tcwqxc6P.css`; HTTP 200.
