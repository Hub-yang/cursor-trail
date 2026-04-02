import * as vscode from 'vscode';
import { resolveWorkbenchPath } from './core/pathResolver';
import { isInjected, inject, remove, permissionFixCommand } from './core/injector';
import { restore } from './core/backupManager';
import { getConfig, setEnabled, onConfigChange } from './config/configManager';
import { buildScript } from './config/scriptBuilder';
import { createStatusBar, updateStatusBar } from './ui/statusBar';

/**
 * extension.ts
 *
 * Plugin entry point.  Responsibilities (assembly only, no business logic):
 *   1. On activate: detect injection state, register commands, init status bar,
 *      start config-change listener.
 *   2. On deactivate: nothing — subscriptions are disposed automatically.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Show an info notification with an optional "Reload Window" action button. */
async function notifyReload(message: string): Promise<void> {
  const action = await vscode.window.showInformationMessage(message, 'Reload Window');
  if (action === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

/** Surface a permission error to the user with a platform-specific fix command. */
function notifyPermissionError(workbenchPath: string): void {
  const cmd = permissionFixCommand(workbenchPath);
  vscode.window.showErrorMessage(
    `Cursor Trail: No write permission to workbench.html.\n` +
    `Run this command in your terminal, then try again:\n\n${cmd}`,
    { modal: true }
  );
}

/** Try to inject; handle EACCES gracefully. */
function safeInject(workbenchPath: string): boolean {
  try {
    const config = getConfig();
    const script = buildScript(config);
    inject(workbenchPath, script);
    return true;
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'EACCES') {
      notifyPermissionError(workbenchPath);
    } else {
      vscode.window.showErrorMessage(`Cursor Trail: Unexpected error — ${e.message}`);
    }
    return false;
  }
}

/** Try to remove injection; handle EACCES gracefully. */
function safeRemove(workbenchPath: string): boolean {
  try {
    remove(workbenchPath);
    return true;
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'EACCES') {
      notifyPermissionError(workbenchPath);
    } else {
      vscode.window.showErrorMessage(`Cursor Trail: Unexpected error — ${e.message}`);
    }
    return false;
  }
}

// ─── Activate ────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  // Resolve workbench.html path (throws if not found)
  let workbenchPath: string;
  try {
    workbenchPath = resolveWorkbenchPath();
  } catch (err: unknown) {
    vscode.window.showErrorMessage(`Cursor Trail: ${(err as Error).message}`);
    return;
  }

  // ── 1. Init status bar ────────────────────────────────────────────────────
  createStatusBar(context);
  const config = getConfig();
  updateStatusBar(config.enabled);

  // ── 2. Detect VSCode update (injection marker gone) ───────────────────────
  const injected = isInjected(workbenchPath);
  if (config.enabled && !injected) {
    vscode.window
      .showWarningMessage(
        'Cursor Trail: VSCode may have updated and the trail effect was removed. ' +
        'Click Reload to re-inject.',
        'Reload'
      )
      .then(action => {
        if (action === 'Reload') {
          if (safeInject(workbenchPath)) {
            notifyReload('Cursor Trail re-injected. Reload window to activate.');
          }
        }
      });
  }

  // ── 3. Register commands ──────────────────────────────────────────────────

  const cmdEnable = vscode.commands.registerCommand('cursorTrail.enable', async () => {
    const ok = safeInject(workbenchPath);
    if (ok) {
      await setEnabled(true);
      updateStatusBar(true);
      await notifyReload('Cursor Trail enabled. Reload window to activate.');
    }
  });

  const cmdDisable = vscode.commands.registerCommand('cursorTrail.disable', async () => {
    let ok: boolean;
    try {
      restore(workbenchPath);   // prefer restoring clean backup
      ok = true;
    } catch {
      ok = safeRemove(workbenchPath); // fallback: regex-remove the block
    }
    if (ok) {
      await setEnabled(false);
      updateStatusBar(false);
      await notifyReload('Cursor Trail disabled. Reload window to apply.');
    }
  });

  const cmdReload = vscode.commands.registerCommand('cursorTrail.reload', async () => {
    const ok = safeInject(workbenchPath);
    if (ok) {
      await setEnabled(true);
      updateStatusBar(true);
      await notifyReload('Cursor Trail re-injected. Reload window to activate.');
    }
  });

  // ── 4. Config-change listener (ADR-004) ───────────────────────────────────
  const configWatcher = onConfigChange(newConfig => {
    updateStatusBar(newConfig.enabled);

    // Only re-inject when the effect is actively enabled
    if (!newConfig.enabled) return;

    const ok = safeInject(workbenchPath);
    if (ok) {
      notifyReload('Cursor Trail: Config updated. Reload window to apply.');
    }
  });

  context.subscriptions.push(cmdEnable, cmdDisable, cmdReload, configWatcher);
}

export function deactivate(): void {
  // VSCode disposes all context.subscriptions automatically.
  // Nothing extra needed here.
}
