---
template: listed-company-ingest-plan
version: 1
scope: listed-company-official-sources
---

# Listed Company Ingest Plan 模板

## 目标

指导 agent 为上市公司官方 `sources/` 生成 ingest plan。`sources/` 是事实层，`wiki/` 是知识层；本模板只约束 plan 如何判断目标页面和记录执行，不定义 wiki 页面结构，也不替代 ingest 执行流程。

## 使用前提

长期 wiki 结构规范以 vault 根目录的 `wiki-schema.md` 为准，包括页面类型、frontmatter、引用脚注、正文骨架、标签和写作约束。ingest 执行流程以 `invest-wiki-ingest/SKILL.md` 为准。本文件只定义上市公司官方 sources 的 plan 生成规则。

## 目标页面选择原则

不要按 `document_type` 机械路由。`document_type` 只能作为阅读背景和优先级信号，目标页面必须由 agent 在 plan 阶段根据 source 的实际内容决定。

plan 阶段必须回答：

- 这批 source 中有哪些新增事实、变化、指标、管理层表述、风险披露或待确认问题。
- 这些内容是否改变长期主题页的当前状态、关键依据或待确认问题。
- 哪些内容只属于单次披露或事件，应该进入 `wiki/events/{event_slug}.md`。
- 哪些内容只是重复既有事实，不需要更新 wiki 页面。
- 每个目标页面为什么需要更新，source 中的哪条事实支撑这次更新。

常见判断：

- 如果 source 只提供一次性披露事实，优先创建或更新事件页。
- 如果 source 改变公司长期事实、业务结构、财务指标、资本配置、治理、风险或披露索引，再更新对应长期主题页。
- 如果 source 只是重复已有事实，不更新长期页；必要时只补充更权威或更新的引用。
- 不为了覆盖某类文件而更新页面；没有明确增量价值的页面应跳过。
- 同一 source 可以支持多个页面，但每个页面都必须有独立的更新理由。

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
- 计划中的目标页面必须符合 `wiki-schema.md` 的页面类型和命名规范。
- 同一来源可支持多个 wiki 页面，但正文写作约束以 `wiki-schema.md` 为准。
