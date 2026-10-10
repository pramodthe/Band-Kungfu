import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['vendor/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    ignores: ['src/server/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.js', '*.mjs', 'src/server/**/*.js', 'agents/**/*.mjs', 'test/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
];
