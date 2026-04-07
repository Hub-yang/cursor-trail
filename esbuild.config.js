// @ts-check
const esbuild = require('esbuild')

const isWatch = process.argv.includes('--watch')
const isProduction = process.argv.includes('--production')

/**
 * 构建目标 1：插件主进程 bundle（CommonJS，运行在 Node.js Extension Host）
 *
 * 注意：`vscode` 必须声明为 external，由 VSCode 运行时提供，不参与打包。
 *
 * @type {import('esbuild').BuildOptions}
 */
const extensionBuild = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'], // VSCode 运行时提供，不打包
  format: 'cjs', // VSCode 插件必须是 CommonJS
  platform: 'node',
  target: 'node18',
  sourcemap: !isProduction, // 生产构建不生成 source map
  minify: isProduction,
  logLevel: 'info',
}

/**
 * 构建目标 2：光标拖尾渲染脚本 bundle（IIFE，运行在 workbench 渲染进程）
 *
 * 这段代码会被 scriptBuilder.ts 读取后内联注入到 workbench.html 的 <script> 标签中。
 * - 不依赖 vscode 模块（渲染进程环境）
 * - 使用 IIFE 格式避免污染全局作用域
 * - define 字段为编译期占位，运行时由 scriptBuilder 在代码头部注入真实常量
 *
 * @type {import('esbuild').BuildOptions}
 */
const trailBuild = {
  entryPoints: ['src/trail/cursorTrail.ts'],
  bundle: true,
  outfile: 'dist/cursorTrail.iife.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  sourcemap: false, // 注入到 workbench.html 内联代码，不需要 source map
  minify: isProduction,
  logLevel: 'info',
  // 编译期占位常量，防止 esbuild 报未定义变量错误
  // 运行时这些值会被 scriptBuilder.ts 在代码头部真正注入
  define: {
    TRAIL_COLOR: '"#00AAFF"',
    CURSOR_STYLE: '"line"',
    TRAIL_LENGTH: '8',
    CURSOR_UPDATE_POLLING_RATE: '500',
    USE_SHADOW: 'false',
    SHADOW_COLOR: '"#00AAFF"',
    SHADOW_BLUR: '15',
  },
}

async function main() {
  if (isWatch) {
    // 监听模式：两个构建目标同时 watch，任意文件变更都会触发增量重编
    const [extCtx, trailCtx] = await Promise.all([
      esbuild.context(extensionBuild),
      esbuild.context(trailBuild),
    ])
    await Promise.all([extCtx.watch(), trailCtx.watch()])
    console.log('[esbuild] 监听文件变更中...')
  }
  else {
    // 单次构建：两个目标并行执行
    await Promise.all([
      esbuild.build(extensionBuild),
      esbuild.build(trailBuild),
    ])
  }
}

main().catch(() => process.exit(1))
