# Finanzas Pro: versión publicada

Código del despliegue `dpl_HD4htMmREYVhc8yruGB4HJPvnkei`, comprobado el 13 de octubre de 2026. Los archivos originales incluidos coinciden byte a byte con el manifiesto fuente de Vercel.

Se excluyen entornos con valores, caché de Supabase e índice privado `supabase/drive-archive-seed.json` (datos, no código). Se añaden este documento, `.gitignore` y `.env.example` vacío.

## Desarrollo local

Node.js 24. Ejecutar `npm ci`, copiar `.env.example` a `.env.local`, completar sus dos variables y ejecutar `npm run dev`.

## Variables

Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Funciones Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Google Drive usa OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`) o cuenta de servicio (`GOOGLE_SERVICE_ACCOUNT_JSON`).

Configuración opcional con valores predeterminados: `APP_URL`, `ALLOWED_ORIGINS`, `DRIVE_ARCHIVE_ROOT_ID`.

Las claves del servidor se configuran exclusivamente en Supabase, nunca en variables VITE. Esta copia no contiene datos de la base de datos ni documentos de clientes. El código de sincronización está incluido; las credenciales se configuran aparte.

Vercel tiene vinculado `lamontadasound/finanzas-pro`, rama de producción `main`. El despliegue exportado se creó por CLI, sin commit Git de origen.
