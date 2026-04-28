# Listed Company Ingest Plan Template

用于每日维护 workflow：根据 dossier run 的 `result.json`，把本次新增或变化的上市公司 sources 组织成可执行 ingest 计划。

## 输入

- `result.json.created`：本次 dossier apply 新建的 source 路径。
- `result.json.skippedDuplicates`：本次去重跳过的材料，默认不 ingest。
- `result.json.unresolved`：本次未能稳定处理的材料，只记录为问题，不猜测补齐。
- `wiki-schema.md`：目标 wiki 页面类型、命名、正文结构和引用规则。
- `wiki-agent.md`：本 vault 的 MUST / MAY / NEVER 写入标准。

## 增量过滤

如果本次 dossier 是 no-op，没有 `result.json` 或 `result.json.created` 为空，则不生成 ingest plan。

先运行：

```bash
llm-wiki-invest sources pending .llm-wiki-invest/dossier-runs/<run-id> --json
```

只规划状态为 `new` 的 source。`clean` source 不进入计划。

## Batch 原则

- batch 由 agent 判断，不由 `disclosure_key` 或 `document_type` 硬编码决定。
- 优先把“同一披露周期、同一主题、会更新同一批 wiki 页面”的 sources 放入同一 batch。
- 如果多个 sources 会写入不同页面簇，拆成多个 batch。
- 如果一个 source 会影响多个长期主题页，仍以 source 为最小执行单元；在该 source 的 planned changes 中列出全部目标页面。
- 同一 batch 内的 sources 可以串行 ingest；只有目标页面互不冲突时才适合并行。

## 页面选择原则

- 目标页面由 `wiki-schema.md` 的页面类型决定。
- `document_type`、披露日期、标题和正文都是弱信号，只辅助判断，不做硬路由。
- 每个 planned wiki change 都要说明来源依据和写入理由。
- 不为没有稳定事实增量的 source 创建页面。
- 不把 source 摘要机械写成 wiki；wiki 只吸收对长期理解有用的事实、状态变化和可追溯判断。
- 每个 planned wiki change 都要标出要写入的 `证据台账`、`变化记录` / `相比上期变化`、`判断层信号`。
- `判断层信号` 只描述对 Right Business / Right People / Right Price 的潜在影响，不写最终投资判断。

## 输出格式

```md
# Ingest Plan — <run-id>

## Sources
- [ ] sources/.../file-a.md — new；一句说明

## Batches

### Batch 1 — <主题或披露周期>

#### Sources
- sources/.../file-a.md

#### Planned Wiki Changes
- create/update `wiki/<page>.md` — 为什么这个 source 会影响该页面；计划新增哪些 evidence / delta / signals

#### Rationale
- 为什么这些 sources 应该一起处理
- 主要引用哪些事实
- 哪些事实是稳定证据，哪些只是待验证信号
- 是否存在冲突、缺口或需要人工判断的问题

#### Execution Result
- pending

## Skipped
- clean sources
- duplicates
- unresolved
```

## 执行后回填

每个 batch 执行后，把 `Execution Result` 改为：

- created pages
- updated pages
- skipped sources and reason
- source frontmatter 的 `ingested` / `wiki_pages` 更新
- 写入的 evidence / delta / signals 摘要
- unresolved questions
