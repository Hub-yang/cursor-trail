import * as fs from 'node:fs'
import * as path from 'node:path'
import { backup } from './backupManager'

/**
 * injector.ts
 *
 * 读取 workbench.html，注入或移除光标拖尾脚本块，并以原子方式写回文件。
 *
 * 注入标记格式：
 *   <!-- cursor-trail-start -->
 *   <script>…生成的代码…</script>
 *   <!-- cursor-trail-end -->
 *
 * 脚本块（含标记）插入在 </html> 标签之前。
 */

const MARKER_START = '<!-- cursor-trail-start -->'
const MARKER_END = '<!-- cursor-trail-end -->'
const INJECTION_RE = /<!-- cursor-trail-start -->[\s\S]*?<!-- cursor-trail-end -->\n?/

/**
 * 原子写入文件：先写临时文件，再重命名覆盖目标文件。
 * 可防止写入过程中崩溃导致 workbench.html 损坏。
 */
function atomicWrite(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp-cursor-trail`
  fs.writeFileSync(tmp, content, 'utf8')
  fs.renameSync(tmp, filePath)
}

/**
 * 检测 workbench.html 中是否已存在光标拖尾脚本的注入标记。
 */
export function isInjected(workbenchPath: string): boolean {
  try {
    const content = fs.readFileSync(workbenchPath, 'utf8')
    return content.includes(MARKER_START)
  }
  catch {
    return false
  }
}

/**
 * 将脚本字符串注入到 workbench.html 中。
 *
 * - 若备份不存在，先创建备份。
 * - 若已有旧注入块，先移除再注入（幂等）。
 * - 脚本块插入在 </html> 之前。
 *
 * 遇到 EACCES（权限错误）时抛出异常，由调用方向用户展示修复命令。
 */
export function inject(workbenchPath: string, scriptContent: string): void {
  // 修改文件前确保备份存在
  backup(workbenchPath)

  let html = fs.readFileSync(workbenchPath, 'utf8')

  // 先移除旧注入块，保证幂等性（不会重复注入）
  html = html.replace(INJECTION_RE, '')

  const block
    = `${MARKER_START}\n`
      + `<script>\n${scriptContent}\n</script>\n`
      + `${MARKER_END}\n`

  if (html.includes('</html>')) {
    html = html.replace('</html>', `${block}</html>`)
  }
  else {
    // 降级处理：找不到 </html> 时直接追加到文件末尾
    html = `${html}\n${block}`
  }

  atomicWrite(workbenchPath, html)
}

/**
 * 从 workbench.html 移除注入的脚本块。
 * 若注入标记不存在则直接返回（无副作用）。
 */
export function remove(workbenchPath: string): void {
  let html = fs.readFileSync(workbenchPath, 'utf8')
  if (!html.includes(MARKER_START))
    return
  html = html.replace(INJECTION_RE, '')
  atomicWrite(workbenchPath, html)
}

/**
 * 根据当前操作系统，返回可供用户直接执行的权限修复命令字符串。
 */
export function permissionFixCommand(workbenchPath: string): string {
  const resourceDir = path.dirname(path.dirname(path.dirname(workbenchPath)))
  if (process.platform === 'darwin') {
    return `sudo chown -R $(whoami) "${resourceDir}"`
  }
  else if (process.platform === 'win32') {
    return `icacls "${resourceDir}" /grant %USERNAME%:F /t`
  }
  else {
    // Linux：不同安装方式路径各异，统一使用 chown
    return `sudo chown -R $(whoami) "${resourceDir}"`
  }
}
