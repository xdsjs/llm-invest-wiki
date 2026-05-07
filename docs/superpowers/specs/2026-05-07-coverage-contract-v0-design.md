# Coverage Contract v0 设计

日期：2026-05-07  
主题：dossier run 的资料覆盖契约  
状态：待用户审阅

## 背景

DossierX 是 `llm-wiki-invest` 的商业化使用方。DossierX 对 dossier 的第一阶段底线不是“报告写得像商业报告”，而是“系统必须知道资料是否完整”。

双方已确认最不能接受的失败模式是：资料漏拉但系统不知道。这会制造虚假的完整感，使后续报告、检索和事实判断建立在缺失资料之上，且 UI 无法提醒用户风险。

因此 v0 的核心原则是：

> 允许 dossier 不完整，但不允许未知不完整。

## 目标

为 `llm-wiki-invest` 增加一个面向 DossierX 的 `Coverage Contract v0`。

该 contract 让每次 dossier run 都产出版本化、原子化、机器可读的 run bundle。DossierX 只消费完整 bundle，并根据其中的覆盖状态决定是否允许进入商业报告生成链路。

v0 范围限定为 `us-listed-company` preset，即美股普通上市公司。该范围覆盖资料边界最清楚的初始场景，包括 SEC、公司 IR、财报发布、电话会和公司控制的公开材料。

## 非目标

- 不优化商业报告生成模板。
- 不实现完整 fact ledger 的事实替换、冲突合并和长期保鲜。
- 不开放真正的增量写回当前事实层。
- 不扩展到港股、A 股、中概特殊结构或非普通上市公司。
- 不让 DossierX 扫描半成品 run 文件并自行推断覆盖状态。
- 不让 CLI 调用 LLM 做发现或判断。

## 核心决策

### 名称

v0 名称为 `Coverage Contract v0`，不再称为通用 quality harness。

原因是第一阶段只锁定资料覆盖感知，不试图同时解决检索质量、事实保鲜和报告表达质量。

### 责任边界

`llm-wiki-invest` 负责回答：

- 本次 run 计划覆盖哪些资料。
- 每个 expected source 是否找到。
- 找不到、跳过或失败的原因是什么。
- 已找到材料的 source id、content hash 和物化路径是什么。
- 当前覆盖状态是否允许下游生成商业报告。

DossierX 负责回答：

- 如何展示 coverage 状态。
- 如何展示缺失材料和补材料入口。
- 如何记录 run bundle 引用。
- 当 `commercialReportAllowed` 为 `false` 时，如何把任务完成为 `incomplete dossier` 状态。
- 何时允许进入商业报告生成链路。

### Contract 版本化

所有给 DossierX 消费的主要 JSON 文件都必须包含 schema version。

最低要求：

- `manifest.schemaVersion`
- `source_inventory.schemaVersion`
- `quality_report.schemaVersion`
- `bundle.schemaVersion`

版本号用于 DossierX 做兼容判断。v0 使用字符串版本，例如 `"coverage-contract/v0"`。

### Bundle 原子化

一次 run 的全部产物必须写入独立 run 目录。

目录：

```text
.llm-wiki-invest/dossier-runs/{runId}/
  bundle.json
  manifest.json
  source_inventory.json
  quality_report.json
  result.json
  unresolved/
```

DossierX 只读取稳定入口。v0 强制 `bundle.json` 作为唯一完成入口和完成标记。其它 JSON 文件必须通过 `bundle.json.files` 引用，DossierX 不直接扫描 run 目录，也不根据目录中文件是否存在推断 run 状态。

引擎应先写临时目录或临时文件，完成所有产物后再发布为可消费 bundle。DossierX 不读取半成品目录。

### Coverage Gate

`quality_report.json` 必须直接表达阻断语义。

最低字段：

