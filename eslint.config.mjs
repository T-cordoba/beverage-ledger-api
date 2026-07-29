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
      // A diferencia del scaffold por defecto, `any` es un error: la razón de
      // separar el backend es tener un contrato tipado de punta a punta.
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

      // Ver CLAUDE.md: solo los repositorios tocan Prisma. Los services trabajan
      // contra repositorios para no acoplar la lógica de negocio al ORM.
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
    // Las dos excepciones legítimas a la regla anterior: PrismaService, que es
    // quien envuelve al cliente, y el seed, que corre fuera del contenedor de Nest.
    files: ['src/infra/prisma/**/*.ts', 'prisma/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-console': 'off',
    },
  },
);
