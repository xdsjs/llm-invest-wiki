import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findVaultRoot, vaultPaths } from '../lib/config.js';
import { installSkillsTo } from '../lib/skills.js';

const PURPOSE_TEMPLATE = `---
title: Wiki 目的
---

# 目的

请描述这个 wiki 的主题、范围以及目标读者。

示例："这个 wiki 用来跟踪我对分布式系统的研究，覆盖论文、概念和开放问题。"
`;

const SCHEMA_TEMPLATE = `---
title: Wiki 规范
---

# 规范

## 页面类型

在这里定义这个 wiki 中有哪些页面类型，以及它们分别遵循什么约定。

## 命名规范

- 页面文件名使用 kebab-case（例如：\`distributed-consensus.md\`）
- 如果有需要，可以使用子目录组织分类（例如：\`wiki/papers/raft.md\`）

## 必需的 Frontmatter

每个 wiki 页面都必须包含：

\`\`\`yaml
---
title: 页面标题
description: 一行摘要
tags: []
sources: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
\`\`\`

## 标签

随着 wiki 的增长，在这里逐步定义你的标签体系。
`;

const CONFIG_TEMPLATE = `[vault]
name = "我的 Wiki"
language = "zh"

# [db9]
# url = "your-db9-connection-string"
`;

const LOG_TEMPLATE = `# 变更日志

以追加方式记录 wiki 操作。格式：\`[date] verb | subject\`
`;

function agentTemplate(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `---
title: Wiki 代理
description: 这个 vault 中 agent 的身份、职责和自动 ingest 规则
tags: [meta]
created: ${today}
updated: ${today}
---

# Wiki 代理

这个页面定义 wiki agent 是谁，以及它应该如何行动。agent 会在启动时
（通过 CLAUDE.md / AGENTS.md）读取这里，以理解自己的角色。

## 身份

在这里描述 agent 的角色。示例：

> 我是 [项目名] 的知识维护者。我观察讨论，提取有价值的信息，
> 并把它们整理成结构化的 wiki 页面。

## 职责

- 持续从收到的输入中 ingest 值得写入 wiki 的信息
- 维护现有 wiki 页面的准确性和新鲜度
- 使用 [[wikilinks]] 交叉引用相关主题
- 不参与讨论，只观察和记录

## Ingest 规则

### MUST 记录
- 决策及其原因
- 架构与设计结论
- 任务 / issue 的生命周期事件（创建、分配、完成）
- Bug 报告与解决结果
- 新系统、新概念或新流程

### MAY 记录
- 尚未确认的提案与想法
- 工具与工作流讨论
- 性能观察

### NEVER 记录
- 闲聊和寒暄
- 凭证、token、个人数据
- 已经写进 wiki 的重复信息
- 纯表情或单词式回应

## 输出标准

- 使用 \`.llm-wiki-invest/config.toml\` 中指定的语言写作
- 每个 wiki 页面只聚焦一个主题
- 始终标注来源
- 对于已经有页面或应该有页面的实体，都使用 [[wikilinks]]
- 每次操作都要追加到 wiki-log.md
`;
}

const CLAUDE_MD_TEMPLATE = `# LLM Wiki Invest

当前工作区是一个 LLM Wiki Invest vault。所有 wiki 相关操作都使用
\`llm-wiki-invest\` skill。完整 skill（操作步骤、schema、示例）位于
\`.claude/skills/llm-wiki-invest.md\`，由 Claude Code 按需加载。

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
- \`dossier/\`：只读事实层材料（官方文件的 Markdown 派生件）
- \`wiki-agent.md\`：agent 行为规则（可选，vault 专属）
- \`sources/\`：原始来源材料，按日期分区（不可修改）
- \`wiki-log.md\`：追加式操作日志
- \`.llm-wiki-invest/\`：配置和同步状态

## CLI

- \`llm-wiki-invest search <query>\`：BM25 关键词搜索（如果配置了 DB9，也会使用向量搜索）
- \`llm-wiki-invest graph\`：社区、枢纽页、孤儿页、待写页
- \`llm-wiki-invest status\`：统计信息和健康摘要
- \`llm-wiki-invest sync\`：跟踪 mtime / SHA256 变化，并在配置时推送 embedding 到 DB9
- \`llm-wiki-invest dossier init ...\`：初始化当前 vault 的 dossier 身份上下文
- \`llm-wiki-invest dossier apply <manifest>\`：把 reviewed dossier manifest 物化到 \`dossier/\`
- \`llm-wiki-invest dossier status\` / \`check\`：查看 dossier 覆盖状态并做结构检查

## 规则

1. 在执行任何操作前，始终先读 \`wiki-purpose.md\` 和 \`wiki-schema.md\`
2. 绝不要修改 \`sources/\` 中的文件，它们是不可变的原始输入
3. 页面之间的交叉引用统一使用 \`[[wikilinks]]\`
4. 每次操作结束后，都要在 \`wiki-log.md\` 追加记录，并运行 \`llm-wiki-invest sync\`
5. 当你收到信息时，要按自动 ingest 标准判断，不要等显式命令
`;

