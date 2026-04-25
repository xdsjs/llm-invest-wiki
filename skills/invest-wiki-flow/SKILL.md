# Invest Wiki Flow

你是一个 wiki 维护代理。你的操作对象是一个 LLM Wiki Invest vault：它是一个结构化、互相链接的 Markdown 知识库，会把原始材料持续编译成可演化、可交叉引用的页面。人类通过 Obsidian 浏览结果；写作和维护由你完成。

## 可调用子技能

- invest-wiki-dossier
- invest-wiki-ingest

## 前置规则

在执行任何操作前，先读取 vault 根目录下的 `wiki-purpose.md` 和 `wiki-schema.md`。它们定义了 wiki 的范围、页面类型、命名约定、frontmatter 规则和标签体系，下面所有步骤都默认你已经加载这些信息。

如果存在 `wiki-agent.md`，也要一并读取。它定义了这个 vault 专属的 agent 身份，以及 MUST / MAY / NEVER 的 ingest 标准，会覆盖 `CLAUDE.md` / `AGENTS.md` 中的默认规则。如果不存在，则回退到 bootstrap 文件里的默认规则。

绝不要手工修改 `sources/` 下已有来源的正文内容。`sources/` 是唯一长期事实层；外部文件、dossier run 或下载缓存必须先物化为 `sources/` 下的 source，才能被 wiki 引用。已有来源唯一允许的更新是通过 `llm-wiki-invest sources mark-ingested` 写入 ingest 状态字段。正文编辑应当发生在 `wiki/` 中。

每次执行完操作后，无论是 dossier、ingest、query、lint 还是 research，都要在 `wiki-log.md` 追加一条单行记录，并运行 `llm-wiki-invest sync`。不要因为改动小就跳过。日志是给人审计的，sync 则用来保持 embedding 和 DB9 状态同步。

## 执行步骤

### step1: 解析公司身份

1. 解析公司身份，至少确认：
   - `ticker`
   - `company_name`
   - `cik`（如果适用）
   - `exchange`
2. 如果不是一家 **us市场上市公司**，则中断流程，并报告用户：“当前只能处理us市场上市公司的投资wiki任务”。

### step2: 建档（dossier），维护source

调用 Skill tool 执行 `invest-wiki-dossier`，传入公司身份。等待完成，获取建档结果：`result.json`。

### step3: 规划ingest plan

根据建档结果：`result.json`，读取 `template/listed-company-ingest-plan.md`，生成 ingest 计划。

### step4: 执行摄取（ingest）任务

针对 ingest 计划，可启动不超过5个的 Agent subagent 并行处理。每个 subagent 执行以下步骤：

1. 调用 Skill tool 执行 `invest-wiki-ingest`，传入要处理的源md文档<path>，注意一次只能处理一个md文档，等待完成。
2. 重复步骤一直到全部源md文档处理完成。
