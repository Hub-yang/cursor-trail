import * as fs from 'fs';
import * as path from 'path';
import { backup } from './backupManager';

/**
 * injector.ts
 *
 * Reads workbench.html, injects / removes the cursor trail script block,
 * and writes the file back atomically.
 *
 * Injection markers:
 *   <!-- cursor-trail-start -->
 *   <script>…generated code…</script>
 *   <!-- cursor-trail-end -->
 *
 * The entire block (including markers) is inserted just before </html>.
 */

const MARKER_START = '<!-- cursor-trail-start -->';
const MARKER_END = '<!-- cursor-trail-end -->';
const INJECTION_RE = /<!-- cursor-trail-start -->[\s\S]*?<!-- cursor-trail-end -->\n?/;

/**
 * Write content to a file atomically: write to a temp file then rename.
 * This prevents a crash mid-write from corrupting workbench.html.
 */
function atomicWrite(filePath: string, content: string): void {
  const tmp = filePath + '.tmp-cursor-trail';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

/**
 * Returns true if the cursor trail script has already been injected.
 */
export function isInjected(workbenchPath: string): boolean {
  try {
    const content = fs.readFileSync(workbenchPath, 'utf8');
    return content.includes(MARKER_START);
  } catch {
    return false;
  }
}

/**
 * Inject the given script string into workbench.html.
 *
 * - Creates a backup if one does not already exist.
 * - If a previous injection exists, it is replaced (idempotent).
 * - Inserts the script block just before </html>.
 *
 * Throws on EACCES (permission error) — the caller should surface
 * a platform-specific fix message to the user.
 */
export function inject(workbenchPath: string, scriptContent: string): void {
  // Ensure backup exists before modifying the file
  backup(workbenchPath);

  let html = fs.readFileSync(workbenchPath, 'utf8');

  // Remove any existing injection first (replace-all semantics)
  html = html.replace(INJECTION_RE, '');

  const block =
    `${MARKER_START}\n` +
    `<script>\n${scriptContent}\n</script>\n` +
    `${MARKER_END}\n`;

  if (html.includes('</html>')) {
    html = html.replace('</html>', `${block}</html>`);
  } else {
    // Fallback: append to end of file
    html = html + '\n' + block;
  }

  atomicWrite(workbenchPath, html);
}

/**
 * Remove the injected script block from workbench.html.
 * No-op if the injection is not present.
 */
export function remove(workbenchPath: string): void {
  let html = fs.readFileSync(workbenchPath, 'utf8');
  if (!html.includes(MARKER_START)) return;
  html = html.replace(INJECTION_RE, '');
  atomicWrite(workbenchPath, html);
}

/**
 * Returns a human-readable permission fix command for the current platform,
 * given the workbench.html path.
 */
export function permissionFixCommand(workbenchPath: string): string {
  const resourceDir = path.dirname(path.dirname(path.dirname(workbenchPath)));
  if (process.platform === 'darwin') {
    return `sudo chown -R $(whoami) "${resourceDir}"`;
  } else if (process.platform === 'win32') {
    return `icacls "${resourceDir}" /grant %USERNAME%:F /t`;
  } else {
    // Linux — common paths differ by installation method
    return `sudo chown -R $(whoami) "${resourceDir}"`;
  }
}