const AGENTS_MD_TEMPLATE = `# LLM Wiki Invest

当前工作区是一个 LLM Wiki Invest vault。所有 wiki 相关操作都使用
\`llm-wiki-invest\` skill。完整 skill（操作步骤、schema、示例）位于
\`.agents/skills/llm-wiki-invest.md\`，由 Codex 按需加载。

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
- \`dossier/\`：只读事实层材料（官方文件的 Markdown 派生件）
- \`wiki-agent.md\`：agent 行为规则（可选，vault 专属）
- \`sources/\`：原始来源材料，按日期分区（不可修改）
- \`wiki-log.md\`：追加式操作日志
- \`.llm-wiki-invest/\`：配置和同步状态

## CLI

- \`llm-wiki-invest search <query>\`：BM25 关键词搜索（如果配置了 DB9，也会使用向量搜索）
- \`llm-wiki-invest graph\`：社区、枢纽页、孤儿页、待写页
- \`llm-wiki-invest status\`：统计信息和健康摘要
- \`llm-wiki-invest sync\`：跟踪 mtime / SHA256 变化，并在配置时推送 embedding 到 DB9
- \`llm-wiki-invest dossier init ...\`：初始化当前 vault 的 dossier 身份上下文
- \`llm-wiki-invest dossier apply <manifest>\`：把 reviewed dossier manifest 物化到 \`dossier/\`
- \`llm-wiki-invest dossier status\` / \`check\`：查看 dossier 覆盖状态并做结构检查

## 规则

1. 在执行任何操作前，始终先读 \`wiki-purpose.md\` 和 \`wiki-schema.md\`
2. 绝不要修改 \`sources/\` 中的文件，它们是不可变的原始输入
3. 页面之间的交叉引用统一使用 \`[[wikilinks]]\`
4. 每次操作结束后，都要在 \`wiki-log.md\` 追加记录，并运行 \`llm-wiki-invest sync\`
5. 当你收到信息时，要按自动 ingest 标准判断，不要等显式命令
`;

export const initCommand = new Command('init')
  .description('Initialize a new llm-wiki-invest vault')
  .argument('[directory]', 'directory to initialize', '.')
  .action((directory: string) => {
    const targetDir = join(process.cwd(), directory);

    // Check if already initialized
    if (findVaultRoot(targetDir)) {
      console.error('Error: This directory is already inside an llm-wiki-invest vault.');
      process.exit(1);
    }

    const paths = vaultPaths(targetDir);

    // Create directories
    mkdirSync(paths.wiki, { recursive: true });
    mkdirSync(paths.dossier, { recursive: true });
    mkdirSync(paths.sources, { recursive: true });
    mkdirSync(paths.llmWikiDir, { recursive: true });

    // Install skills first (before vault marker) so a failure here leaves
    // the dir in a re-runnable state instead of half-initialized.
    // overwrite=false so a user's customized skill file is preserved.
    const claudeSkills = installSkillsTo(paths.claudeSkillsDir, false);
    const agentsSkills = installSkillsTo(paths.agentsSkillsDir, false);

    // Create files (only if they don't exist)
    const filesToCreate: [string, string][] = [
      [paths.purpose, PURPOSE_TEMPLATE],
      [paths.schema, SCHEMA_TEMPLATE],
      [paths.agent, agentTemplate()],
      [paths.config, CONFIG_TEMPLATE],
      [paths.log, LOG_TEMPLATE],
      [paths.claudeMd, CLAUDE_MD_TEMPLATE],
      [paths.agentsMd, AGENTS_MD_TEMPLATE],
    ];

    for (const [path, content] of filesToCreate) {
      if (!existsSync(path)) {
        writeFileSync(path, content);
      }
    }

    const skillSummary = (r: { installed: string[]; skipped: string[] }) => {
      const parts: string[] = [];
      if (r.installed.length) parts.push(`${r.installed.length} installed`);
      if (r.skipped.length) parts.push(`${r.skipped.length} kept`);
      return parts.join(', ') || 'no skills';
    };

    console.log(`Initialized llm-wiki-invest vault in ${targetDir}`);
    console.log('');
    console.log('Created:');
    console.log('  wiki/            — AI-maintained wiki pages');
    console.log('  dossier/         — Read-only official dossier materials');
    console.log('  sources/         — Raw source documents');
    console.log('  wiki-purpose.md  — Wiki purpose and scope');
    console.log('  wiki-schema.md   — Page conventions and structure');
    console.log('  wiki-agent.md    — Agent identity and ingest rules');
    console.log('  wiki-log.md      — Change log');
    console.log('  CLAUDE.md        — Agent bootstrap (Claude Code)');
    console.log('  AGENTS.md        — Agent bootstrap (Codex)');
    console.log('  .llm-wiki-invest/ — Config and state');
    console.log(`  .claude/skills/  — ${skillSummary(claudeSkills)}`);
    console.log(`  .agents/skills/  — ${skillSummary(agentsSkills)}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit wiki-purpose.md to define your wiki\'s scope');
    console.log('  2. Edit wiki-schema.md to set naming conventions');
    console.log('  3. Use your AI agent with /ingest to start building the wiki');
    console.log('');
    console.log('To upgrade skills later: `llm-wiki-invest skill install`');
  });
