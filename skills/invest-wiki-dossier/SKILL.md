---
name: invest-wiki-dossier
description: Use when maintaining official file-level sources for one listed company in an LLM Wiki Invest vault, including initial dossier creation, incremental official disclosures, SEC/IR/exchange materials, and reviewed manifest application.
---

# Invest Wiki Dossier

为单家上市公司维护 `sources/` 事实层。你的产物是官方文件级材料的 Markdown 派生件，不是分析、总结或 wiki 页面。

## 不变量

- `sources/` 是长期事实层；只写官方或监管/交易所控制的文件级材料。
- 默认执行增量维护；只有首次建档、补历史缺口或用户明确要求 backfill 时才扩大范围。
- 不直接手工改写已落盘 source 正文；材料下载、转换、去重、状态更新交给 `llm-wiki-invest dossier` CLI。
- 不把推断写入 source frontmatter 或正文；无法确认就进入 unresolved。

## 可执行的 CLI 工具

- `dossier init` 初始化状态。
- `dossier refresh-state` 从已追踪 source 回填旧 state 的材料元数据和 checkpoints。
- `dossier fetch-sec-submissions` 抓取 SEC submissions 辅助信息。
- `dossier apply` 下载、markitdown 转换、落盘、去重、写 run record。
- `dossier status` / `dossier check` 做结果检查。

## 市场模板

根据输入信息，先确定市场，再读取对应模板。

- 美国上市公司：读取 `template/us.md`。
- 没有对应模板的市场：停止，说明当前 skill 不支持该市场，不要临时发明规则。

模板负责市场细则；本文件负责通用执行顺序。

## 状态读取

每次开始先读取 `.llm-wiki-invest/dossier-state.json`。

- 不存在：按首次建档处理，先确认公司身份，再运行 `llm-wiki-invest dossier init --market ... --ticker ... --company-name ... [--cik ...] [--exchange ...]`。
- 已存在：以 state 中的 `ticker`、`companyName`、`cik`、`exchange` 为准；如果用户输入冲突，先停止说明冲突。
- 旧 state 有 `materials` 但缺少材料元数据或 `checkpoints`：先运行 `llm-wiki-invest dossier refresh-state`。
- `materials` 是已建档材料身份表；用于判断具体材料是否已追踪。
- `checkpoints` 只用于缩小 discovery 窗口；不能单独作为跳过材料的依据。

## 增量策略

增量维护只检查最近可能新增或变化的官方材料。

- SEC 材料身份：`accession_no + primary_document`。
- 非 SEC 材料身份：`canonical_url + published`。
- 已存在且内容未变的材料不要主动加入 manifest；即使误加入，CLI 也会按 state 去重。
- 同一 canonical URL 疑似变化但无法确认新的 `published`：进入 unresolved，不覆盖旧 source。
- 连续命中已存在历史材料时，可以停止向更早历史翻页。
- 没有新增或明确变化候选时，输出 no-op，不生成空 manifest，不调用 `dossier apply`。

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

## Apply 与检查

有 manifest 时执行：

```bash
llm-wiki-invest dossier apply <manifest.json> --run-id <YYYY-MM-DD-ticker-purpose>
llm-wiki-invest dossier status
llm-wiki-invest dossier check
```

然后读取 `.llm-wiki-invest/dossier-runs/<run-id>/result.json`：

- `created` 是本次新增 source，供上层 flow 或 ingest 使用。
- `skippedDuplicates` 是已存在且内容未变的材料。
- `unresolved` 需要人工或后续规则处理。

同时查看同目录 `report.md`。如果有 unresolved，再查看 run 内 `unresolved/` 和全局 `.llm-wiki-invest/dossier-unresolved/`。

## 输出格式

no-op 时只报告：

- 检查了哪些官方 surface。
- 依据哪些 state checkpoints 或材料身份判断无新增。
- 是否存在需要人工确认的 unresolved 线索。

apply 后只报告：

- run id 和 run 目录。
- created / skipped / unresolved 数量。
- created source 路径。
- unresolved 的具体原因。

不要输出长篇抓取过程，不要写投资判断。
