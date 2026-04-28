---
name: invest-wiki-dossier
description: Use when maintaining official file-level sources for one listed company in an LLM Wiki Invest vault, including initial dossier creation, incremental official disclosures, SEC/IR/exchange materials, and reviewed manifest application.
---

# Invest Wiki Dossier

为单家上市公司维护 `sources/` 事实层。你的产物是官方文件级材料的 Markdown 派生件，不是分析、总结或 wiki 页面。

## 不变量

- 本 skill 只维护 `sources/` 事实层；不写 `wiki/`，不执行 ingest。

## 可执行的 CLI 工具

- `dossier init` 初始化状态。
- `dossier refresh-state` 从已追踪 source 回填旧 state 的材料元数据和 checkpoints。
- `dossier fetch-sec-submissions` 抓取 SEC submissions 辅助信息。
- `dossier apply` 下载、自动选择 Markdown 物化策略、落盘、去重、写 run record。
- `dossier status` / `dossier check` 做结果检查。

## Workflow

### step1: 读取上下文

1. 确认当前目录是目标 vault 根目录。
2. 读取 `.llm-wiki-invest/dossier-state.json`，按“状态读取”规则判断**首次建档** 或 **增量维护**。
   - 不存在：按首次建档处理，先确认公司身份，再运行 `llm-wiki-invest dossier init --market ... --ticker ... --company-name ... [--cik ...] [--exchange ...]`。
   - 已存在但 `materials` 为空，或缺少首次建档 coverage note：按“首次建档未完成”处理，不要降级为增量维护。
   - 已存在：以 state 中的 `ticker`、`companyName`、`cik`、`exchange` 为准；如果用户输入冲突，先停止说明冲突。
   - 旧 state 有 `materials` 但缺少 `checkpoints`，或任一 material 缺少 `authority`、`documentType`、`published`：先运行 `llm-wiki-invest dossier refresh-state`。
   - `materials` 是已建档材料身份表；用于判断具体材料是否已追踪。
   - `checkpoints` 只用于缩小 discovery 窗口；不能单独作为跳过材料的依据。

### step2: 确认公司身份、选择 discovery 窗口

1. 从官方来源确认 `ticker`、`companyName`、`cik`(如果适用)、`exchange` 以及 公司所在**市场**（us/hk/cn）。
2. 读取市场对应的**建档模板**；例如美国市场 `template/us.md`。
   - 没有对应模板的市场：停止，输出：“当前不支持该市场”，停止`Workflow`。
3. **首次建档**：运行 `dossier init`，按**建档模板**建立 baseline/full 覆盖。run id 必须体现 `baseline` 或 `full`，不得使用 `core`、`latest`、`quick` 这类会诱导收窄范围的命名。
4. 首次建档不得只抓最近一个季度、最近年度报告或 agent 自选的“核心材料”。必须逐项覆盖模板核心矩阵；公司历史短于矩阵、官方材料缺失或不适用时，写入 coverage note，而不是静默跳过。
5. **增量维护**：以 state 身份为准，按**建档模板**决定 discovery 窗口；`checkpoints` 只决定检查起点，不能单独作为跳过材料的依据。
   - 只在用户输入与 state 不一致时，输出：“用户输入与 state 不一致”，停止`Workflow`。

### step3: 发现、审定候选材料，并生成reviewed manifest

1. 只从**模板**允许的 official discovery surface 找链接。
2. 对每个候选材料记录 URL、标题、发布日期、来源面、文件类型线索和官方上下文。
3. 按 “候选材料准入” 逐项判断。
4. 按模板确定 `authority`、`documentType`、`disclosureKey`、`sequence`、`suggestedFilename`。
5. 先用材料身份和 state `materials` 排除已存在材料。
6. 对无法确认的材料，不要放进 manifest。
7. 先确定稳定 `<run-id>`，再生成 reviewed manifest：只包含需要新增或明确变化的材料。增量维护时，如果候选列表为空，输出 no-op 并停止`Workflow`。首次建档未完成时，不得因为只找到少量材料就输出 no-op。
8. reviewed manifest 临时保存到 `.llm-wiki-invest/dossier-manifests/<run-id>.json`；不要放进 `sources/` 或 `wiki/`。
9. 首次建档还必须写 coverage note 到 `.llm-wiki-invest/dossier-manifests/<run-id>-coverage.md`，逐项列出核心覆盖矩阵状态：`included` / `existing` / `not-applicable` / `unresolved`。coverage note 是人工可读的范围说明，不是 CLI 数量门禁；没有 coverage note，不得宣称首次建档完成。

### step4: 物化 sources 并校验

1. 调用 `dossier apply`，优先使用稳定 run id：
  ```bash
  llm-wiki-invest dossier apply .llm-wiki-invest/dossier-manifests/<run-id>.json --run-id <run-id>
  ```
2. 运行：
  ```bash
  llm-wiki-invest dossier status
  llm-wiki-invest dossier check
  ```
### step5: 交付结果

1. 读取 `.llm-wiki-invest/dossier-runs/<run-id>/result.json`。
2. 明确返回 `result_json_path: .llm-wiki-invest/dossier-runs/<run-id>/result.json`，供上层 flow 消费。
3. 首次建档返回 `coverage_note_path`。
4. 报告 created / skipped / unresolved。

## 候选材料准入

候选材料必须同时满足：

- 来源属于模板允许的 official discovery surface。
- 材料本身是文件级正式内容，而不是索引页、导航页或摘要页。
- 有稳定 `source` 和 `canonicalUrl`。
- 能确定官方发布日期 `published`。
- 能确定 `authority`、`documentType`、`disclosureKey`。
- 能确定材料身份键。
- 预期能被 CLI 稳定物化为可读 Markdown。

不满足任一条件时，不要硬写入 manifest；需要保留线索时进入 unresolved。

## Reviewed Manifest

只把通过准入且需要落盘的材料放入 manifest。每个 material 至少包含：

- `companyName`
- `ticker`
- `market`
- `authority`
- `title`
- `source`
- `canonicalUrl`
- `author`
- `published`
- `documentType`
- `disclosureKey`
- `sequence`
- `suggestedFilename`

SEC material 还必须包含：

- `accessionNo`
- `primaryDocument`

`sequence` 在目标目录 `sources/{documentType}/{year}/{disclosureKey}/` 内必须唯一。同一次披露下同一种文件类型有多个文件时，共用同一个 `disclosureKey`，用不同 `sequence` 区分。

## Run Result

- `created` 是本次新增 source，供上层 flow 或 ingest 使用。
- `skippedDuplicates` 是已存在且内容未变的材料。
- `unresolved` 需要人工或后续规则处理。

`result.json` 是唯一 run result。如果有 unresolved，再查看 run 内 `unresolved/` 和全局 `.llm-wiki-invest/dossier-unresolved/`。

## 输出格式

no-op 时只报告：

- 检查了哪些官方 surface。
- 依据哪些 state checkpoints 或材料身份判断无新增。
- 是否存在需要人工确认的 unresolved 线索。

apply 后只报告：

- run id 和 run 目录。
- result_json_path。
- 首次建档的 coverage_note_path。
- created / skipped / unresolved 数量。
- created source 路径。
- unresolved 的具体原因。

不要输出长篇抓取过程，不要写投资判断。
