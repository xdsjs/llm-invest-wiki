---
name: invest-wiki-query
description: Use when answering questions from an llm-wiki-invest vault or writing back valuable synthesized knowledge from existing wiki pages.搜索 wiki，综合回答问题，并把有价值的新洞见写回 wiki，让知识持续复利。
---

# Invest Wiki Query

你负责基于 wiki 回答问题，并在有复利价值时把综合结果写回 wiki。

## 前置规则

先读取 `wiki-purpose.md`、`wiki-schema.md` 和 `wiki-agent.md`（如果存在）。确认问题是否在当前 wiki 范围内，并遵守页面类型、命名、标签、引用和写回规则。

回答必须以 wiki 内容为依据。信息不足时直接说明，不要猜测；需要外部研究时建议使用 `/research`。

## /query <question>

搜索 wiki 并综合回答。

### 步骤

1. 读取 `wiki-purpose.md`，确认问题在 wiki 覆盖范围内。
2. 用混合搜索找到相关页面：
   - 运行 `llm-wiki-invest search "<question>"` 做语义 / BM25 搜索
   - 需要时扫描 `wiki/` 做精确关键词匹配
   - 合并两种结果：语义搜索抓相关概念，关键词搜索抓精确术语。
3. 读取返回的 `wiki/` Markdown 文件。
4. 跟随命中页面里的 `[[wikilinks]]` 和 `## Related`，继续发现相连知识。
5. 综合答案时要做到：
   - 直接回答用户问题
   - 用 `[[page-name]]` 形式引用 wiki 页面
   - 明确指出矛盾、空白和不确定性
   - 区分有明确来源支持的结论和推断
6. 如果 wiki 里没有足够信息回答，明确说明，并建议应 ingest 或 research 哪些来源。
7. 如果这次回答产出了有价值的新知识，则写回 wiki：
   - 创建综合页面，或更新已有综合页
   - 添加指向源页面的 `[[wikilinks]]`
   - 对贡献综合结论的 wiki 页面或 source 使用正文脚注
   - 在文件末尾 `## Refs` 统一列出来源
   - 更新相关页面中的交叉引用
   - 向 `wiki-log.md` 追加 query 记录
   - 运行 `llm-wiki-invest sync`

### 写回标准

适合写回：

- 这次答案把 3 个以上页面连接成此前未记录的关系。
- 这次答案解决了一个矛盾。
- 这次答案高置信度补上了知识空白。
- 用户明确要求保存答案。

不适合写回：

- 只是从单个页面查出的简单事实。
- 回答严重依赖 wiki 之外的信息。
- 综合结果带有明显猜测或低置信度。

### 综合页面格式

```yaml
---
title: 综合标题
description: 一行摘要
tags: [synthesis]
source_type: query-synthesis
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

来源追溯放在正文脚注和末尾 `## Refs`，不要放进 frontmatter。
