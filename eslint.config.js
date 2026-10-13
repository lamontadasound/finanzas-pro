import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // Código vendido tal cual desde el registro oficial de Bklit
    // (https://ui.bklit.com) vía `npx shadcn add @bklit/...`. No es código
    // propio — se excluye del lint igual que se excluiría node_modules.
    // Las únicas ediciones hechas aquí son 2 rutas de import rotas en el
    // propio paquete publicado, documentadas inline en esos ficheros.
    'src/components/charts/**',
    'src/components/shimmering-text.tsx',
    'src/lib/profit-loss-segments.ts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
