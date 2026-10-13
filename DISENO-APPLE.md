# Acabado Apple Design

Aplicado el 15 de septiembre de 2026 siguiendo la skill aportada por Julia:
`/Users/juliacenteno/Desktop/IA/SKILLS/Apple Design.md`.

Se conserva el verde salvia, la estructura de navegación y todos los cálculos financieros.

- Cabecera, dock móvil y ventanas con materiales translúcidos de diferente densidad.
- Widgets sólidos para mantener la legibilidad, sombras suaves y detalle verde lateral.
- Mes actual identificado en el resumen de Julia.
- Cifras animadas usando el componente existente, que muestra el valor real desde el primer render.
- Botones y enlaces de proyectos con respuesta al pulsar y muelles sin rebote.
- Pestañas con estado accesible y desplazamiento suave de la selección.
- Entradas de página breves sin esperas entre rutas.
- Ventanas montadas en document.body para evitar que las transiciones de página desplacen la superposición.
- Variantes para movimiento reducido, transparencia reducida, mayor contraste y navegadores sin desenfoque de fondo.

Validación: compilación de producción y 167 pruebas correctas. La herramienta de navegador bloqueó la comprobación visual; no se ha afirmado validación visual en móvil o escritorio.

## Refinamiento del resumen y uso móvil

- Resumen anual con tipografía de sistema, fondo piedra y acentos verde bosque; se retiran los bloques decorativos repetidos.
- Proyectos en una lista compacta con acceso directo y cantidades alineadas.
- Lista de los doce meses y panel de detalle por selección. En teléfonos se usa un selector dentro del panel para consultar cada mes sin desplazarse entre listado y detalle.
- Explicación de los cálculos en un desplegable, siempre disponible.
- Formularios de móvil a pantalla completa con áreas seguras y campos cómodos; bloqueo de desplazamiento compartido entre menú y formularios.
- Los cálculos financieros y las funciones de guardado no cambian.

Validación de esta revisión: 172 pruebas correctas (23 archivos), ESLint sin errores y compilación correcta. La navegación automatizada sigue bloqueada; la apariencia no se ha verificado en un teléfono real.
