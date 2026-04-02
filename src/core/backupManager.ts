import * as fs from 'fs';

/**
 * backupManager.ts
 *
 * Manages the backup of workbench.html before any injection.
 * Backup file: <original>.bak-cursor-trail (same directory as workbench.html).
 *
 * Rules:
 *  - Backup is always a CLEAN (non-injected) copy.
 *  - backup() is a no-op if the backup already exists (idempotent).
 *  - restore() overwrites the current workbench.html with the backup.
 */

function backupPath(workbenchPath: string): string {
  return workbenchPath + '.bak-cursor-trail';
}

/**
 * Create a backup of workbench.html if one does not already exist.
 * Should be called when workbench.html is in a clean (non-injected) state.
 */
export function backup(workbenchPath: string): void {
  const bak = backupPath(workbenchPath);
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(workbenchPath, bak);
  }
}

/**
 * Restore the clean workbench.html from backup.
 * Throws if the backup file does not exist.
 */
export function restore(workbenchPath: string): void {
  const bak = backupPath(workbenchPath);
  if (!fs.existsSync(bak)) {
    throw new Error(
      `Backup file not found: ${bak}\n` +
      `Cannot restore workbench.html without a backup.`
    );
  }
  // Atomic-ish: copy backup → temp → rename
  const tmp = workbenchPath + '.tmp-cursor-trail';
  fs.copyFileSync(bak, tmp);
  fs.renameSync(tmp, workbenchPath);
}

/**
 * Returns true if a backup file exists.
 */
export function hasBackup(workbenchPath: string): boolean {
  return fs.existsSync(backupPath(workbenchPath));
}
