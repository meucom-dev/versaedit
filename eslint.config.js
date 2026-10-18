import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'test-results',
      'playwright-report',
      'examples/*/node_modules',
      'examples/*/dist',
      'examples/*/.next',
    ],
  },
  {
    files: [
      'src/**/*.{ts,tsx}',
      'playground/**/*.{ts,tsx}',
      'tests/**/*.ts',
      'examples/*/src/**/*.{ts,tsx}',
      'examples/*/app/**/*.{ts,tsx}',
      'docs/recipes/**/*.ts',
    ],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintPluginReact.configs.flat.recommended,
      eslintPluginReact.configs.flat['jsx-runtime'],
      eslintConfigPrettier,
    ],
    plugins: { 'react-hooks': eslintPluginReactHooks },
    languageOptions: {
      globals: globals.browser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
    },
  },
)
