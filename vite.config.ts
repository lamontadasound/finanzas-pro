/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// ── Excluye el arnés de pruebas visuales (src/dev/**) del build de
// producción — DE VERDAD, no solo por ruta inalcanzable. Antes, el
// `import()` dinámico de `DevPreview` en App.tsx generaba igualmente un
// chunk en `dist/` (Rollup detecta `import()` de forma estática con
// independencia de si el `if (import.meta.env.DEV)` que lo envuelve es
// "muerto" en producción — no lo elimina solo por eso). Este plugin
// sustituye cualquier módulo bajo `src/dev/` por un stub vacío cuando
// `mode === 'production'`, así ni el código del arnés ni sus fixtures
// llegan al bundle final. Verificado: `grep -r "fixtureFacturas" dist/`
// no debe encontrar nada tras `npm run build`.
function stripDevHarnessInProd(mode: string): Plugin {
  // Cubre tanto la ruta absoluta ya resuelta (.../src/dev/algo.ts) como el
  // especificador relativo del primer import ("./dev/DevPreview" desde
  // App.tsx, que no contiene "src/" porque ya está dentro de src/).
  const ABSOLUTA = /[\\/]src[\\/]dev[\\/]/;
  const RELATIVA = /(^|[\\/])dev[\\/]/;
  return {
    name: 'strip-dev-harness-in-prod',
    enforce: 'pre',
    resolveId(source, importer) {
      if (mode !== 'production') return null;
      const esDelArnes =
        ABSOLUTA.test(source) ||
        (source.startsWith('.') && RELATIVA.test(source)) ||
        (importer != null && ABSOLUTA.test(importer) && source.startsWith('.'));
      if (esDelArnes) return '\0empty-dev-harness';
      return null;
    },
    load(id) {
      if (id === '\0empty-dev-harness') {
        return 'export const DevPreview = () => null; export default {};';
      }
      return null;
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), stripDevHarnessInProd(mode)],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    // Alias añadido únicamente para poder instalar componentes del registro
    // de Bklit (shadcn/ui), que importan entre sí con "@/...". No afecta a
    // ningún import relativo existente en la app.
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
