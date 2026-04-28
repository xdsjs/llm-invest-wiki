export const SCHEMA_TEMPLATE = `---
title: Wiki 规范
---

# 规范

## 三层结构

本 vault 使用三层结构：

- \`sources/\`：唯一长期事实层，保存只读来源材料。
- \`wiki/\`：结构化证据层，基于 source 归纳事实、时间线、主题、跨来源关系和可被判断层消费的 signals。
- \`wiki/right/\`：投资判断层，基于 \`wiki/\` 回答高质量价值投资问题，给人阅读。

判断层不得直接从 \`sources/\` 跳写。新增来源必须先通过 ingest 编译进 \`wiki/\`，再由 right review 流程更新 \`wiki/right/*\`。

## 页面类型

### 长期知识页

长期知识页持续维护一个稳定主题，会吸收多个季度、多个披露、多个来源的事实和变化，不按单次事件新建页面。它们是判断层的证据结构，不是资料分类页，也不是最终投资结论。

- Company Profile 页：公司身份、上市信息、基础描述；固定页面 \`wiki/company-profile.md\`。
- Business Overview 页：业务结构、产品线、收入来源、商业模式、分部/地区/产品线披露口径变化；固定页面 \`wiki/business-overview.md\`。
- Financials 页：收入、利润、毛利、现金流、资产负债、关键指标；固定页面 \`wiki/financials.md\`。
- Capital Allocation 页：回购、分红、融资、并购、资本开支；固定页面 \`wiki/capital-allocation.md\`。
- Management Governance 页：管理层、董事会、薪酬、投票、治理文件；固定页面 \`wiki/management-governance.md\`。
- Risk Factors 页：风险披露、风险变化、监管和诉讼风险；固定页面 \`wiki/risk-factors.md\`。
- Filings Timeline 页：重要 SEC、交易所、公司披露索引；固定页面 \`wiki/filings-timeline.md\`。
- Open Questions 页：待确认问题、后续研究任务和明确标注的 interpretation；固定页面 \`wiki/open-questions.md\`。

### 投资判断页

投资判断页位于 \`wiki/right/\`。它们只基于已有 wiki 知识页和事件页进行判断收敛，不直接吸收未经 ingest 的 source。固定页面为：

- Right Business 页：判断这是不是一门好生意；固定页面 \`wiki/right/right-business.md\`。
- Right People 页：判断这群人是否值得托付资本；固定页面 \`wiki/right/right-people.md\`。
- Right Price 页：判断当前价格是否有足够赔率；固定页面 \`wiki/right/right-price.md\`。

### 事件类型

事件页只记录一次具体披露或事件，例如一次季度财报、一次重大 8-K、一次股东大会；路径 \`wiki/events/{event_slug}.md\`。

## 命名规范

- 长期知识页和投资判断页使用上面定义的固定文件名，不随季度或年份变化。
- 事件页使用 \`wiki/events/{event_slug}.md\`，\`event_slug\` 使用 kebab-case，优先包含日期和事件名，例如 \`2026-01-29-q1-results.md\`。
- 页面文件名使用 kebab-case。
- 已经存在或应该存在页面的实体，都应使用 \`[[wikilinks]]\` 交叉引用。

## 必需 Frontmatter

每个 wiki 页面至少包含：

\`\`\`yaml
---
title: 页面标题
description: 一行摘要
tags: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
\`\`\`

字段规则：

- \`aliases\` 可选，但公司简称、ticker、常见中英文名应尽量写入。
- \`tags\` 使用本文件定义的标签，避免临时造同义标签。
- \`created\` 是页面首次创建日期，\`updated\` 是最近实质更新日期。
- 不在 frontmatter 中维护来源列表；来源引用写在正文脚注和文件末尾 \`## 来源\`。

## 引用规范

- 正文中来自 source 的关键事实、数字、管理层表述、风险变化，都应使用脚注标记，例如：\`营收同比增长 4%[^src-1]\`。
- 文件末尾必须有 \`## 来源\` 章节，集中放脚注定义。
- \`## 来源\` 中的来源使用 Obsidian wikilink，路径带 \`sources/\` 前缀，便于人点击；不要放进 frontmatter。
- 同一个来源在同一页面内可以复用同一个脚注编号。
- 判断层优先引用 \`wiki/\` 页面；必要时再引用这些 wiki 页面背后的 source。

示例：

\`\`\`md
营收同比增长 4%，服务收入创新高。[^src-1]

## 来源

[^src-1]: [[sources/earnings-release/2026/2026-01-29-q1-results/00-primary-q1-results-release.md|Q1 FY2026 earnings release]]
\`\`\`

## 默认正文骨架

普通 wiki 页的职责是把 source 编译成 judgment-ready evidence。它们必须让 right review 能快速回答：“哪些事实支持、削弱或改变了 Business / People / Price 判断？”

长期知识页默认结构：

\`\`\`md
# 页面标题

## 当前状态
概括截至最新来源的稳定事实和重要变化；不要写流水账，不做最终投资判断。

## 证据台账
用可追溯条目记录关键事实、指标、披露、管理层表述和跨期变化。每条都必须带脚注；能量化的尽量写明期间、口径、单位和方向。

## 变化记录
记录最近新增 source 带来的实质变化，说明相对上一期、上一披露或上一判断所改变的事实。

## 判断层信号
只写可供判断层消费的信号，不写最终结论。

- Right Business:
- Right People:
- Right Price:

## 待确认问题
记录需要后续来源验证的问题，不把推断写成事实。

## 来源
使用脚注定义列出本页引用来源。
\`\`\`

投资判断页通用结构：

\`\`\`md
# 页面标题

## 当前判断
用一两句话给出当前判断，并标注最后复核日期。判断必须链接到支撑它的 wiki 页面。

## 支持证据
列出支持当前判断的事实链、跨期变化和关键 wiki 页面。

## 反证与疑点
列出反证、疑点、冲突信息和需要降权的证据。

## 最近变化
记录最近哪些 wiki 更新改变、强化或削弱了判断。

## 改变判断的条件
写清楚哪些可观察事实会推翻或显著改变当前判断。

## 来源
优先引用 wiki 页面；必要时可引用这些 wiki 页面背后的 source 脚注。
\`\`\`

Right Business 必须额外回答：

- 客户为什么持续付钱，产品或服务是否解决重要问题。
- 收入驱动、单位经济学、利润质量和现金转化是否足够好。
- 竞争优势是否真实、可持续、可扩大。
- 哪些业务风险会损害长期复利能力。

Right People 必须额外回答：

- 管理层是否诚实、能干、长期导向。
- 资本配置记录是否优秀，是否尊重少数股东。
- 激励机制是否和股东长期回报一致。
- 管理层承诺与后续兑现是否一致。

Right Price 必须额外回答：

- 市场当前大概在定价什么预期。
- 我们和市场的差异在哪里。
- Base / Bull / Bear case 的核心假设、敏感性和下行风险。
- 什么价格或什么事实会让赔率不再有吸引力。

事件页默认结构：

\`\`\`md
# 事件标题

## 事件摘要
说明这次披露或事件是什么、发生在什么时候、核心披露是什么、影响哪些长期知识页。关键事实必须带脚注；用 \`[[wikilinks]]\` 指向受影响的长期知识页。

## 相比上期变化
说明相对上一期、上一事件、上一 guidance 或上一管理层表述的关键变化。不要只摘要本次 source。

## 证据台账
列出本次事件贡献的可复用证据，必须带脚注。

## 判断层信号
只写本事件可能影响哪些判断层问题，不写最终判断。

- Right Business:
- Right People:
- Right Price:

## 后续跟踪
记录后续需要验证的指标、披露或问题。

## 来源
使用脚注定义列出本页引用来源。
\`\`\`

## 标签

- \`company\`：公司身份、上市信息、基础资料。
- \`business\`：业务、产品、商业模式、客户和市场。
- \`financials\`：财务数据、指标、现金流、资产负债。
- \`capital-allocation\`：回购、分红、融资、并购、资本开支。
- \`management-governance\`：管理层、董事会、薪酬、投票和治理。
- \`risk\`：风险因素、监管、诉讼和不确定性。
- \`filing\`：监管文件、交易所文件、公司披露索引。
- \`event\`：单次披露或事件。
- \`open-question\`：待确认问题和后续研究任务。
- \`right-business\`：业务质量判断。
- \`right-people\`：管理层、治理和资本配置判断。
- \`right-price\`：估值、赔率和市场预期判断。
- \`synthesis\`：跨页面综合，只在无法归入既有页面体系时使用。

## 写作约束

- 必须区分事实、推断和待确认问题。
- 普通 \`wiki/\` 页面是证据结构：必须优先维护 \`证据台账\`、\`变化记录\` / \`相比上期变化\` 和 \`判断层信号\`。
- 普通 \`wiki/\` 页面不直接回答“该不该买”，也不写没有证据链的投资结论。
- 不要照抄来源大段正文，要概括并通过脚注保留来源路径。
- 同一来源可以支持多个 wiki 页面，但不要在多个页面重复大段正文。
- 事实写入页面时必须能通过正文脚注和 \`## 来源\` 回溯到 \`sources\`。
- 推断和研究问题写入 \`open-questions.md\`，或在正文中明确标注为 interpretation。
- \`wiki/right/*\` 是判断层，只能基于已有 \`wiki/\` 知识页、事件页和它们引用的来源做判断收敛。
- 判断层必须同时写支持证据、反证和可证伪条件，不能只写结论。
`;
