const {defineConfig, globalIgnores} = require('eslint/config');

const prettier = require('eslint-plugin-prettier');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const globals = require('globals');
const js = require('@eslint/js');
const unusedImports = require('eslint-plugin-unused-imports');
const eslintPluginWinscope = require('./scripts/eslint-plugin-winscope.js');

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
      winscope: eslintPluginWinscope,
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
      'winscope/sort-imports': 'error',
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            BigInt: {
              message: 'Use bigint instead',
              fixWith: 'bigint',
            },
            String: {
              message: 'Use string instead',
              fixWith: 'string',
            },
            Number: {
              message: 'Use number instead',
              fixWith: 'number',
            },
            Boolean: {
              message: 'Use boolean instead',
              fixWith: 'boolean',
            },
            Object: {
              message: 'Use {} or "object" instead.',
            },
          },
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
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
          patterns: ['..*'],
        },
      ],
      curly: ['error', 'multi-line'],
      eqeqeq: ['error', 'always', {null: 'ignore'}],
      'no-eval': 'error',
      'no-caller': 'error',
      'no-throw-literal': 'error',
      'no-new-wrappers': 'error',
      'no-undef-init': 'error',
      radix: 'error',
      'guard-for-in': 'error',
      'object-shorthand': 'error',
      'no-trailing-spaces': 'error',
    },
  },
  {
    files: ['src/trace_processor/perfetto/**/*.ts', 'src/trace_processor/perfetto/**/*.js'],
    rules: {
      'no-case-declarations': 'off',
      'no-restricted-imports': 'off',
    },
  },
  globalIgnores(['**/webpack.config.js', '**/zone*.ts']),
]);
