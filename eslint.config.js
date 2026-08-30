import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', 'supabase/.temp/**', 'supabase/.branches/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['**/test/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    // Build steps that run under Node rather than in a browser or a worker.
    files: ['**/scripts/**/*.js', '**/scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly' } },
  },
  {
    // Service workers have no window; `self` is their global.
    files: ['**/public/service-worker.js'],
    languageOptions: { globals: { self: 'readonly' } },
  },
)
