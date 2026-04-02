import * as vscode from 'vscode';

/**
 * statusBar.ts
 *
 * Manages the persistent status bar indicator in the bottom-right corner.
 *
 *   $(sparkle) Cursor Trail: ON    ← enabled
 *   $(circle-slash) Cursor Trail: OFF   ← disabled
 *
 * Clicking the item toggles the trail (calls enable / disable command).
 */

let item: vscode.StatusBarItem | undefined;

/**
 * Create and show the status bar item.
 * Call this once from extension.activate().
 */
export function createStatusBar(context: vscode.ExtensionContext): void {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(item);
  item.show();
}

/**
 * Update the status bar text and tooltip to reflect the current enabled state.
 * Also wire up the correct toggle command.
 */
export function updateStatusBar(enabled: boolean): void {
  if (!item) return;
  if (enabled) {
    item.text = '$(sparkle) Cursor Trail: ON';
    item.tooltip = 'Cursor Trail is active — click to disable';
    item.command = 'cursorTrail.disable';
    item.color = undefined; // default theme colour
  } else {
    item.text = '$(circle-slash) Cursor Trail: OFF';
    item.tooltip = 'Cursor Trail is inactive — click to enable';
    item.command = 'cursorTrail.enable';
    item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
  }
}

/**
 * Dispose the status bar item (called from deactivate if needed).
 */
export function disposeStatusBar(): void {
  item?.dispose();
  item = undefined;
}
