import * as vscode from 'vscode'

/**
 * statusBar.ts
 *
 * 管理右下角状态栏的常驻指示器。
 *
 *   $(sparkle) Cursor Trail: ON      ← 已启用
 *   $(circle-slash) Cursor Trail: OFF ← 已禁用
 *
 * 点击指示器可快速切换启用/禁用状态（调用对应命令）。
 */

let item: vscode.StatusBarItem | undefined

/**
 * 创建并显示状态栏指示器。
 * 在 extension.activate() 中调用一次即可。
 */
export function createStatusBar(context: vscode.ExtensionContext): void {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  context.subscriptions.push(item)
  item.show()
}

/**
 * 根据当前启用状态更新状态栏文字、提示语，并绑定对应的切换命令。
 */
export function updateStatusBar(enabled: boolean): void {
  if (!item)
    return
  if (enabled) {
    item.text = '$(sparkle) Cursor Trail: ON'
    item.tooltip = 'Cursor Trail is active — click to disable'
    item.command = 'cursorTrail.disable'
    item.color = undefined // 使用默认主题色
  }
  else {
    item.text = '$(circle-slash) Cursor Trail: OFF'
    item.tooltip = 'Cursor Trail is inactive — click to enable'
    item.command = 'cursorTrail.enable'
    item.color = new vscode.ThemeColor('statusBarItem.warningForeground')
  }
}

/**
 * 销毁状态栏指示器（在 deactivate 中按需调用）。
 */
export function disposeStatusBar(): void {
  item?.dispose()
  item = undefined
}
