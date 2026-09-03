// ESLint flat config：typescript-eslint（recommended）+ react-hooks。
// 口径：零 error 才算完成（AGENTS.md）；warning 可容忍。
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // 数组下标作 key 的检查交给 code review（编辑器网格场景有合法用例）
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'vite.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
