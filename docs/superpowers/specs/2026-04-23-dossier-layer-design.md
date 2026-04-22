# Dossier 层设计

日期：2026-04-23  
主题：单公司 invest dossier 层  
状态：讨论已通过，尚未实现

## 目标

定义单家公司 invest vault 的 dossier 层。

dossier 层是这个 vault 的只读事实层。它把官方、监管、交易所、公司控制的文件级公开材料保存为 Markdown 派生件，供人和 agent 在 Obsidian 中查看，同时保持“agent 编排”和“CLI 确定性执行”之间的稳定边界。

## 非目标

- 不重设计现有的 `wiki/` 层。
- 不让 CLI 直接调用 LLM。
- 不在 `dossier/` 内保存原始二进制文件或 HTML 原件。
- 不允许 LLM 在 materialize 之后自由编辑 dossier 文件。

## 核心决策

### Vault 模型

- 一家公司就是一个 vault。
- 本 spec 只定义 `dossier/`。
- 现有 `wiki/` 层继续存在，但不在本 spec 范围内。

### Dossier 语义

- `dossier/` 是只读层。
- dossier 只保存文件级官方材料。
- 普通公司官网或 IR HTML 页面只作为发现入口，不会直接成为 dossier 文件。
- 每个 dossier 文件都是一份官方源文件的近原文 Markdown 派生件。
- LLM 可以参与“抓什么、如何分类”的判断，但不能自由改写 dossier 产物。

### Authority 模型

`dossier/` 下第一层路径表示发布权威来源，而不是内容主题。

美国模板允许的一级 authority：

- `sec`
- `nasdaq`
- `nyse`
- `company`

公司控制来源不会在路径里继续拆成 `ir`、`governance`、`newsroom`。这些 channel 信息放在元数据里，不放在目录树里。

### 材料与披露边界

- 一份官方文件对应一个 dossier Markdown 文件。
- 一次披露事件对应一个目录。
- 同一次披露下的多个文件必须放在同一个披露目录里。
- 同一文档类型并不代表同一材料。
  例如：两个不同发布日期的 `10-K` 是两份不同材料。

### 只读派生模型

dossier 不保存原始文件，只保存 Markdown 派生件。  
这些派生件通过 frontmatter 指回原始 URL 和来源 authority。

派生件应尽量贴近原始文档的结构和措辞。它不是事实汇总页，也不是分析页。

## 备选方案

### 方案 A：厚模板，薄 CLI

- 把大部分美国市场特有逻辑写进 `template/us.md`
- CLI 只保留很小的下载和 materialize 能力

优点：

- 模板层迭代快
- agent 更容易依据模板推理市场规则

缺点：

- 太多执行逻辑会漂到文字描述里
- 确定性行为不易测试
- skill 层负担过重

### 方案 B：厚 CLI，薄模板

- 把大部分美国市场的发现和分类逻辑硬编码进 CLI
- 模板只保留高层原则

优点：

- 执行路径稳定
- 更容易做确定性重跑

缺点：

- 不符合当前项目哲学
- 让 CLI 承担了判断型逻辑
- 以后扩展到其他市场会更别扭

### 方案 C：中厚模板 + 中厚 CLI + 明确编排边界

- `template/us.md` 定义策略、范围、分类、去重规则和输出 schema
- `invest-wiki-dossier` skill 在模板约束下做发现和分类编排
- CLI 根据已审定 manifest 执行确定性原语

推荐：

- 选择方案 C。
- 它最符合已锁定的边界：skill 是编排层，CLI 是执行层。

## 推荐架构

### Skill 职责

`invest-wiki-dossier` 是编排层。

它必须：

- 读取 `template/us.md`
- 解析公司身份
- 检查官方发现入口页面和 API
- 判断哪些链接是真正的官方文件级材料
- 将每份材料归类到 dossier `document_type`
- 把材料分组到披露目录
- 产出一个经过审定、可供确定性执行的 manifest
- 调用 dossier CLI 命令

它不得：

- 绕过 CLI 直接写 dossier Markdown 文件
- 把 HTML 发现页当作 dossier 材料
- 重写已经 materialize 的 dossier 文件
- 在 dossier 中写投资结论

### 模板职责

`template/us.md` 是美国市场的 dossier 策略文件。

它必须定义：

- 什么算允许进入 dossier 的材料
- 允许使用哪些发现入口
- 有哪些文档类型
- authority 与 channel 如何解释
- 路径和披露目录如何形成
- frontmatter 有哪些必填字段
- 重复检测应如何工作
- 哪些情况应写入 unresolved，而不是直接落盘

它不应充当下载或文件 I/O 的伪代码说明。

### CLI 职责

CLI 是确定性执行层。

它必须：

- 接收显式身份输入，初始化本地 dossier 状态
- 读取已审定 manifest
- 创建 dossier 目录
- 抓取源文件
- 生成近原文 Markdown 派生件
- 写 dossier frontmatter
- 执行命名规则
- 运行重复检测
- 输出状态和结构问题

它不得：

- 在 v1 中自行从网络发现候选材料
- 从模糊输入里推断公司身份
- 直接调用 LLM

## 目录布局

dossier 树去掉额外的 `materials/` 嵌套，统一使用：

```text
dossier/{authority}/{document_type}/{year}/{disclosure_key}/
```

示例：

