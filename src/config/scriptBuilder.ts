import type { CursorTrailConfig } from './configManager'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * scriptBuilder.ts
 *
 * 将 CursorTrailConfig 编译为可内联注入 workbench.html 的完整 JS 字符串。
 *
 * 构建策略（参见 ADR-002）：
 *   1. 从 dist/cursorTrail.iife.js 读取已编译的动画脚本（由独立的 esbuild 步骤生成）。
 *   2. 在脚本头部追加常量声明，对应 cursorTrail.ts 中的 `declare const …` 占位。
 *   3. 整体无需额外包裹——esbuild 的 IIFE 格式已避免全局作用域污染。
 *
 * trail bundle 以独立入口构建，产物为纯脚本，不含 CommonJS 包装，可直接内联使用。
 */

/**
 * 运行时 __dirname 指向 dist/（esbuild 打包 extension.ts 后的输出目录）。
 * trail IIFE 同样输出到 dist/cursorTrail.iife.js，与主 bundle 同级。
 */
const TRAIL_BUNDLE_PATH = path.join(__dirname, 'cursorTrail.iife.js')

/**
 * 生成可直接注入的 JS 字符串。
 * 若 trail bundle 尚未构建，降级输出一条渲染进程控制台警告（方便开发期排查）。
 */
export function buildScript(config: CursorTrailConfig): string {
  const { color, style, trailLength } = config

  // 将用户配置编译为常量声明，注入到脚本最顶部
  const constants = [
    `const TRAIL_COLOR = ${JSON.stringify(color)};`,
    `const CURSOR_STYLE = ${JSON.stringify(style)};`,
    `const TRAIL_LENGTH = ${trailLength};`,
    `const CURSOR_UPDATE_POLLING_RATE = 500;`,
    `const USE_SHADOW = false;`,
    `const SHADOW_COLOR = ${JSON.stringify(color)};`,
    `const SHADOW_BLUR = 15;`,
  ].join('\n')

  let trailCode: string
  try {
    trailCode = fs.readFileSync(TRAIL_BUNDLE_PATH, 'utf8')
  }
  catch {
    // bundle 尚未构建，在渲染进程控制台输出警告，提示执行构建命令
    trailCode = `console.warn('[cursor-trail] Trail bundle not found. Run: pnpm build');`
  }

  return [
    `// cursor-trail v0.1.0 — 自动生成，请勿手动编辑`,
    constants,
    trailCode,
  ].join('\n\n')
}
