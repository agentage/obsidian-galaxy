import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

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
  ...tseslint.configs.recommended,
  ...obsidianmd.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { prettier: prettierPlugin },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'interface', format: ['PascalCase'] },
        { selector: 'typeAlias', format: ['PascalCase'] },
      ],
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'no-var': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'obsidianmd/ui/sentence-case': [
        'error',
        { brands: ['Agentage', 'Agentage Memory', 'Agentage Galaxy'], acronyms: ['3D', 'AI'] },
      ],
      // Obsidian's directory autoscan enables these beyond the recommended set.
      'obsidianmd/prefer-active-doc': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
    },
  },
  {
    // vi.fn() mock assertions trip the type-aware unbound-method check; tests are not shipped.
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  }
);
