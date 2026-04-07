import * as vscode from 'vscode'

/**
 * configManager.ts
 *
 * 所有 cursorTrail.* 配置项的唯一读取入口。
 * 其他模块不得直接调用 vscode.workspace.getConfiguration，统一通过此模块访问。
 */

export interface CursorTrailConfig {
  enabled: boolean
  color: string
  style: 'line' | 'block'
  trailLength: number
}

const SECTION = 'cursorTrail'

/**
 * 从 VSCode 设置中读取当前配置。
 */
export function getConfig(): CursorTrailConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION)
  return {
    enabled: cfg.get<boolean>('enabled', false),
    color: cfg.get<string>('color', '#00AAFF'),
    style: cfg.get<'line' | 'block'>('style', 'line'),
    trailLength: cfg.get<number>('trailLength', 8),
  }
}

/**
 * 将 `enabled` 状态持久化到全局设置（Global 作用域，跨工作区生效）。
 */
export async function setEnabled(value: boolean): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION)
  await cfg.update('enabled', value, vscode.ConfigurationTarget.Global)
}

/**
 * 注册配置变更监听器，当任意 cursorTrail.* 配置项发生变化时触发回调。
 * 返回 Disposable，调用方需将其加入 context.subscriptions 以便自动销毁。
 */
export function onConfigChange(
  callback: (config: CursorTrailConfig) => void,
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(SECTION)) {
      callback(getConfig())
    }
  })
}
