---
name: invest-wiki-lint
description: Use when checking or repairing the structure, links, sources, frontmatter, and consistency of an llm-wiki-invest vault.执行健康检查（坏链接、孤儿页、陈旧内容、frontmatter 漂移、矛盾），并自动修复安全的问题。
---

# Invest Wiki Lint

你负责检查 wiki 的结构、一致性和维护信号。

## 前置规则

先读取 `wiki-purpose.md`、`wiki-schema.md` 和 `wiki-agent.md`（如果存在）。除非用户明确请求 `/lint --fix`，否则只报告问题，不自动修改。矛盾类问题永远不要自动修复。

## /lint

对 wiki 做健康检查。`/lint <page>` 检查单页；`/lint --fix` 自动修复安全问题。

### 步骤

1. 读取 `wiki-schema.md`，理解预期结构、命名规范和必填 frontmatter 字段。
2. 扫描 `wiki/` 中所有页面，以及 `sources/` 中所有文件。
3. 构建链接图，为每个页面提取全部 `[[wikilinks]]`。
4. 检查结构问题：
   - 坏链接：`[[wikilinks]]` 指向不存在的页面。
   - 孤儿页：没有被任何其他页面链接进来的页面。
   - 缺少 frontmatter：页面缺少必需字段。issue/bug 页面还必须有 `status`。
   - 缺少 aliases：页面有明显别名或常用称呼，但没有 `aliases`。
   - 命名违规：页面名不符合 `wiki-schema.md`。
   - 主题重复：多个页面覆盖同一个实体或概念。
5. 检查内容问题：
   - 矛盾：多个页面对同一主题给出冲突说法。
   - 陈旧内容：页面 `updated` 日期早于其 `## Refs` 引用来源文件的修改时间。
   - 无来源结论：页面存在 source-derived 事实，但缺少正文脚注或末尾 `## Refs`。
   - 过浅页面：除去 frontmatter 后正文不足 3 句，应扩充或合并。
6. 检查来源问题：
   - 未 ingest 来源：`llm-wiki-invest sources pending [path]` 中状态为 `new` 的文件。
   - 来源漂移：`llm-wiki-invest sources pending [path]` 中状态为 `changed` 的文件。
7. 输出结构化报告。
8. 如果显式请求了 `--fix`，只应用安全修复。
9. 在 `.llm-wiki-invest/lint-result.yaml` 写入机器可读结果。
10. 如果产生修改，向 `wiki-log.md` 追加记录，并运行 `llm-wiki-invest sync`。

### 报告格式

```md
## Lint 报告 — YYYY-MM-DD

### 摘要
- 页面总数：N | 来源总数：N
- 问题数：N（严重：X，警告：Y，提示：Z）

### 严重问题
- **坏链接**：[[page-a]] → [[nonexistent]]
- **矛盾**：[[page-b]] 与 [[page-c]] 在主题 Z 上存在冲突

### 警告
- **孤儿页**：[[page-d]] — 没有入链
- **陈旧**：[[page-e]] — 自 YYYY-MM-DD 起未更新
- **无来源**：[[page-f]] — 缺少正文脚注或 `## Refs`

### 提示
- **过浅页面**：[[page-g]] — 只有 2 句，建议扩写
- **待写页**：[[unwritten-page]] — 被 3 个页面链接
- **未 ingest 来源**：sources/research/YYYY/YYYY-MM-DD-new-article/new-article.md
```

### 自动修复边界

| 问题 | 自动修复 |
|-------|----------|
| 坏链接 | 删除链接或创建 stub 页面 |
| 缺少 frontmatter | 补上合理默认值 |
| 孤儿页 | 从相关页面补链接 |
| 陈旧内容 | 重新读取来源并更新页面 |
| 主题重复 | 合并成一个页面，并把另一个作为 alias |
| 过浅页面 | 基于来源扩写，或并入相关页面 |

绝不要自动修复矛盾，这类问题必须交给人判断。
