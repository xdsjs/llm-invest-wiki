---
name: invest-wiki-ingest
description: Use when running /ingest in an llm-wiki-invest vault, processing pending sources, compiling source materials into wiki pages, or marking sources as ingested.
---

# Invest Wiki Ingest

你负责把新的原始材料处理进 wiki

## 前置规则

在执行任何操作前，先读取 vault 根目录下的 `wiki-purpose.md` 和 `wiki-schema.md`。它们定义了 wiki 的范围、页面类型、命名约定、frontmatter 规则和标签体系，下面所有步骤都默认你已经加载这些信息。

如果存在 `wiki-agent.md`，也要一并读取。它定义了这个 vault 专属的 agent 身份，以及 MUST / MAY / NEVER 的 ingest 标准，会覆盖 `CLAUDE.md` / `AGENTS.md` 中的默认规则。如果不存在，则回退到 bootstrap 文件里的默认规则。

绝不要手工修改 `sources/` 下已有来源的正文内容。通用 `/ingest` 可以新增来源副本，官方建档材料只能由 dossier CLI 写入；已有来源唯一允许的更新是用 `llm-wiki-invest sources mark-ingested` 写入 ingest 状态字段。正文编辑应当发生在 `wiki/` 中。

每次执行完 ingest 后，都要在 `wiki-log.md` 追加一条记录，并运行 `llm-wiki-invest sync`。不要因为改动小就跳过。日志是给人审计的，sync 则用来保持 embedding 和 DB9 状态同步。

## /ingest <path>

把新的原始材料处理进 wiki。

### 步骤

1. **增量保护**：先运行 `llm-wiki-invest sources pending --json` 查看未 ingest 或已变化的来源。单文件 ingest 时，只处理该文件；目录或批量 ingest 时，按 `sources/` 目录分组整理候选来源，再由 agent 生成计划。判断规则是：没有 `ingested` 为新来源；有 `ingested` 但 `ingest_hash` 与当前内容不一致为 changed；否则跳过。
2. 读取 `wiki-purpose.md`、`wiki-schema.md` 和 `wiki-agent.md`（如果存在），理解这个 wiki 的范围、页面类型、命名规则、结构要求，以及 ingest 标准（MUST / MAY / NEVER）。如果 `wiki-agent.md` 不存在，则使用 `CLAUDE.md` / `AGENTS.md` 中的默认标准。
3. 如果是上市公司官方建档材料，读取同目录下的 `template/company.md`，用其中的标准页面和 `document_type` 路由约束计划。
4. **ingest 过滤**：根据 MUST / MAY / NEVER 规则评估输入。匹配 NEVER 的内容（闲聊、凭证、重复信息、纯表情等）直接丢弃；匹配 MUST 的必须处理；匹配 MAY 的按判断处理。如果输入被过滤掉，静默跳过，不需要写日志。
5. 读取用户提供的源材料。
6. 判断这次 ingest 是否需要先和用户讨论再改 wiki 页面：
   - 如果 wiki 已经有清晰结构，而这次只是对既有框架的小补充或轻微修正，就直接执行。
   - 如果这次 ingest 会明显改变结构、命名、范围、页面边界或链接策略，就先和用户讨论。
   - 如果需要讨论，先概述计划创建哪些页面、更新哪些页面、使用什么命名，以及如何建立链接关系。
7. 多来源 ingest 或官方建档 ingest 默认先写 plan artifact：
   - 路径：`.llm-wiki-invest/ingest-plans/{slug}.md`
   - plan 是 agent 和人审计用的执行记录，不是 CLI 输入；不要让 CLI 执行 plan。
   - plan 至少包含 `Sources`、`Planned Wiki Changes`、`Rationale`、`Execution Result`。
8. 如果 wiki 还是空的，不要立刻开始写页面：
   - 先和用户约定 wiki 的组织规则。
   - 至少要覆盖目录结构、是否使用子目录、wiki 使用的语言，以及文件名格式。
   - 达成一致后，先把这些规则写进 `wiki-schema.md`，再开始 ingest 内容。
