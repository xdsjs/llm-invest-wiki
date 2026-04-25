# LLM Wiki Invest

面向 Agent 的持久化知识管理：一次编译知识，长期复用查询。

灵感来自 [Andrej Karpathy 的 LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)。

## 这是什么？

LLM Wiki Invest 是一个 CLI 工具加 AI Agent Skill 系统，用来维护一个持续演化、彼此链接的 Markdown 知识库。与传统 RAG 每次都从原始材料重新推导答案不同，LLM Wiki Invest 会把知识**编译**成结构化 wiki 页面，并由 AI agent 持续维护和扩展。

**核心原则：** 工具本身不直接调用 LLM。它提供 skill 文件，让任何 AI agent（Claude Code、Codex 等）都能操作这个 wiki。Obsidian 是给人类使用的界面，不额外自建 GUI。

## 快速开始

```bash
# 全局安装
npm install -g @xdsjs/llm-wiki-invest

# 初始化一个新的 wiki vault
mkdir my-wiki && cd my-wiki
llm-wiki-invest init

# 然后就可以让你的 AI agent 使用：
#   /ingest sources/some-article.md
#   /query "我们已经知道 X 的哪些信息？"
#   /lint
#   /research "深入研究 Y"
```

`llm-wiki-invest init` 是唯一的初始化命令。它会一次性创建 vault 文件、agent bootstrap 文件（`CLAUDE.md`、`AGENTS.md`），并把内置 skill 安装到 `.claude/skills/` 和 `.agents/skills/`。

如果你要给一家美国上市公司建立只读事实层 dossier，典型流程是：

```bash
llm-wiki-invest init
llm-wiki-invest dossier init --market us --ticker AAPL --company-name "Apple Inc." --cik 0000320193 --exchange NASDAQ

# 由 agent 按 skills/invest-wiki-dossier/template/us.md 生成 reviewed manifest 后执行
llm-wiki-invest dossier apply manifest.json
llm-wiki-invest dossier status
llm-wiki-invest dossier check
```

升级包之后，可以用下面的命令刷新已安装的 skill 文件：

```bash
llm-wiki-invest skill install
```

## Vault 结构

```
my-wiki/
├── CLAUDE.md              # Claude Code 的 agent 引导文件（自动加载）
├── AGENTS.md              # Codex 的 agent 引导文件（自动加载）
├── wiki-purpose.md        # Wiki 的范围与目标受众
├── wiki-schema.md         # 页面类型、命名规则、引用和 frontmatter 规则
├── wiki-log.md            # 追加式操作日志
├── wiki/                  # 由 AI 维护的 wiki 页面（兼容 Obsidian）
├── sources/               # 唯一长期事实层，wiki 只引用这里的来源
│   ├── {document_type}/   # 官方建档材料，如 10-k/、earnings-release/
│   └── research/          # 非官方研究来源或其他明确 source category
├── .claude/
│   └── skills/
│       ├── invest-wiki-flow/     # Claude Code 使用的每日维护 workflow skill
│       └── invest-wiki-ingest/   # /ingest 专门 skill 与模板
├── .agents/
│   └── skills/
│       ├── invest-wiki-flow/     # Codex 使用的每日维护 workflow skill
│       └── invest-wiki-ingest/   # /ingest 专门 skill 与模板
└── .llm-wiki-invest/
    ├── config.toml        # Vault 配置
    ├── sync-state.json    # 增量同步状态
    ├── ingest-plans/      # agent 生成的 ingest 计划与执行记录
    ├── dossier-runs/      # dossier apply 的 manifest、report 与本次 unresolved
    ├── dossier-state.json # dossier 身份与材料状态
    └── dossier-unresolved/ # 无法稳定处理的 dossier 材料
```

`llm-wiki-invest init` 会一步生成上面所有内容。

## Agent 引导

