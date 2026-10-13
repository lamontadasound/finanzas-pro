# Identidad marrón La Montada

15 septiembre 2026. Color principal #4B3836, fondos crema #FAF7F5, secundarios taupe. El cambio alcanza Tailwind accent/gold, estilos del shell, sidebar, formularios, paneles, estados positivos, gráficos, favicon e iconos instalables. Se mantienen etiquetas de estado y colores de error.

## Referencias del usuario

- Apple Design.md: tipografía de sistema, superficies de datos sólidas, vidrio limitado a navegación, transiciones cortas y movimiento reducido.
- Desktop/IA/Animaciones, capturas 13.08.04 y 13.08.14: List View Icon y Cards View Icon de Unlumen. Fuente gratuita descargada del registro oficial, adaptada con useReducedMotion. Integración funcional en Presupuestos: selector lista/tarjetas, filtros y apertura conservados.
- Registro: https://ui.unlumen.com/r/{name}.json. Comandos originales: npx shadcn@latest add @unlumen-ui/list-view-icon y @unlumen-ui/cards-view-icon. Se copiaron los archivos oficiales inspeccionados; motion ya estaba instalado.
- Licencia: https://unlumen-ui-docs.vercel.app/docs/license, componentes gratuitos admiten uso comercial y modificaciones. No se han utilizado componentes Pro.
- Desktop/IA/Complementos: referencia Bklit (Area, Bar, Ring, Gauge, Heat Map). Se conserva la biblioteca Bklit ya integrada, adaptando la paleta y sus escalas a la marca.

## Validación

191 pruebas aprobadas, incluidas vista de tarjetas, búsqueda y apertura sin escrituras. ESLint y compilación de producción correctos. La herramienta de navegador está bloqueada por la comprobación de seguridad del entorno: no se afirma revisión visual interactiva. No se modifican cálculos ni permisos de acceso.

## Corrección solicitada: blanco y movimiento visible

Fondo general, barra lateral, paneles, formularios y acceso en blanco. Marrón limitado a botones, indicadores, foco y selección. Entrada de página 22 px/0,5 s; paneles 18 px/0,48 s con escalonado corto; barras mensuales con despliegue; cambio mensual con desplazamiento; modales 28 px/0,45 s; transición geométrica entre lista y tarjetas. Las preferencias de movimiento reducido desactivan desplazamientos. Mantiene permisos, datos y archivos de presupuestos.

## Componentes solicitados el 15 de septiembre

- Sidebar 001 oficial gratuito: ancho ajustable con ratón/teclado, resaltado y marcador animados en navegación principal. Barra marrón #4B3836, contenido blanco.
- Sidebar Toggle Icon oficial; Cards View Icon y List View Icon conservados.
- File Tree oficial adaptado con botones accesibles: archivo de presupuestos por año/mes y apertura de documentos reales.
- Animated List oficial: propuestas con entrada/salida y reordenación animadas, sin límite artificial de ocho filas.
- Animate Digits oficial: importe mensual y totales de presupuestos. Se eliminó la cola de valores atrasados; valor accesible inmediato, movimiento reducido, cifras reales sin contar desde cero.
- Apple Switch oficial: opción Incluido, marrón y con permisos/estado deshabilitado conservados.
- Motion Tabs Menu y Motion Slide Menu: implementaciones propias basadas en comportamiento de las referencias; no se usa el código Pro ni se afirma instalarlo. Pestañas expansibles en barra flotante, navegación jerárquica con entrada/salida direccional.
- Bar Bklit en un único tono marrón. Gauge conserva el porcentaje real, limita solo el arco y coloca el texto fuera de la geometría para evitar recortes.

Fuentes gratuitas: https://ui.unlumen.com/r/file-tree.json, animated-list.json, animate-digits.json, apple-switch.json, sidebar-001.json y sidebar-toggle-icon.json en el mismo registro. Los archivos incluyen comentarios sobre adaptaciones. Revisados con TypeScript, ESLint y pruebas de interacción. Excepciones de lint puntuales documentadas para referencias DOM e iconos estáticos en código oficial.

Presupuestos: rutas y creación limitadas a montada_sound y montada_installations; políticas RLS restrictivas adicionales para INSERT/UPDATE. Registros históricos conservados. Foto en columna lateral del editor y alineada a izquierda en PDF (máximo 178 × 150 mm, aspecto original, salto de página si precisa). Nueva carpeta corporativo-lateral para no reutilizar PDFs antiguos centrados. Pruebas transaccionales de base de datos/archivo correctas; 200 pruebas de app aprobadas, lint y build correctos. PDF renderizado e inspeccionado. Navegador interactivo continúa bloqueado por el entorno.

## Navegación compacta y texto neutro — 15 septiembre

Dock limitado a pantallas inferiores a 1024 px. Eliminado su espacio reservado en escritorio. Corregida la altura adicional de 40 px dentro de cada enlace lateral; filas de 34–36 px en escritorio y objetivos táctiles de al menos 44 px en móvil. Grupos y cabecera más compactos.

Texto principal #111111 y secundario gris neutro. Las utilidades de texto accent/gold ahora son negras; sus fondos, bordes y gráficos mantienen la paleta marrón. Barra marrón con texto claro y botones principales con texto blanco. Plantilla PDF corporativa conservada.

Validación: 200 pruebas, lint y build correctos. Comprobación visual interactiva no disponible por el bloqueo de seguridad del navegador.

## Color informativo y corrección de tarjetas

Ingresos azules, cobros/beneficios positivos verdes, pendientes ámbar y gastos/pérdidas rojos en resúmenes e informes. Barras respetan el color de cada gráfico. Gauge verde/ámbar/rojo por margen; línea de beneficio con colores explícitos compatibles con Tailwind 3.

Corregidos márgenes interiores en gastos de evento y suplidos; indicadores apilados en móvil. ContentCard2 conserva margen en su contenido cuando incluye título. Etiquetas de barras admiten varias líneas y anillos se adaptan al ancho. Datos y cálculos conservados.

## Colores financieros — 16 septiembre 2026

Marca y navegación marrones; colores semánticos independientes: pagado/cobrado verde, pendiente rojo y parcial ámbar. Corregidos Badge/Badge2 y StatCard/StatCard2, antes ligados a accent marrón. Actualizadas etiquetas de ingresos, gastos, impuestos, suplidos, facturas, pagos y resumen mensual. Borradores/anulados de facturas neutros.

Paleta de gráficos azul, verde, ámbar, violeta y rojo. Barras por categoría con seis colores y marcadores en sus etiquetas; Bar admite categoryColors tanto durante animación como al terminar. Cobros verde/rojo. Ingresos frente a gastos azul/rojo. Se conserva la identidad marrón, el fondo blanco y las animaciones.

Validación: 218 pruebas, compilación y lint correctos. No se ha podido hacer revisión visual del navegador por el bloqueo de la herramienta.