9. 按日期规则把通用原始材料复制进 `sources/`：
   - 单个文件放到 `sources/YYYY-MM-DD/<原始文件名>`
   - 一个目录放到 `sources/YYYY-MM-DD/<原始目录名>/`
   - 尽量保留原始文件或目录名。
   - 如果当天目录里已存在同名文件，则加版本后缀重命名。
   - **大型源材料必须按主题或日期拆分**，不要保存成一个巨大单体文件。例如把聊天记录按天拆成 `chat-2026-04-17.md`、`chat-2026-04-18.md`，或按主题拆成 `browser-timeout-discussion.md`。这样可以支持更细粒度的增量 re-ingest。
10. 运行 `llm-wiki-invest search`，或者扫描 `wiki/`，查看已有页面。
11. 分析源材料，决定：
   - 需要新建哪些 wiki 页面
   - 需要把哪些新信息写入已有页面
   - 需要通过 `[[wikilinks]]` 增加哪些交叉引用
   - 一个源材料可能会影响 5 到 15 个页面。
12. 在 `wiki/` 中创建或更新 Markdown 文件，并带上规范 frontmatter：
   ```yaml
   ---
   title: 页面标题
   description: 一行摘要
   aliases: [别名, 缩写, 翻译名]
   tags: [来自 wiki-schema.md 的领域标签]
   sources: [YYYY-MM-DD/source-filename.md]
   status: open | resolved | wontfix  # issue/bug 页面必填
   created: YYYY-MM-DD
   updated: YYYY-MM-DD
   ---
   ```
   - `sources` 字段是**必填项**。填写相对于 `sources/` 的路径，不要带 `sources/` 前缀。
   - `aliases` 应包含常见缩写、翻译名和其他常用称呼（例如 `Strategy` → `aliases: [Strategy, 认证策略]`），这样能改善搜索和 wikilink 匹配。
   - `status` 字段对 issue/bug 页面是**必填项**（`open`、`resolved`、`wontfix`）。不要只在正文里写状态，必须放到 frontmatter 里，便于机器读取。
   - 更新已有页面时，要**合并**新信息。除非被更权威或更新的来源推翻，否则不要覆盖旧内容。如果存在冲突，要同时注明两方来源。
   - 要积极使用 `[[wikilinks]]`。任何已经有页面或应该有页面的实体，都应该被链接。
   - 每个页面聚焦一个主题。如果某个章节过大，就拆成独立页面。
   - 在页面底部添加 `## Related` 部分：`- [[page-name]] — 一句关系说明`
13. 给源文件本身补充 frontmatter。优先使用 CLI：
    ```bash
    llm-wiki-invest sources mark-ingested <source paths...> --pages wiki/page-a.md,wiki/page-b.md
    ```
    这会写入：
    ```yaml
    ---
    ingested: YYYY-MM-DD
    ingest_hash: 内容哈希
    wiki_pages: [本次创建或更新的 wiki 页面列表]
    ---
    ```
14. 回填 plan artifact 的 `Execution Result`，记录创建/更新的页面、执行过的 `mark-ingested` 命令、剩余问题。如果没有 plan artifact，跳过这步。
15. 向 `wiki-log.md` 追加记录：
    ```md
    ## [YYYY-MM-DD] ingest | 源标题
    - created `page-name` — 原因
    - updated `page-name` — 变更内容
    ```
16. 运行 `llm-wiki-invest sync` 更新搜索索引。

### Ingest 指南

- 每个页面都应当聚焦单一主题。
- 用清晰、简洁的文字写作。要概括，不要照抄。
- 始终为相关页面补充交叉引用。
- 如果你提到一个还没有 wiki 页面的实体，也依然要写成 `[[wikilink]]`，这样它会变成可发现的“待写页面”。
- 当结构、命名或范围存在不确定性时，ingest 应当以协作方式进行；但在既有框架下的直接补充，可以直接落地。
- 使用符合 `wiki-schema.md` 约定的、可读的 slug。
- frontmatter 里的 `sources` 是强制要求，所有结论都必须可追溯。

## Invest 公司模板

当 sources 是上市公司官方建档材料时，额外读取 `template/company.md`。它只提供投资领域页面类型、页面骨架和 `document_type` 路由，不替代上面的通用 ingest 流程。
