/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // Bug 修复
        'docs',     // 文档变更
        'style',    // 代码格式（不影响逻辑）
        'refactor', // 重构
        'perf',     // 性能优化
        'test',     // 测试
        'chore',    // 构建/工具链
        'ci',       // CI 配置
        'revert',   // 回滚
        'build',    // 构建系统
      ],
    ],
    'subject-case': [0], // 不强制大小写，中文友好
  },
};
