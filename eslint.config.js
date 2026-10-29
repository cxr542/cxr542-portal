import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'public/**', 'apps/prompt-actions/public/prompt-collection/js/db.js', '.cache/**', '.vercel/**', '.omo/**']),
  {
    files: ['server/prompts/**/*.mjs', 'api/prompt-mcp.mjs', 'api/prompts/**/*.mjs', 'api/prompt-auth/**/*.mjs', 'api/prompt-oauth/**/*.mjs', 'scripts/{build-prompts,build-prompts-pilot,build-prompts-preview,check-prompts-native,check-prompts-mcp-native,check-prompts-oauth-native,check-prompts-pilot,prompts-qa-server,version-cloud}.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        __PORTAL_BUILD_ENV__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
