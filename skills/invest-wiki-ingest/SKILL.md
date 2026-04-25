---
name: invest-wiki-ingest
description: Use when running /ingest in an llm-wiki-invest vault, including source path resolution, pending filtering, batching, planning, and compiling sources into wiki pages.
---

# Invest Wiki Ingest

你负责执行 `/ingest <path>`：把输入解析成正式 `sources/`，做 pending 过滤，必要时生成 ingest plan，再把每个 source 编译进 wiki。

## 输入边界

- `sources/**/*.md`：单个正式 source。
- `sources/**/`：递归读取目录下的 Markdown source。
- `.llm-wiki-invest/dossier-runs/<run-id>/`：读取 `result.json.created` 得到该次建档生成的正式 sources。
- 外部文件或 URL：不能直接编译进 wiki。先物化到 `sources/`；官方建档材料必须经 dossier，通用材料按日期或主题切分后归档。

不要把 `.llm-wiki-invest/dossier-runs/<run-id>/` 当作 source 目录扫描；它只通过 `result.json.created` 解析候选 source。

## 前置规则

在执行任何操作前，先读取 vault 根目录下的 `wiki-purpose.md`、`wiki-schema.md` 和 `wiki-agent.md`（如果存在）。它们定义了 wiki 范围、页面类型、命名、frontmatter、标签体系和 ingest 标准。

绝不要手工修改 `sources/` 下已有来源的正文内容。source 物化由本 `/ingest` workflow 或 dossier CLI 完成；已有来源唯一允许的更新是用 `llm-wiki-invest sources mark-ingested` 写入 ingest 状态字段。正文编辑应当发生在 `wiki/` 中。

每次实际写入 wiki 后，都要在 `wiki-log.md` 追加记录，并运行 `llm-wiki-invest sync`。如果所有 source 都是 `clean` 或被 NEVER 规则过滤，直接停止。

## /ingest <path>

### Workflow

1. 把输入解析成候选 source 列表。
2. 运行 `llm-wiki-invest sources pending <path> --json`，只保留状态为 `new` 或 `changed` 的 source。没有 pending source 时停止。
3. 单个 pending source 可以不写 plan；多个 pending source 或 dossier run 默认写 `.llm-wiki-invest/ingest-plans/{slug}.md`。plan 是 agent 审计记录，不是 CLI 输入。
4. plan 至少包含 `Sources`、`Batches`、`Planned Wiki Changes`、`Rationale`、`Execution Result`。
5. batch 的单位由 agent 判断，不由 `disclosure_key` 硬编码决定。优先按“同一主题、同一披露周期、会更新同一批 wiki 页面”聚合；如果来源会影响不同页面簇，就拆开。
6. 对上市公司官方 sources，使用 `wiki-schema.md` 的固定页面类型决定目标页面。`document_type`、披露日期、标题和正文都是弱信号；不要只按 `document_type` 做硬路由。
7. 对每个 pending source，执行下面的单 source 编译流程。
8. 回填 plan 的 `Execution Result`：记录 created / updated 页面、执行过的 `mark-ingested` 命令、跳过项和剩余问题。
9. 如果更新了 plan 或其他 workflow 记录，运行一次 `llm-wiki-invest sync`。

### 单 Source 编译

1. 读取 source 正文和 frontmatter。
2. 根据 `wiki-agent.md` 的 MUST / MAY / NEVER 规则评估是否值得写入。匹配 NEVER 的内容直接跳过。
3. 扫描 `wiki/` 或运行 `llm-wiki-invest search`，判断应创建或更新哪些页面。一个 source 可以影响多个页面，但每个变更都必须有明确来源依据。
4. 如果这次 ingest 会改变页面结构、命名、范围、页面边界或链接策略，先和用户讨论；如果只是既有结构下的增量补充，直接执行。
5. 在 `wiki/` 中创建或更新 Markdown 页面，并遵守 `wiki-schema.md` 的页面类型、命名、frontmatter、标签和正文结构。
6. 用正文脚注引用 source，并在文件末尾写 `## Refs`。不要把来源列表放进 wiki 页面的 frontmatter。
7. 标记 source 已 ingest：
   ```bash
   llm-wiki-invest sources mark-ingested <source-md> --pages wiki/page-a.md,wiki/page-b.md
   ```
8. 向 `wiki-log.md` 追加本次创建或更新的页面。

### 页面写法

- 新页面使用规范 frontmatter：
   ```yaml
   ---
   title: 页面标题
   description: 一行摘要
   aliases: [别名, 缩写, 翻译名]
   tags: [来自 wiki-schema.md 的领域标签]
   status: open | resolved | wontfix  # issue/bug 页面必填
   created: YYYY-MM-DD
   updated: YYYY-MM-DD
   ---
   ```
- 更新已有页面时合并新信息。除非被更权威或更新的来源推翻，否则不要覆盖旧内容；存在冲突时同时保留并标注来源。
- 每个 source-derived 事实、数字、管理层表述、风险变化都要用脚注标记，例如 `营收同比增长 4%[^src-1]`。
- 文件末尾必须有 `## Refs`，用脚注定义列出可点击来源：`[^src-1]: [[sources/<relative-source-path>|来源标题]] — 支撑哪些内容`。
- 需要时在 `## Refs` 前添加 `## Related`，列出真正有用的相关 wiki 页面。
- 要积极使用 `[[wikilinks]]`。任何已经有页面或应该有页面的实体，都应该被链接。
- 如果你提到一个还没有 wiki 页面的实体，也依然要写成 `[[wikilink]]`，这样它会变成可发现的“待写页面”。
