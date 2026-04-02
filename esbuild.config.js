// @ts-check
const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

/**
 * Build 1: Extension host bundle (CommonJS, runs in Node.js)
 * Externalises `vscode` — provided by VSCode runtime, never bundled.
 *
 * @type {import('esbuild').BuildOptions}
 */
const extensionBuild = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProduction,
  minify: isProduction,
  logLevel: 'info',
};

/**
 * Build 2: Cursor-trail renderer bundle (IIFE, runs in workbench renderer)
 * This is the script injected into workbench.html.
 * - No `vscode` dependency (renderer context)
 * - Wrapped in an IIFE so it doesn't pollute the global scope
 * - Output is read at runtime by scriptBuilder.ts
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
  sourcemap: false, // inline in workbench.html — no sourcemap needed
  minify: isProduction,
  logLevel: 'info',
  // Suppress TS `declare const` errors — these are supplied at runtime
  define: {
    TRAIL_COLOR: '"#00AAFF"',
    CURSOR_STYLE: '"line"',
    TRAIL_LENGTH: '8',
    CURSOR_UPDATE_POLLING_RATE: '500',
    USE_SHADOW: 'false',
    SHADOW_COLOR: '"#00AAFF"',
    SHADOW_BLUR: '15',
  },
};

async function main() {
  if (isWatch) {
    const [extCtx, trailCtx] = await Promise.all([
      esbuild.context(extensionBuild),
      esbuild.context(trailBuild),
    ]);
    await Promise.all([extCtx.watch(), trailCtx.watch()]);
    console.log('[esbuild] watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(extensionBuild),
      esbuild.build(trailBuild),
    ]);
  }
}

main().catch(() => process.exit(1));
