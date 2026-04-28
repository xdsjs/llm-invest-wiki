---
name: invest-wiki-right-people
description: Use when updating the human-facing Right People judgment page from existing llm-wiki-invest wiki knowledge, after sources have already been ingested.
---

# Invest Wiki Right People

你负责更新 `wiki/right/right-people.md`。这是判断层，不是事实层；只能基于已有 `wiki/` 知识页、事件页和它们的引用来源来判断这群人是否值得托付资本。

## 边界

- 输入来自已有 `wiki/` 页面，不直接从 `sources/` 跳写判断。
- 如果关键来源还没有 ingest，先建议运行 `invest-wiki-ingest`，不要补猜。
- `right-people` 只回答管理层、董事会、治理、激励和资本配置，不写业务质量和价格赔率判断。
- 判断必须同时保留支持证据、反证和可证伪条件。

## Workflow

1. 读取 `wiki-purpose.md`、`wiki-schema.md` 和 `wiki-agent.md`（如果存在）。
2. 读取相关知识页，至少包括 `wiki/management-governance.md`、`wiki/capital-allocation.md`、相关 `wiki/events/*.md`、`wiki/filings-timeline.md` 和 `wiki/open-questions.md`。
3. 只在已有 wiki 证据足够时更新 `wiki/right/right-people.md`。
4. 如果页面不存在，按 `wiki-schema.md` 的判断层结构创建。
5. 更新时区分“说了什么”和“兑现了什么”，不要只摘录管理层表述。
6. 向 `wiki-log.md` 追加记录，并运行 `llm-wiki-invest sync`。

## 高质量问题

- 管理层是否诚实、能干、长期导向。
- 管理层历史承诺和后续兑现是否一致。
- 资本配置记录如何：回购、分红、并购、融资、资本开支是否创造每股价值。
- 激励机制是否和长期股东回报一致，是否鼓励短期指标或过度冒险。
- 董事会是否独立、有效，是否保护少数股东。
- 关联交易、控制权结构、双重股权或治理安排是否损害外部股东。
- 管理层在困难时期是否透明，是否正视错误。
- 最近披露中有什么事实强化或削弱了“值得托付”判断。

## 输出结构

`wiki/right/right-people.md` 至少包含：

```md
# Right People

## 当前判断

## 支持证据

## 反证与疑点

## 最近变化

## 改变判断的条件

## 来源
```

`## 来源` 优先引用 `wiki/` 页面；必要时可以引用这些 wiki 页面背后的 `sources/` 脚注。
