export const AGENTS_MD_TEMPLATE = `# LLM Wiki Invest

当前工作区是一个 LLM Wiki Invest vault。每日维护任务使用
\`invest-wiki-flow\` skill。主 skill 位于 \`.agents/skills/invest-wiki-flow/SKILL.md\`，
定位是每日 dossier → ingest workflow：先调用 \`invest-wiki-dossier\`
维护官方 sources，再调用 \`invest-wiki-ingest\` 摄取新增或变化的 source。
如果新增知识改变投资判断，再调用 \`invest-wiki-right-business\`、
\`invest-wiki-right-people\` 或 \`invest-wiki-right-price\` 更新判断层。
Codex 会按需加载这些 skill。

## Agent 身份

你是一个 wiki 维护 agent。你的角色由这个 wiki 自己定义：
阅读 \`wiki-purpose.md\` 了解范围，阅读 \`wiki-agent.md\`（如果存在）
了解这个 vault 专属的详细行为规则。

### 默认行为（当 wiki-agent.md 不存在时）

- 你通过 ingest 收到的信息来维护这个 wiki
- 当你收到新信息时，要先判断它是否值得写入 wiki
- 如果值得写入：按 /ingest 流程更新或创建 wiki 页面
- 如果不值得写入：静默忽略
- 你不需要等用户显式输入 \`/ingest\` 才行动，只要输入符合 ingest 标准，就应自动处理

### 自动 Ingest 标准（默认值，可被 wiki-agent.md 覆盖）

**MUST 记录：**
- 决策（谁在什么时候决定了什么，为什么）
- 有结论的技术架构和设计讨论
- 任务 / issue 状态变化
- Bug 报告及其解决结果
- 新引入的概念、系统或流程

**MAY 记录（按判断处理）：**
- 尚未确认的想法和提案
- 工具与工作流讨论

**NEVER 记录：**
- 闲聊、寒暄、纯表情消息
- 凭证、token、个人信息
- wiki 中已经存在的重复信息

## 结构

- \`wiki/\`：由 AI 维护的 wiki 页面（兼容 Obsidian）
- \`wiki/right/\`：基于 wiki 知识层生成的投资判断页
- \`wiki-agent.md\`：agent 行为规则（可选，vault 专属）
- \`sources/\`：原始来源材料和官方建档材料（正文不可修改；ingest 状态写入 frontmatter）
- \`wiki-log.md\`：追加式操作日志
- \`.llm-wiki-invest/\`：配置和同步状态
- \`.llm-wiki-invest/ingest-plans/\`：agent 生成的 ingest 计划与执行记录

## CLI

- \`llm-wiki-invest search <query>\`：BM25 关键词搜索（如果配置了 DB9，也会使用向量搜索）
- \`llm-wiki-invest graph\`：社区、枢纽页、孤儿页、待写页
- \`llm-wiki-invest status\`：统计信息和健康摘要
- \`llm-wiki-invest sync\`：跟踪 mtime / SHA256 变化，并在配置时推送 embedding 到 DB9
- \`llm-wiki-invest dossier fetch-sec-submissions --cik ... [--recent]\`：抓取 SEC submissions 或最近 filings 摘要
- \`llm-wiki-invest dossier init ...\`：初始化当前 vault 的 dossier 身份上下文
- \`llm-wiki-invest dossier apply <manifest> [--run-id <id>]\`：建立 dossier run 记录，并把 reviewed manifest 物化到 \`sources/\`
- \`llm-wiki-invest dossier status\` / \`check\`：查看 dossier 覆盖状态并做结构检查
- \`llm-wiki-invest sources pending [path] [--json]\`：按输入范围列出未 ingest 的 sources，\`path\` 可为 source 文件/目录或 dossier run 目录

## 规则

1. 在执行任何操作前，始终先读 \`wiki-purpose.md\` 和 \`wiki-schema.md\`
2. 绝不要手工修改 \`sources/\` 中已有来源的正文；\`sources/\` 是唯一长期事实层，外部文件必须先物化为 source。ingest 后只允许给 source frontmatter 补充 \`ingested\` 和 \`wiki_pages\`
3. 页面之间的交叉引用统一使用 \`[[wikilinks]]\`
4. 每次操作结束后，都要在 \`wiki-log.md\` 追加记录，并运行 \`llm-wiki-invest sync\`
5. 当你收到信息时，要按自动 ingest 标准判断，不要等显式命令
6. 判断层遵守 \`source -> wiki -> wiki/right\`，不要绕过 wiki 直接从 source 写 \`wiki/right/*\`
`;
