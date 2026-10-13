# Presupuesto abierto al cambiar de aplicación

Corrección acotada en `src/store/useAuthStore.ts`: los eventos SIGNED_IN/TOKEN_REFRESHED del mismo usuario mantienen la pantalla mientras se revalidan sus permisos. Si todos los campos del perfil coinciden, se conserva su referencia para evitar que DataLoader/useStore vacíen los datos y desmonten el editor.

El cierre de sesión, cambio de identidad, perfil inactivo o permisos modificados siguen retirando/revalidando el acceso. No se cambia el guardado de presupuestos: Guardar sigue siendo necesario ante una recarga completa o cierre del navegador.

Verificación: seis pruebas específicas de conservación de campos, referencia estable, cambio de usuario, cierre, desactivación y respuestas tardías; ESLint limitado a los dos archivos modificados. Compilación de producción en Vercel. Sin prueba visual autenticada por el bloqueo previo del navegador.

Referencia técnica: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