LLM Wiki Invest 使用两层文件结构，让任意 AI agent 在无需手工配置的情况下都能直接操作 vault，而 `llm-wiki-invest init` 会把这一切准备好：

**1. 入口文件：`CLAUDE.md` 和 `AGENTS.md`（位于 vault 根目录）**

这些是**每次会话启动时自动加载**的简短引导文件。Claude Code 会读 `CLAUDE.md`，Codex 会读 `AGENTS.md`。它们会告诉 agent：

- 当前工作区是一个 LLM Wiki Invest vault
- 去哪里读取 `wiki-purpose.md` 和 `wiki-schema.md`
- 可以使用哪些 `/ingest`、`/query`、`/lint`、`/research` 命令
- 主 workflow skill 与专门 skill 位于哪里（例如 `invest-wiki-flow/SKILL.md` 与 `invest-wiki-ingest/SKILL.md`）
- 基础 CLI 速查和核心操作规则

因为它们会自动加载，所以这些入口文件刻意保持简短，通常只有几十行，用来降低会话启动时的上下文成本。

**2. Skill 文件：`.claude/skills/` 和 `.agents/skills/`**

这是完整的 agent 操作手册，只有在 agent 真正调用 wiki 命令时才会按需加载。`invest-wiki-flow/SKILL.md` 是每日 dossier → ingest 维护 workflow，`invest-wiki-ingest/SKILL.md` 承载完整 `/ingest` 流程，其他投资领域专门流程也以 bundle skill 形式安装。同一组 skill 会安装到两个平台目录下，因此同一个 vault 可以同时被 Claude Code 和 Codex 使用，而无需额外适配。

**升级。** `llm-wiki-invest init` 仍然是唯一的初始化命令，它会写入入口文件并安装 skill。升级 npm 包之后，运行 `llm-wiki-invest skill install` 即可刷新 skill 文件。你自己对 `CLAUDE.md` / `AGENTS.md` 的修改在重新安装后仍会保留。

批量 ingest 时，agent 会在 `.llm-wiki-invest/ingest-plans/` 写入计划和执行记录。计划由 agent 消费，不是 CLI 输入。上市公司 wiki 的页面类型和页面骨架由 `wiki-schema.md` 定义；官方 sources 的目标页面由 agent 在 plan 阶段根据 source 实际内容选择，`document_type` 只作为阅读背景和优先级信号。

## 操作

Skill 暴露四个操作，它们都以斜杠命令的形式被调用：

| 操作 | 用法 | 作用 |
|------|------|------|
| **ingest** | `/ingest <path>` | 读取来源 → 抽取实体 → 创建/更新带有 `[[wikilinks]]` 的 wiki 页面 |
| **query** | `/query <question>` | 搜索 wiki → 综合回答 → 把有价值的新知识写回 wiki |
| **lint** | `/lint` | 做健康检查：坏链接、孤儿页、矛盾、陈旧内容 → 自动修复安全问题 |
| **research** | `/research <topic>` | 走出 wiki：搜索网络 → 保存资料 → ingest → 产出研究报告 |

## CLI 命令

