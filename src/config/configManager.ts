import * as vscode from 'vscode';

/**
 * configManager.ts
 *
 * Single source of truth for all cursorTrail.* configuration values.
 * No other module should call vscode.workspace.getConfiguration directly.
 */

export interface CursorTrailConfig {
  enabled: boolean;
  color: string;
  style: 'line' | 'block';
  trailLength: number;
}

const SECTION = 'cursorTrail';

/**
 * Read the current configuration from VSCode settings.
 */
export function getConfig(): CursorTrailConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    enabled: cfg.get<boolean>('enabled', false),
    color: cfg.get<string>('color', '#00AAFF'),
    style: cfg.get<'line' | 'block'>('style', 'line'),
    trailLength: cfg.get<number>('trailLength', 8),
  };
}

/**
 * Persist `enabled` state to workspace/global settings.
 * Uses Global scope so the setting survives across workspaces.
 */
export async function setEnabled(value: boolean): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update('enabled', value, vscode.ConfigurationTarget.Global);
}

/**
 * Register a listener that fires whenever any cursorTrail.* setting changes.
 * Returns a Disposable to be pushed into context.subscriptions.
 */
export function onConfigChange(
  callback: (config: CursorTrailConfig) => void
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration(SECTION)) {
      callback(getConfig());
    }
  });
}
