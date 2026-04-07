import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'

/**
 * pathResolver.ts
 *
 * 使用 vscode.env.appRoot 直接定位 workbench.html，跨平台可靠。
 *
 * 放弃 process.execPath 推导方案的原因：
 *   调试模式下 process.execPath 指向 "Code Helper (Plugin).app" 子进程，
 *   而非 VSCode 主进程，导致路径推导偏离目标目录。
 *
 * vscode.env.appRoot 示例：
 *   macOS:   /Applications/Visual Studio Code.app/Contents/Resources/app
 *   Windows: C:\Users\...\AppData\Local\Programs\Microsoft VS Code\resources\app
 *   Linux:   /usr/share/code/resources/app
 */

// VSCode 1.96+ 将 workbench 宿主页面移至 electron-browser 目录
// 旧路径 out/vs/workbench/workbench.desktop.main.html 已不存在
const WORKBENCH_RELATIVE = 'out/vs/code/electron-browser/workbench/workbench.html'

/**
 * 返回当前 VSCode 实例 workbench.html 的绝对路径。
 * 若文件不存在则抛出 Error（含完整路径，便于排查）。
 */
export function resolveWorkbenchPath(): string {
  // vscode.env.appRoot 已经指向 resources/app 目录，直接拼接即可
  const workbenchPath = path.join(vscode.env.appRoot, WORKBENCH_RELATIVE)

  if (!fs.existsSync(workbenchPath)) {
    throw new Error(
      `Cannot locate workbench.html.\n`
      + `Tried: ${workbenchPath}\n\n`
      + `vscode.env.appRoot = ${vscode.env.appRoot}\n`
      + `Please open a GitHub issue and include your OS and VSCode installation path.`,
    )
  }

  return workbenchPath
}