```json
{
  "schemaVersion": "coverage-contract/v0",
  "runId": "2026-05-07T02-00-00Z-AAPL",
  "preset": {
    "id": "us-listed-company",
    "version": "coverage-contract/v0"
  },
  "commercialReportAllowed": false,
  "blockingReasons": [
    {
      "code": "missing_required_source",
      "message": "Required source is missing",
      "expectationId": "sec.latest-10-k"
    }
  ],
  "summary": {
    "requiredTotal": 6,
    "requiredFound": 5,
    "requiredMissing": 1,
    "requiredFailed": 0,
    "optionalTotal": 3
  }
}
```

DossierX 不需要根据 inventory 自行推断是否阻断商业报告。它只读取 `commercialReportAllowed` 和 `blockingReasons[]`。

## Source Inventory

`source_inventory.json` 是 v0 的核心产物。它必须列出 preset 中的每个 expected source，并给出稳定状态。

### 状态枚举

每个 expected source 的 `status` 必须是以下值之一：

- `found`：已找到并成功关联到来源材料。
- `missing`：按 preset 应该存在，但未找到。
- `failed`：找到候选材料，但拉取、解析、物化或校验失败。
- `skipped`：本次按明确策略跳过。
- `not_applicable`：该 source 对当前公司或披露周期不适用。

### Reason 要求

`missing`、`failed`、`skipped`、`not_applicable` 都必须同时具备：

- 稳定 `errorCode`，用于 DossierX 的 UI 分支、补材料引导和任务事件归类。
- 面向人展示的 `reason` 或 `message`，用于解释当前状态。

`not_applicable` 必须解释为什么不适用。比如“公司未举办 earnings call”与“系统未找到 transcript”是不同产品含义，不能混为同一种缺失。

### UI 展示字段

每个 required 缺失项必须足够 DossierX 直接展示。

最低字段：

```json
{
  "expectationId": "sec.latest-10-k",
  "label": "Latest annual report on Form 10-K",
  "required": true,
  "authority": "sec",
  "documentType": "10-k",
  "asOf": "2026-05-07",
  "period": "latest-fiscal-year",
  "selectionRule": "latest annual report on Form 10-K for the configured CIK as of the run timestamp",
  "status": "missing",
  "reason": "No 10-K filing was found for the configured company identity",
  "errorCode": "source_missing",
  "manualSupplementAllowed": true
}
```

当 `status` 为 `found` 时，应补充：

```json
{
  "sourceId": "sec:0000320193-25-000008:aapl-20240928.htm",
  "contentHash": "sha256:5f2c7a4b9d8e1a30",
  "sourceDate": "2024-11-01",
  "filingDate": "2024-11-01",
  "materializedPath": "sources/10-k/2024/2024-11-01-0000320193-10-k/00-primary-10-k.md"
}
```

## US Listed Company Preset

`us-listed-company` preset 由 `llm-wiki-invest` 版本化维护。DossierX 可以提供业务权重和验收阈值，但 required/optional 的默认定义由引擎输出。

v0 required sources 建议：

- 最新 Form 10-K。
- 最近至少一份 Form 10-Q，前提是公司处于需要季度披露的周期。
- 最新 proxy statement，例如 DEF 14A。
- 最近重大 8-K 中和 earnings release 相关的主文件或附件。
- 最近 earnings release。
- 最近 earnings call transcript 或明确的 `not_applicable` reason。

v0 optional sources 建议：

- 最新 IR presentation。
- 公司治理文件，例如 bylaws、committee charters、corporate governance guidelines。
- 交易所或公司 profile 资料。

这些条目在实现时应以 preset data 的形式输出到 `manifest.json` 和 `source_inventory.json`，而不是只存在于文档说明中。

对“最新”“最近”这类相对 expectation，preset 输出必须提供机器可审计字段：

- `asOf`：本次 run 判断相对时间的基准。
- `period`：该 expectation 对应的期间，例如 `latest-fiscal-year`、`latest-quarter`、`latest-earnings-event`。
- `selectionRule`：用于选择 source 的稳定规则说明。
- `filingDate` 或 `sourceDate`：当 `status` 为 `found` 时，记录实际命中的披露日期或来源发布日期。

## Bundle 文件

### `bundle.json`

`bundle.json` 是 v0 强制入口文件。

职责：

