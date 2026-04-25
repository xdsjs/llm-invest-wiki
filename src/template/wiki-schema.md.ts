export const SCHEMA_TEMPLATE = `---
title: Wiki 规范
---

# 规范

## 页面类型

在这里定义这个 wiki 中有哪些页面类型，以及它们分别遵循什么约定。

## 命名规范

- 页面文件名使用 kebab-case（例如：\`distributed-consensus.md\`）
- 如果有需要，可以使用子目录组织分类（例如：\`wiki/papers/raft.md\`）

## 必需的 Frontmatter

每个 wiki 页面都必须包含：

\`\`\`yaml
---
title: 页面标题
description: 一行摘要
tags: []
sources: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
\`\`\`

## 标签

随着 wiki 的增长，在这里逐步定义你的标签体系。
`;
