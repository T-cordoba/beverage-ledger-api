// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'src/generated/**', 'prisma/data/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Stricter than the default scaffold: the point of splitting the backend
      // out was an end-to-end typed contract.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // Only repositories touch Prisma, so business logic stays decoupled from
      // the ORM.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/generated/prisma/client'],
              importNamePattern: '^PrismaClient$',
              message:
                'No instancies PrismaClient directamente: inyecta PrismaService desde infra/prisma.',
            },
          ],
        },
      ],

      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // The two legitimate exceptions: PrismaService wraps the client, and the
    // seed runs outside the Nest container.
    files: ['src/infra/prisma/**/*.ts', 'prisma/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-console': 'off',
    },
  },
);