- 表示 run bundle 已完成写入。
- 指向当前 bundle 内的主要 JSON 文件。
- 提供 schema version、run id、company identity、preset 和完成时间。

示例：

```json
{
  "schemaVersion": "coverage-contract/v0",
  "runId": "2026-05-07T02-00-00Z-AAPL",
  "completedAt": "2026-05-07T02:00:20.000Z",
  "company": {
    "market": "us",
    "ticker": "AAPL",
    "companyName": "Apple Inc.",
    "cik": "0000320193",
    "exchange": "NASDAQ"
  },
  "preset": {
    "id": "us-listed-company",
    "version": "coverage-contract/v0"
  },
  "files": {
    "manifest": "manifest.json",
    "sourceInventory": "source_inventory.json",
    "qualityReport": "quality_report.json",
    "result": "result.json"
  }
}
```

### `manifest.json`

现有 manifest 继续作为执行计划输入，但 v0 需要补充：

- `schemaVersion`
- `preset.id`
- `preset.version`
- `expectations[]`

`materials[]` 继续代表已审定并将被物化的材料；`expectations[]` 代表理论上应覆盖的 source。两者不能混用。

### `result.json`

现有 `created`、`materialized`、`skippedDuplicates`、`unresolved` 保留。

v0 需要补充与 inventory 对齐的 run summary：

- `sourceInventory`
- `qualityReport`
- `commercialReportAllowed`
- `blockingReasons`

## 错误与状态码

v0 至少定义以下 error code：

- `source_missing`
- `source_fetch_failed`
- `source_parse_failed`
- `source_materialize_failed`
- `source_empty_output`
- `source_duplicate_identity`
- `source_sequence_conflict`
- `source_not_applicable`
- `manual_review_required`

错误码必须稳定，DossierX 用于 UI 展示、任务状态和补材料引导。

## DossierX 消费方式

DossierX v0 只作为消费者。

流程：

1. 创建或接收 `llm-wiki-invest` run bundle 引用。
2. 只读取 `bundle.json` 作为完成入口。
3. 读取 `quality_report.json`。
4. 如果 `commercialReportAllowed === false`，DossierX 任务仍以现有任务模型完成为 `task.status = succeeded`，但 `task.result.coverageState = "incomplete"`，并写入 `task.result.commercialReportAllowed = false`、`task.result.blockingReasons[]` 和 `task.result.bundlePath`。
5. 展示 `source_inventory.json` 中的缺失 required sources。
6. 对 `manualSupplementAllowed === true` 的缺失项展示补材料入口。
7. 保存 run id 和 bundle path，供后续 diff、审计和人工复核使用。

DossierX 不扫描 run 目录猜测状态，不根据文件是否存在自行推断资料是否完整。

### DossierX 任务状态语义

DossierX 当前任务状态集合为 `queued | claimed | running | succeeded | failed | cancelled`，没有单独的 `incomplete dossier` task status。因此 v0 不要求 DossierX 新增任务状态。

`incomplete dossier` 是任务结果层状态，而不是任务生命周期状态：

- `task.status = succeeded`：表示 daemon 成功完成了 dossier run 并拿到了可消费 bundle。
- `task.result.coverageState = "complete"`：coverage gate 通过，可以进入商业报告生成链路。
- `task.result.coverageState = "incomplete"`：coverage gate 未通过，任务可展示为已完成的 incomplete dossier，但必须阻断商业报告生成。
- `task.status = failed`：表示 run 未能产出可消费 `bundle.json`，DossierX 无法读取 coverage contract。

### DossierX 结果持久化要求

DossierX 当前 task row 没有持久化 `result` 字段，`CompleteTaskRequest.result` 也只被用于更新 `manifestPath` 等少数字段。Coverage Contract v0 要求 DossierX 在实现消费链路时增加一个稳定结果持久化落点，否则 `coverageState`、`bundlePath`、`commercialReportAllowed` 和 `blockingReasons[]` 会在完成任务后丢失。

推荐实现：

