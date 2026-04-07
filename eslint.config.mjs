import antfu from '@antfu/eslint-config'

export default antfu(
  // ── 项目基础配置 ────────────────────────────────────────────────────────────
  {
    // VSCode 插件属于工具库，非 Web App
    type: 'lib',

    // TypeScript 全量检测
    typescript: true,

    // JSON with Comments 支持（tsconfig.json / .vscode/*.json 均为 JSONC）
    jsonc: true,

    // 不涉及 Vue / React，明确关闭避免引入无关规则
    vue: false,
    jsx: false,

    // 代码风格：与项目现有风格保持一致
    stylistic: {
      indent: 2,
      quotes: 'single',
      semi: false,
    },
  },

  // ── Node.js Extension Host 专属规则 ─────────────────────────────────────────
  {
    files: ['src/**/*.ts'],
    rules: {
      // Node.js 内置模块（fs、path 等）在 Extension Host 中始终可用，无需检测
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',

      // VSCode 插件 activate/deactivate 必须具名导出，禁止默认导出
      'import/no-default-export': 'error',

      // 允许在 catch 块中使用空参数（已有多处 catch {} 忽略错误的写法）
      'no-empty': ['error', { allowEmptyCatch: false }],

      // 工具函数常以 _ 开头标记忽略变量
      'unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },

  // ── 渲染端注入脚本（编译为 IIFE，内部工具函数无需显式返回类型）──────────────
  {
    files: ['src/trail/cursorTrail.ts'],
    rules: {
      // 内部闭包函数不要求显式返回类型，避免过度冗余
      'ts/explicit-function-return-type': 'off',
    },
  },

  // ── 构建脚本（CJS 格式，process 为全局变量，允许 require）───────────────────
  {
    files: ['esbuild.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // CJS 脚本中 process 直接作为全局变量使用，无需 require('node:process')
      'node/prefer-global/process': 'off',
    },
  },

  // ── 忽略构建产物与依赖目录 ──────────────────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'out/**',
      'node_modules/**',
    ],
  },
)
