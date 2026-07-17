import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'main.js',
      'preview/harness.js',
      'preview/sample-data.js',
      'node_modules/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...obsidianmd.configs.recommended,
  prettier,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'obsidianmd/ui/sentence-case': [
        'error',
        { brands: ['Agentage', 'Agentage Memory', 'Agentage Galaxy'], acronyms: ['3D', 'AI'] },
      ],
    },
  },
  {
    // vi.fn() mock assertions trip the type-aware unbound-method check; tests are not shipped.
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  }
);
