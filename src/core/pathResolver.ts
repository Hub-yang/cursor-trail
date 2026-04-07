import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * pathResolver.ts
 *
 * 跨平台定位当前 VSCode 实例的 workbench.html 文件路径。
 * 支持 macOS（.app bundle）、Windows（用户级 / 系统级安装）、
 * Linux（deb、rpm、snap、AppImage）。
 *
 * 策略：从 `process.execPath`（VSCode 可执行文件绝对路径）出发，
 * 向上遍历目录层级，找到 workbench.desktop.main.html。
 */

const WORKBENCH_RELATIVE
  = 'resources/app/out/vs/workbench/workbench.desktop.main.html'

/**
 * 根据当前可执行文件路径，构建 workbench.html 的候选绝对路径列表。
 */
function buildCandidates(execPath: string): string[] {
  const candidates: string[] = []

  // macOS：/Applications/Visual Studio Code.app/Contents/MacOS/Electron
  // process.execPath 位于 MacOS/ 目录内，向上两级到达 Contents/，
  // workbench.html 实际路径为 Contents/Resources/app/out/vs/workbench/...
  const macOsBase = path.resolve(execPath, '..', '..') // .app/Contents
  candidates.push(path.join(macOsBase, WORKBENCH_RELATIVE))

  // Windows / Linux：execPath 即二进制文件本身，向上逐层尝试
  // 例如 Windows: C:\Users\…\AppData\Local\Programs\Microsoft VS Code\Code.exe
  //      Linux:   /usr/share/code/code
  let dir = path.dirname(execPath)
  for (let i = 0; i < 4; i++) {
    candidates.push(path.join(dir, WORKBENCH_RELATIVE))
    dir = path.dirname(dir)
  }

  return candidates
}

/**
 * 返回当前 VSCode 实例 workbench.html 的绝对路径。
 * 若所有候选路径均不存在则抛出 Error。
 */
export function resolveWorkbenchPath(): string {
  const execPath = process.execPath
  const candidates = buildCandidates(execPath)

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
    catch {
      // existsSync 在权限不足时也会抛出，忽略并继续尝试下一个候选路径
    }
  }

  throw new Error(
    `Cannot locate workbench.html.\n`
    + `Tried:\n${candidates.map(c => `  ${c}`).join('\n')}\n\n`
    + `Please open a GitHub issue and include your OS and VSCode installation path.`,
  )
}