```text
dossier/sec/10-k/2024/2024-11-01-0000320193-10-k/
  00-primary-10-k.md
  01-ex13-annual-report.md

dossier/sec/8-k/2026/2026-02-01-0000320193-8-k/
  00-primary-8-k.md
  01-ex99-1-press-release.md
  02-ex99-2-presentation.md

dossier/company/earnings-release/2026/2026-02-01-q1-results/
  00-earnings-release.md
  01-presentation.md
  02-transcript.md
```

规则：

- 披露目录是归组单位。
- 披露目录内文件必须带顺序前缀。
- 同一披露目录下的所有文件遵守统一命名规范。
- 年份层来自官方发布日期。

## Frontmatter 规范

dossier 文件使用 YAML frontmatter。

最小必填字段：

```yaml
---
title:
source:
author:
published:
created:
authority:
document_type:
disclosure_key:
---
```

字段含义：

- `title`：官方标题，或最接近官方表述的标题
- `source`：原始文件 URL
- `author`：Obsidian 风格的来源链接，例如 `[[sec.gov]]` 或 `[[apple.com]]`
- `published`：官方发布日期
- `created`：本地 materialize 日期
- `authority`：`sec`、`nasdaq`、`nyse`、`company` 之一
- `document_type`：标准化后的 dossier 文档类型
- `disclosure_key`：当前披露目录的稳定归组 key

推荐的附加字段：

- `retrieved_at`
- `canonical_url`
- `source_channel`

## 去重与身份模型

dossier 应尽量避免重复抓取同一材料。

文档类型不是材料身份。

身份规则：

- SEC 材料：用 `accession_no + primary_document` 识别
- NASDAQ 材料：用 `canonical_url + published` 识别
- NYSE 材料：用 `canonical_url + published` 识别
- 公司材料：用 `canonical_url + published` 识别

补充规则：

- `content_hash` 是校验信号，不是主身份键
- 如果身份相同且内容未变，按重复材料跳过
- 如果身份相同但内容变化，应标记审查或进入版本处理，而不是静默覆盖
- 如果发布身份不同，应视为新材料

这与前面讨论得到的原则一致：

- 避免重复抓取
- 让不同材料保持分离
- 绝不因为共享同一个 `document_type` 就把不同披露合并

## Manifest 契约

manifest 是“编排层”和“确定性执行层”的边界。

它由 skill 产出，由 CLI 消费。

每条 manifest 记录至少应包含：

- `company_name`
- `ticker`
- `market`
- `authority`
- `source`
- `canonical_url`
- `author`
- `published`
- `document_type`
- `disclosure_key`
- `sequence`
- `suggested_filename`

可选字段：

- `accession_no`
- `primary_document`
- `source_channel`
- `content_type`
- `notes`

manifest 必须已经体现编排层的判断结果。CLI 不应再从零推断材料分类。

## CLI 命令定义

### `llm-wiki-invest dossier init`

用途：

- 为当前单公司 vault 初始化 dossier 状态

预期输入：

- 明确给出的身份字段，例如 market、ticker、company name、CIK、exchange

关键边界：

- 这条命令不自己发现或推断公司身份
- 它只把已经确认的身份信息写入本地状态，供后续确定性执行使用

### `llm-wiki-invest dossier apply <manifest>`

用途：

- 把已审定的 manifest 执行并落盘到本地 dossier 树

职责：

- 创建披露目录
- 抓取文件
- materialize Markdown 派生件
- 写 frontmatter
- 执行命名规则
- 做重复检测
- 跳过确认重复的材料
- 输出新增、跳过和 unresolved 结果

### `llm-wiki-invest dossier status`

用途：

- 报告当前 dossier 的覆盖情况和状态

建议输出：

- 材料文件数
- 披露目录数
- 按 authority 统计
- 按 document type 统计
- 最新 publication date
- unresolved 数量
- 最近一次 apply 时间

### `llm-wiki-invest dossier check`

用途：

- 检查 dossier 的结构和 frontmatter 一致性

建议检查项：

- 必填 frontmatter 是否存在
- `author` 是否使用 Obsidian 风格链接
- 路径是否符合 authority/document_type/year/disclosure_key
- 文件名是否使用顺序前缀
- 目录内文件命名是否一致
- 是否存在重复身份 key
- 是否有空文件或畸形文件

### 未来可加的窄 helper：`llm-wiki-invest dossier sec-index`

它不属于 v1，但明确允许作为未来的窄 CLI helper 存在。

用途：

- 只抓取结构化 SEC index 数据

原因：

- 这是一个受限的确定性 helper，不会破坏“skill 编排、CLI 执行”的边界
- 它优于一个泛化的 CLI `discover` 命令

## 端到端工作流

### 初次建档

1. skill 读取 `template/us.md`
2. skill 解析公司身份
3. skill 检查允许的发现入口
4. skill 选择有效的文件级材料
5. skill 对材料分类并分配披露归组
6. skill 写 manifest
7. skill 运行 `dossier init`
8. skill 运行 `dossier apply <manifest>`
9. skill 运行 `dossier check`

### 增量同步

1. skill 再次对允许来源做发现
2. skill 用已知身份 key 对候选材料做比较
3. skill 写 delta manifest
4. skill 运行 `dossier apply <delta-manifest>`
5. skill 运行 `dossier check`

## 为什么这样设计

这个设计既保留了当前项目的哲学，也让 dossier 实用可落地：

- judgment-heavy 的工作继续留给 agent
- CLI 保持确定性、可测试、可重跑
- dossier 树保持只读、可审计
- 文件级材料能按披露正确归组
- 未来扩展其他市场模板时，不必把 CLI 变成一个 LLM runtime