- 给 tasks 表和内存存储的 `TaskRow` 增加 `result` JSON 字段，例如 `tasks.result jsonb` 或 `task_result jsonb`。
- `CompleteTaskRequest.result` 增加 coverage contract 结果字段。
- `completeTask` 将完整 result payload 写入 task row。

最低持久化字段：

```json
{
  "bundlePath": ".llm-wiki-invest/dossier-runs/2026-05-07T02-00-00Z-AAPL/bundle.json",
  "coverageState": "incomplete",
  "commercialReportAllowed": false,
  "blockingReasons": [
    {
      "code": "missing_required_source",
      "message": "Required source is missing",
      "expectationId": "sec.latest-10-k"
    }
  ]
}
```

如果 DossierX 选择不在 task row 上保存 result，则必须在同一实现阶段提供等价的持久化表达，例如 task result 表或 company 层派生字段。但不能只依赖一次性的 task event，因为 task event 不适合作为后续链路的唯一状态来源。

后续可以在 company 层增加派生字段，例如 `company.dossierCoverageState`，用于列表页和公司页快速展示；但它应从持久化 result 或 bundle 派生，不替代 run bundle 本身。

## 数据流

```text
explicit company identity
  -> us-listed-company preset
  -> expected source plan
  -> manifest + expectations
  -> fetch/materialize existing materials
  -> source inventory status resolution
  -> quality report coverage gate
  -> atomic run bundle
  -> DossierX consumes bundle
```

## 与现有代码的关系

现有 `dossier init/apply/status/check` 已经提供基础执行层：

- `dossier init` 接收显式公司身份。
- `dossier apply` 写入 run 目录、`manifest.json` 和 `result.json`。
- `dossier-state.json` 已记录 material identity、content hash 和 checkpoints。
- `dossier check` 已能检查路径、frontmatter 和 sequence 问题。

Coverage Contract v0 应在这些基础上扩展，而不是重写现有执行层。

建议新增或扩展的内部模块：

- coverage preset 定义模块。
- source expectation 与 inventory 类型。
- quality report 生成器。
- atomic bundle writer。
- machine-readable error code 归一层。

## 验收标准

v0 完成后，应满足：

- 每次 dossier run 都产出独立 bundle。
- run 失败或部分失败时仍产出可消费的 `source_inventory.json` 和 `quality_report.json`。
- 每个 required source 都有明确状态。
- `missing`、`failed`、`skipped`、`not_applicable` 都有稳定 `errorCode`，并有面向人展示的 `reason` 或 `message`。
- `not_applicable` 不会被误表示为 `missing`。
- `quality_report.commercialReportAllowed` 直接表达是否允许商业报告生成。
- `quality_report.blockingReasons[]` 足够 DossierX 展示阻断原因。
- `bundle.json` 是唯一完成入口；DossierX 可以只读取 `bundle.json`，不扫描半成品文件。
- DossierX 可在 `task.status = succeeded` 的同时通过 `task.result.coverageState = "incomplete"` 表达“任务完成但不可生成商业报告”。
- 已物化材料能通过 source id 和 content hash 回溯。
- 相对 expectation 有 `asOf`、`period`、`selectionRule` 和命中时的 `filingDate` 或 `sourceDate`，便于审计“latest/recent”是否真实满足。
- 文档变更不需要单元测试；后续实现代码时需要为契约、状态和 gate 补测试。

## 后续扩展点

Coverage Contract v0 稳定后，再扩展：

- retrieval golden set 和 citation integrity gate。
- fact ledger 与事实保鲜状态。
- 新旧 bundle diff。
- 港股、A 股和中概公司 preset。
- 用户补材料后的 source inventory 修正流程。
- DossierX 任务系统中的人工复核和补材料闭环。

## 待确认事项

该 spec 当前只等待用户审阅是否接受 v0 边界。实现阶段不再重新讨论以下已确认方向：

- v0 先打穿 `us-listed-company`。
- v0 第一优先级是 coverage contract。
- DossierX v0 只消费 bundle，不自己实现资料完整性判断。
- coverage gate 失败时阻断商业报告生成。
