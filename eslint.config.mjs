import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    '**/node_modules',
    '**/dist',
    'app/src-tauri/target',
    'app/src-tauri/gen',
    'app/src-tauri/data',
  ]),

  // 所有 TS 文件的通用规则
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },

  // 前端（Tauri + React，浏览器环境）
  {
    files: ['app/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  // Node 端：数据管线、共享包、各类配置文件
  {
    files: ['pipeline/**/*.ts', 'packages/**/*.ts', '**/*.config.{ts,js,mjs}'],
    languageOptions: { globals: globals.node },
  },
])
