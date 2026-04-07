import * as vscode from 'vscode'
import { getConfig, onConfigChange, setEnabled } from './config/configManager'
import { buildScript } from './config/scriptBuilder'
import { restore } from './core/backupManager'
import { inject, isInjected, permissionFixCommand, remove } from './core/injector'
import { resolveWorkbenchPath } from './core/pathResolver'
import { createStatusBar, updateStatusBar } from './ui/statusBar'

/**
 * extension.ts
 *
 * 插件入口，职责是"组装"——不包含业务逻辑：
 *   1. activate：检测注入状态、注册命令、初始化状态栏、启动配置监听。
 *   2. deactivate：无需额外处理，context.subscriptions 会自动销毁所有订阅。
 */

// ─── 内部辅助函数 ─────────────────────────────────────────────────────────────

/** 显示信息通知，附带可选的"重新加载窗口"按钮。 */
async function notifyReload(message: string): Promise<void> {
  const action = await vscode.window.showInformationMessage(message, 'Reload Window')
  if (action === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow')
  }
}

/** 向用户展示权限错误，并附上当前平台对应的修复命令。 */
function notifyPermissionError(workbenchPath: string): void {
  const cmd = permissionFixCommand(workbenchPath)
  vscode.window.showErrorMessage(
    `Cursor Trail: No write permission to workbench.html.\n`
    + `Run this command in your terminal, then try again:\n\n${cmd}`,
    { modal: true },
  )
}

/** 尝试注入脚本，优雅处理 EACCES 权限错误。 */
function safeInject(workbenchPath: string): boolean {
  try {
    const config = getConfig()
    const script = buildScript(config)
    inject(workbenchPath, script)
    return true
  }
  catch (err: unknown) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'EACCES') {
      notifyPermissionError(workbenchPath)
    }
    else {
      vscode.window.showErrorMessage(`Cursor Trail: Unexpected error — ${e.message}`)
    }
    return false
  }
}

/** 尝试移除注入，优雅处理 EACCES 权限错误。 */
function safeRemove(workbenchPath: string): boolean {
  try {
    remove(workbenchPath)
    return true
  }
  catch (err: unknown) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'EACCES') {
      notifyPermissionError(workbenchPath)
    }
    else {
      vscode.window.showErrorMessage(`Cursor Trail: Unexpected error — ${e.message}`)
    }
    return false
  }
}

// ─── Activate ────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  // Resolve workbench.html path (throws if not found)
  let workbenchPath: string
  try {
    workbenchPath = resolveWorkbenchPath()
  }
  catch (err: unknown) {
    vscode.window.showErrorMessage(`Cursor Trail: ${(err as Error).message}`)
    return
  }

  // ── 1. 初始化状态栏 ───────────────────────────────────────────────────────
  createStatusBar(context)
  const config = getConfig()
  updateStatusBar(config.enabled)

  // ── 2. 检测 VSCode 更新（注入标记丢失则提示用户重新注入）────────────────────
  const injected = isInjected(workbenchPath)
  if (config.enabled && !injected) {
    vscode.window
      .showWarningMessage(
        'Cursor Trail: VSCode may have updated and the trail effect was removed. '
        + 'Click Reload to re-inject.',
        'Reload',
      )
      .then((action) => {
        if (action === 'Reload') {
          if (safeInject(workbenchPath)) {
            notifyReload('Cursor Trail re-injected. Reload window to activate.')
          }
        }
      })
  }

  // ── 3. 注册命令 ───────────────────────────────────────────────────────────

  const cmdEnable = vscode.commands.registerCommand('cursorTrail.enable', async () => {
    const ok = safeInject(workbenchPath)
    if (ok) {
      await setEnabled(true)
      updateStatusBar(true)
      await notifyReload('Cursor Trail enabled. Reload window to activate.')
    }
  })

  const cmdDisable = vscode.commands.registerCommand('cursorTrail.disable', async () => {
    let ok: boolean
    try {
      restore(workbenchPath) // 优先从备份还原干净文件
      ok = true
    }
    catch {
      ok = safeRemove(workbenchPath) // 降级：用正则移除注入块
    }
    if (ok) {
      await setEnabled(false)
      updateStatusBar(false)
      await notifyReload('Cursor Trail disabled. Reload window to apply.')
    }
  })

  const cmdReload = vscode.commands.registerCommand('cursorTrail.reload', async () => {
    const ok = safeInject(workbenchPath)
    if (ok) {
      await setEnabled(true)
      updateStatusBar(true)
      await notifyReload('Cursor Trail re-injected. Reload window to activate.')
    }
  })

  // ── 4. 配置变更监听器（参见 ADR-004）─────────────────────────────────────
  const configWatcher = onConfigChange((newConfig) => {
    updateStatusBar(newConfig.enabled)

    // 仅在拖尾效果已启用时才重新注入，禁用状态下无需操作
    if (!newConfig.enabled)
      return

    const ok = safeInject(workbenchPath)
    if (ok) {
      notifyReload('Cursor Trail: Config updated. Reload window to apply.')
    }
  })

  context.subscriptions.push(cmdEnable, cmdDisable, cmdReload, configWatcher)
}

export function deactivate(): void {
  // VSCode 会自动销毁所有 context.subscriptions，此处无需额外处理。
}
