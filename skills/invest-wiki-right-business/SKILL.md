---
name: invest-wiki-right-business
description: Use when updating the human-facing Right Business judgment page from existing llm-wiki-invest wiki knowledge, after sources have already been ingested.
---

# Invest Wiki Right Business

你负责更新 `wiki/right/right-business.md`。这是判断层，不是事实层；只能基于已有 `wiki/` 知识页、事件页和它们的引用来源来判断这是不是一门好生意。

## 边界

- 输入来自已有 `wiki/` 页面，不直接从 `sources/` 跳写判断。
- 如果关键来源还没有 ingest，先建议运行 `invest-wiki-ingest`，不要补猜。
- `right-business` 只回答业务质量，不写管理层托付判断和价格赔率判断。
- 判断必须同时保留支持证据、反证和可证伪条件。

## Workflow

1. 读取 `wiki-purpose.md`、`wiki-schema.md` 和 `wiki-agent.md`（如果存在）。
2. 读取相关知识页，至少包括 `wiki/business-overview.md`、`wiki/financials.md`、`wiki/risk-factors.md`、相关 `wiki/events/*.md` 和 `wiki/open-questions.md`。
3. 只在已有 wiki 证据足够时更新 `wiki/right/right-business.md`。
4. 如果页面不存在，按 `wiki-schema.md` 的判断层结构创建。
5. 更新时保留历史判断的可追溯性，不删除仍有价值的反证。
6. 向 `wiki-log.md` 追加记录，并运行 `llm-wiki-invest sync`。

## 高质量问题

- 客户为什么持续付钱，这个需求是否重要、重复、非一次性。
- 收入增长来自价格、量、渗透率、留存、产品扩张还是并购。
- 单位经济学、毛利率、经营杠杆、现金转化是否支持长期复利。
- 竞争优势来自网络效应、规模、品牌、切换成本、成本曲线、数据、监管还是分销。
- 竞争优势是否正在增强、维持还是衰减。
- 业务是否依赖不可持续的补贴、周期高点、一次性需求或会计口径。
- 哪些风险会永久损害业务质量，而不只是造成短期波动。
- 最近披露中有什么事实强化或削弱了“好生意”判断。

## 输出结构

`wiki/right/right-business.md` 至少包含：

```md
# Right Business

## Current Judgment

## Evidence For

## Evidence Against

## What Changed Recently

## What Would Change My Mind

## Refs
```

Refs 优先引用 `wiki/` 页面；必要时可以引用这些 wiki 页面背后的 `sources/` 脚注。