| 命令 | 说明 |
|------|------|
| `llm-wiki-invest init [dir]` | 初始化一个新的 wiki vault |
| `llm-wiki-invest dossier fetch-sec-submissions --cik ... [--recent] [--forms ...]` | 抓取 SEC submissions JSON，或输出最近 filings 摘要 |
| `llm-wiki-invest dossier init ...` | 初始化当前 vault 的 dossier 身份上下文 |
| `llm-wiki-invest dossier apply <manifest> [--run-id <id>]` | 建立 dossier run 记录，并把 reviewed manifest 物化到 `sources/` |
| `llm-wiki-invest dossier status` | 展示 dossier 材料数、披露数、authority/type 统计与 unresolved 数 |
| `llm-wiki-invest dossier check` | 检查官方 sources 目录结构与 frontmatter 是否合规 |
| `llm-wiki-invest sources pending [path] [--json]` | 按输入范围列出未 ingest 或已变化的来源；`path` 可为 `sources/` 文件/目录或 `.llm-wiki-invest/dossier-runs/<run-id>/` |
| `llm-wiki-invest sources mark-ingested <paths...> --pages <pages>` | agent 写完 wiki 后，给来源写入 `ingested`、`ingest_hash`、`wiki_pages` |
| `llm-wiki-invest search <query>` | BM25 关键词搜索（如果配置了 DB9，也会结合向量搜索） |
| `llm-wiki-invest graph [--json]` | 分析 wikilink 图：社区、枢纽页、孤儿页、待写页 |
| `llm-wiki-invest status` | 展示 wiki 统计信息和健康摘要 |
| `llm-wiki-invest sync [--dry-run]` | 跟踪变更（mtime + SHA256），并同步 embedding 到 DB9 |
| `llm-wiki-invest skill install` | 把全部 skill 安装到 AI agent 工作区 |
| `llm-wiki-invest skill list` | 列出可用 skill |
| `llm-wiki-invest skill show <name>` | 把 skill 内容输出到标准输出 |

## 搜索

支持 **BM25 关键词搜索**，同时带有 CJK bigram 分词能力（支持中文 / 日文 / 韩文）。

如果配置了 DB9，搜索会升级为**混合搜索**：BM25 + 向量相似度，并通过 Reciprocal Rank Fusion（RRF，K=60）合并结果。

```bash
llm-wiki-invest search "distributed consensus"
llm-wiki-invest search "分布式共识" -n 5
llm-wiki-invest search "raft algorithm" --bm25-only
```

## 图分析

分析 `[[wikilink]]` 图，帮助你理解知识库结构：

- **社区**：用标签传播算法识别出的主题簇
- **枢纽页**：连接最集中的页面（高入度 + 高出度）
- **孤儿页**：没有入链的页面
- **待写页**：已被链接但尚未创建的页面

```bash
llm-wiki-invest graph          # 人类可读输出
llm-wiki-invest graph --json   # 机器可读输出
```

## DB9 集成（可选）

[DB9](https://db9.ai) 提供向量搜索和云端同步能力：

- 通过 `embedding(text)::vector(1024)` 在服务端生成 embedding，无需本地模型
- 使用 HNSW 向量索引做语义相似检索
- 支持反向来源查询：“哪些 wiki 页面引用了这个来源？”

启用方式是在 `.llm-wiki-invest/config.toml` 中添加：

```toml
[db9]
url = "your-db9-connection-string"
```

然后运行 `llm-wiki-invest sync` 上传 embedding。

## Obsidian 兼容性

`wiki/` 和 `sources/` 都是标准 Markdown 目录，可以直接在 Obsidian 中打开：

- YAML frontmatter
- `[[wikilink]]` 交叉引用
- 正文脚注和末尾 `## Refs` 来源引用
- 可直接在 Obsidian 中打开、浏览、看图谱和编辑

其中：

- `wiki/` 用于 agent 和人持续维护的知识页
- `sources/` 用于只读来源材料，是 wiki 唯一可引用的事实层；其中官方建档材料由 `llm-wiki-invest dossier apply` 写入，不应手工改写正文

## 配置

`.llm-wiki-invest/config.toml`：

```toml
[vault]
name = "我的 Wiki"
language = "zh"

# 可选：DB9 用于向量搜索和云同步
# [db9]
# url = "your-db9-connection-string"
```

## 技术栈

- TypeScript（ESM，Node 20+）
- [Commander.js](https://github.com/tj/commander.js/)：CLI 框架
- [gray-matter](https://github.com/jonschlinkert/gray-matter)：frontmatter 解析
- [pg](https://node-postgres.com/)：PostgreSQL 客户端（用于 DB9）
- [tsup](https://tsup.egoist.dev/)：构建
- [Vitest](https://vitest.dev/)：测试
