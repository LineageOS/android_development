const {defineConfig, globalIgnores} = require('eslint/config');

const prettier = require('eslint-plugin-prettier');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const globals = require('globals');
const js = require('@eslint/js');
const unusedImports = require('eslint-plugin-unused-imports');

const {FlatCompat} = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  {
    files: ['**/*.ts', '**/*.js'],
    extends: compat.extends('eslint-config-prettier', 'eslint:recommended', 'plugin:@typescript-eslint/recommended'),

    plugins: {
      prettier,
      '@typescript-eslint': typescriptEslint,
      'unused-imports': unusedImports,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {},

      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.webextensions,
        ...globals.jasmine,
        ...globals.protractor,
        NodeJS: true,
      },
    },

    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'no-var': 'error',

      'prefer-const': [
        'error',
        {
          destructuring: 'all',
        },
      ],

      'prefer-rest-params': 'error',
      'prefer-spread': 'error',

      'no-restricted-imports': [
        'error',
        {
          'patterns': ['..*'],
        },
      ],
    },
  },
  globalIgnores(['src/trace_processor/perfetto/', '**/webpack.config.js']),
]);
