import * as fs from 'fs';
import * as path from 'path';
import type { CursorTrailConfig } from './configManager';

/**
 * scriptBuilder.ts
 *
 * Compiles a CursorTrailConfig into a self-contained JavaScript string that
 * can be injected into workbench.html as an inline <script> block.
 *
 * Strategy (ADR-002):
 *   1. Read the compiled cursorTrail JS from dist/cursorTrail.js (produced by
 *      the separate esbuild step for the trail bundle).
 *   2. Prepend constant declarations that match the `declare const …` stubs
 *      in cursorTrail.ts.
 *   3. Wrap everything in an IIFE to avoid polluting the global scope.
 *
 * The trail bundle is built as a separate esbuild entry so it has no
 * CommonJS wrapper — it is a plain script suitable for inline use.
 */

/**
 * At runtime __dirname === dist/ (after esbuild bundles extension.ts).
 * The trail IIFE is built to dist/cursorTrail.iife.js by the same build step.
 */
const TRAIL_BUNDLE_PATH = path.join(__dirname, 'cursorTrail.iife.js');

/**
 * Build a JS string ready for inline injection.
 * Falls back to an embedded minimal implementation if the bundle is missing
 * (useful during development when the trail hasn't been built yet).
 */
export function buildScript(config: CursorTrailConfig): string {
  const { color, style, trailLength } = config;

  // Config constants injected at the top of the script
  const constants = [
    `const TRAIL_COLOR = ${JSON.stringify(color)};`,
    `const CURSOR_STYLE = ${JSON.stringify(style)};`,
    `const TRAIL_LENGTH = ${trailLength};`,
    `const CURSOR_UPDATE_POLLING_RATE = 500;`,
    `const USE_SHADOW = false;`,
    `const SHADOW_COLOR = ${JSON.stringify(color)};`,
    `const SHADOW_BLUR = 15;`,
  ].join('\n');

  let trailCode: string;
  try {
    trailCode = fs.readFileSync(TRAIL_BUNDLE_PATH, 'utf8');
  } catch {
    // Bundle not yet built — emit a console warning in the renderer
    trailCode = `console.warn('[cursor-trail] Trail bundle not found. Run: npm run build:trail');`;
  }

  return [
    `// cursor-trail v0.1.0 — auto-generated, do not edit`,
    constants,
    trailCode,
  ].join('\n\n');
}
