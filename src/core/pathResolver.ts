import * as fs from 'fs';
import * as path from 'path';

/**
 * pathResolver.ts
 *
 * Locates the workbench.html file for the running VSCode instance across
 * macOS (.app bundle), Windows (user + system install), and Linux
 * (deb, rpm, snap, AppImage).
 *
 * Strategy: start from `process.execPath` (the VSCode binary path) and
 * walk upward to find `resources/app/out/vs/workbench/workbench.desktop.main.html`.
 */

const WORKBENCH_RELATIVE =
  'resources/app/out/vs/workbench/workbench.desktop.main.html';

/**
 * Build a list of candidate absolute paths based on the current executable.
 */
function buildCandidates(execPath: string): string[] {
  const candidates: string[] = [];

  // macOS: /Applications/Visual Studio Code.app/Contents/MacOS/Electron
  //   → go up 3 levels → .app/Contents  → + Resources/...
  // But VSCode puts workbench under:
  //   .app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.html
  // process.execPath on macOS is inside MacOS/, so we need to go up 2 dirs
  // to reach Contents, then navigate normally.
  const macOsBase = path.resolve(execPath, '..', '..'); // .app/Contents
  candidates.push(path.join(macOsBase, WORKBENCH_RELATIVE));

  // Windows / Linux: execPath is the binary itself, workbench is a few levels up
  // e.g. C:\Users\…\AppData\Local\Programs\Microsoft VS Code\Code.exe
  //      /usr/share/code/code
  // Try walking up 1–3 levels and appending the relative path.
  let dir = path.dirname(execPath);
  for (let i = 0; i < 4; i++) {
    candidates.push(path.join(dir, WORKBENCH_RELATIVE));
    dir = path.dirname(dir);
  }

  return candidates;
}

/**
 * Return the absolute path to workbench.html for the running VSCode instance.
 * Throws an Error if the file cannot be found.
 */
export function resolveWorkbenchPath(): string {
  const execPath = process.execPath;
  const candidates = buildCandidates(execPath);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // existsSync can throw on permission errors; continue to next candidate
    }
  }

  throw new Error(
    `Cannot locate workbench.html.\n` +
    `Tried:\n${candidates.map(c => `  ${c}`).join('\n')}\n\n` +
    `Please open a GitHub issue and include your OS and VSCode installation path.`
  );
}
