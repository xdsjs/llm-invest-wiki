---
name: invest-wiki-ingest
description: Use when compiling one official source Markdown file under sources/ into an LLM Wiki Invest vault's wiki pages, including pending checks, wiki updates, source citations, ingest marking, and sync.
---

# Invest Wiki Ingest

- 把一个正式 source(`md`格式源文件) 编译进 `wiki/` 知识层。
- 输入边界：/ingest <path>；<path> 为源文件路径

##  前置规则

在执行任何操作前，先读取 vault 根目录下的 `wiki-purpose.md` 和 `wiki-schema.md`。它们定义了 wiki 的范围、页面类型、命名约定、frontmatter 规则和标签体系，下面所有步骤都默认你已经加载这些信息。

如果存在 `wiki-agent.md`，也要一并读取。它定义了这个 vault 专属的 agent 身份，以及 MUST / MAY / NEVER 的 ingest 标准，会覆盖 `CLAUDE.md` / `AGENTS.md` 中的默认规则。如果不存在，则回退到 bootstrap 文件里的默认规则。

绝不要修改 `sources/` 下 source 正文。那里存放的是不可变的原始输入；唯一允许的 source 文件变更，是在 frontmatter 中补充或更新 `ingested` 和 `wiki_pages`。正文编辑应当发生在 `wiki/` 中。

`/ingest` 不直接写 `wiki/right/*`。判断层由 `invest-wiki-right-business`、`invest-wiki-right-people`、`invest-wiki-right-price` 读取已有 wiki 后更新。

每次执行完操作后，无论是 ingest、query、lint 还是 research，都要在 `wiki-log.md` 追加一条单行记录，并运行 `llm-wiki-invest sync`。不要因为改动小就跳过。日志是给人审计的，sync 则用来保持 embedding 和 DB9 状态同步。

## Workflow

### step1: 输入校验与增量保护

1. 确认输入是单个 `sources/**/*.md` 文件。
2. 运行：
   ```bash
   llm-wiki-invest sources pending <source-md> --json
   ```
3. 只处理状态为 `new` 的 source。如果状态是 `clean`，输出：“该来源已 ingest，跳过。”，并停止 `Workflow`。

### step2: 读取规则 与 ingest 过滤

1. **读取规则**：读取 `wiki-purpose.md`、`wiki-schema.md` 和 `wiki-agent.md`（如果存在），理解这个 wiki 的范围、页面类型、命名规则、结构要求，以及 ingest 标准（MUST / MAY / NEVER）。如果 `wiki-agent.md` 不存在，则使用 `CLAUDE.md` / `AGENTS.md` 中的默认标准。
2. **ingest 过滤**：根据 MUST / MAY / NEVER 规则评估输入。匹配 NEVER 的内容直接跳过；匹配 MUST 的必须处理；匹配 MAY 的按判断处理。如果输入被过滤掉，只输出 skipped reason，不写 wiki，不补 `ingested`。

### step3: 开始 ingest 内容

1. 运行 `llm-wiki-invest search`，或者扫描 `wiki/`，查看已有页面。
2. 分析源材料，根据 `wiki-schema.md`，决定：
   - 需要新建哪些 wiki 页面
   - 需要把哪些新信息写入已有页面
   - 需要通过 `[[wikilinks]]` 增加哪些交叉引用
   - 这份 source 是否足以触发后续 right review。
   - 优先更新少量高信号知识页，不把 source 机械拆散到过多页面。
   - 每个目标页面要新增或更新哪些 `证据台账`、`变化记录` / `相比上期变化`、`判断层信号` 条目。
3. 在 `wiki/` 中创建或更新 Markdown 文件，并带上符合 `wiki-schema.md` 的 frontmatter：
   ```yaml
   ---
   title: 页面标题
   description: 一行摘要
   aliases: [别名, 缩写, 翻译名]
   tags: [来自 wiki-schema.md 的领域标签]
   created: YYYY-MM-DD
   updated: YYYY-MM-DD
   ---
   ```
   - `aliases` 应包含常见缩写、翻译名和其他常用称呼（例如 `Strategy` → `aliases: [Strategy, 认证策略]`），这样能改善搜索和 wikilink 匹配。
   - 更新已有页面时，要**合并**新信息。除非被更权威或更新的来源推翻，否则不要覆盖旧内容。如果存在冲突，要同时注明两方来源。
   - 要积极使用 `[[wikilinks]]`。任何已经有页面或应该有页面的实体，都应该被链接。
   - 每个页面聚焦一个主题。如果某个章节过大，就拆成独立页面。
   - 每个 source-derived 事实、数字、管理层表述、风险变化都要使用正文脚注，并在文末 `## 来源` 中列出来源。
   - 普通 wiki 页必须把关键事实落进 `证据台账`，把跨期变化落进 `变化记录` 或事件页 `相比上期变化`。
   - `判断层信号` 只写可供判断层消费的信号，不写最终投资结论。
   - 在页面底部添加 `## 来源`；需要时在其前面添加 `## 相关页面`：`- [[page-name]] — 一句关系说明`。
   - 如果 source 可能影响业务、人物或价格判断，只在相关知识页或事件页注明“可能触发 right review”，不要直接改写 `wiki/right/*`。

### step4: 执行收尾动作

1. 给源文件本身补充 frontmatter：
    ```yaml
    ---
    ingested: YYYY-MM-DD
    wiki_pages: [本次创建或更新的 wiki 页面列表]
    ---
    ```
2. 向 `wiki-log.md` 追加记录：
    ```
    ## [YYYY-MM-DD] ingest | 源标题
    - created `page-name` — 原因
    - updated `page-name` — 变更内容
    ```
3. 运行 `llm-wiki-invest sync` 更新搜索索引。

## Ingest 指南

- 每个页面都应当聚焦单一主题。
- 用清晰、简洁的文字写作。要概括，不要照抄。
- 始终为相关页面补充交叉引用。
- 普通 wiki 的核心质量标准是 judgment-ready evidence：事实有出处、变化有比较、signals 能被 right review 读取。
- 当结构、命名或范围存在不确定性时，ingest 应当以协作方式进行；但在既有框架下的直接补充，可以直接落地。
- 使用符合 `wiki-schema.md` 约定的、可读的 slug。
- wiki frontmatter 不维护来源列表；所有来源必须通过正文脚注和 `## 来源` 追溯。
- 维护 `source -> wiki -> wiki/right`：source 先进入知识层，判断层再基于知识层复核。


## 交付

- 新增或更新的 `wiki` 页面路径。
- 关键新增 evidence / delta / signals 摘要。
- 是否建议运行某个 right review skill，以及建议原因。
