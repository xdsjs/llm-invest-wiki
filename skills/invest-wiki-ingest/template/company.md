---
template: invest-company-wiki
version: 1
scope: listed-company-wiki
---

# Invest Company Wiki 模板

## 目标

把官方 `sources/` 编译成稳定、可追溯、可持续更新的公司 wiki。`sources/` 是事实层，`wiki/` 是知识层；wiki 可以组织、归纳和交叉引用，但必须区分事实、推断和待确认问题。

## 标准页面

- `wiki/company-profile.md`：公司身份、上市信息、基础描述。
- `wiki/business-overview.md`：业务结构、产品线、收入来源、商业模式。
- `wiki/segments.md`：分部、地区、产品线、管理口径变化。
- `wiki/financials.md`：收入、利润、毛利、现金流、资产负债、关键指标。
- `wiki/capital-allocation.md`：回购、分红、融资、并购、资本开支。
- `wiki/management-governance.md`：管理层、董事会、薪酬、投票、治理文件。
- `wiki/risk-factors.md`：风险披露、风险变化、监管和诉讼风险。
- `wiki/filings-timeline.md`：重要 SEC、交易所、公司披露索引。
- `wiki/open-questions.md`：待确认问题、后续研究任务。
- `wiki/events/{event_slug}.md`：单次事件页，如季度财报、重大 8-K、股东大会。

## 页面 Frontmatter

每个 wiki 页面至少包含：

```yaml
---
title:
description:
tags: []
sources: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

`sources` 填相对 `sources/` 的路径，不带 `sources/` 前缀。例：

```yaml
sources:
  - earnings-release/2026/2026-01-29-q1-results/00-primary-q1-results-release.md
```

## 默认正文骨架

Rollup 页默认结构：

```md
# Title

## Current Snapshot

## Key Facts

## Changes

## Source Notes

## Open Questions

## Related
```

Event 页默认结构：

```md
# Event Title

## Summary

## Source Set

## Key Facts

## Financials

## Management Commentary

## Implications For Existing Wiki

## Open Questions

## Related
```

## `document_type` 路由

- `10-k` -> `company-profile.md`、`business-overview.md`、`segments.md`、`financials.md`、`risk-factors.md`、`management-governance.md`、`filings-timeline.md`
- `10-q` -> `financials.md`、`risk-factors.md`、`filings-timeline.md`
- `8-k` -> `wiki/events/{event_slug}.md`、`filings-timeline.md`
- `earnings-release` -> `wiki/events/{event_slug}.md`、`financials.md`
- `financial-statements` -> `wiki/events/{event_slug}.md`、`financials.md`
- `proxy-statement` -> `management-governance.md`、`capital-allocation.md`、`filings-timeline.md`
- `investor-presentation` -> `wiki/events/{event_slug}.md`、`business-overview.md`、`financials.md`
- `transcript` -> `wiki/events/{event_slug}.md`、`business-overview.md`、`open-questions.md`
- `annual-report` -> `business-overview.md`、`financials.md`、`filings-timeline.md`
- `governance-document` -> `management-governance.md`、`filings-timeline.md`
- `listing-notice` -> `filings-timeline.md`
- `other-official-filing` -> `filings-timeline.md`，必要时再路由到具体页面

## Plan Artifact

多来源 ingest 或官方建档 ingest 默认写计划：

` .llm-wiki-invest/ingest-plans/{slug}.md`

模板：

```md
# Ingest Plan: {slug}

status: planned
created: YYYY-MM-DD
executed:

## Sources
- sources/...

## Planned Wiki Changes
- create `wiki/events/...`
- update `wiki/financials.md`

## Rationale
- 为什么这些 sources 应该更新这些页面。

## Execution Result
- Pending.
```

执行完成后把 `status` 改为 `executed`，补 `executed` 日期，并记录创建/更新的页面、mark-ingested 命令和剩余问题。

## 计划原则

- 首次空 wiki 可以跨多个 pending sources 生成 bootstrap plan。
- 日常增量优先按事件或目录簇生成小 plan。
- 同一来源可支持多个 wiki 页面，但不要在多个页面重复大段正文。
- 事实写入页面时必须能回溯到 `sources`。
- 推断和研究问题写入 `open-questions.md` 或明确标注为 interpretation。
