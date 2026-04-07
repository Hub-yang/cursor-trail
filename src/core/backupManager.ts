import * as fs from 'node:fs'

/**
 * backupManager.ts
 *
 * 在每次注入操作之前管理 workbench.html 的备份。
 * 备份文件命名为 <原文件名>.bak-cursor-trail，存放在同一目录下。
 *
 * 约定：
 *  - 备份始终是未注入的干净副本。
 *  - backup() 具有幂等性：备份已存在时直接跳过。
 *  - restore() 用备份覆盖当前的 workbench.html。
 */

function backupPath(workbenchPath: string): string {
  return `${workbenchPath}.bak-cursor-trail`
}

/**
 * 若备份文件不存在，则创建 workbench.html 的备份。
 * 应在 workbench.html 处于干净（未注入）状态时调用。
 */
export function backup(workbenchPath: string): void {
  const bak = backupPath(workbenchPath)
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(workbenchPath, bak)
  }
}

/**
 * 从备份还原干净的 workbench.html。
 * 若备份文件不存在则抛出 Error。
 */
export function restore(workbenchPath: string): void {
  const bak = backupPath(workbenchPath)
  if (!fs.existsSync(bak)) {
    throw new Error(
      `Backup file not found: ${bak}\n`
      + `Cannot restore workbench.html without a backup.`,
    )
  }
  // 原子写入：备份 → 临时文件 → 重命名，防止写入中途崩溃导致文件损坏
  const tmp = `${workbenchPath}.tmp-cursor-trail`
  fs.copyFileSync(bak, tmp)
  fs.renameSync(tmp, workbenchPath)
}

/**
 * 检查备份文件是否存在。
 */
export function hasBackup(workbenchPath: string): boolean {
  return fs.existsSync(backupPath(workbenchPath))
}
