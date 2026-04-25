---
template: us-listed-company-dossier
market: us
version: 2
scope: file-level-official-materials
---

# 美国上市公司建档模板

## 适用范围

- 只用于单家美国上市公司官方来源建档
- 只收文件级官方材料
- `authority` 仅允许：`sec`、`nasdaq`、`nyse`、`company`

## 公司身份解析

至少确认以下字段：

- `company_name`
- `ticker`
- `cik`
- `exchange`

优先官方来源：

1. SEC `submissions/CIK##########.json`
2. 交易所公司资料页
3. 公司 IR 首页

`ticker / company_name / exchange` 至少通过两个官方入口交叉验证。

美国公司建议优先使用：

```bash
llm-wiki-invest dossier fetch-sec-submissions --cik 0000320193 --recent --forms "10-K,10-Q,8-K,DEF 14A"
```

## 增量建档策略

### SEC 增量

- 使用 `fetch-sec-submissions --recent` 获取最近 filings 摘要。
- 优先从 `checkpoints.sec.latestSecFilingDateByDocumentType` 之后的 filing 开始评估；如果 checkpoint 缺失，再回看最近若干期。
- 只评估最近出现的 `10-K`、`10-Q`、`8-K`、`DEF 14A` 等目标表单。
- 用 `accession_no + primary_document` 判断材料身份。
- 已经存在于 dossier state 的 filing 不进入 reviewed manifest，除非 primary document 明确不同。

### 公司官网 / IR 增量

- 优先从 `checkpoints.company.latestPublishedByDocumentType` 之后的材料开始评估；如果 checkpoint 缺失，从最新列表向后检查。
- 只检查最新季度、最新年度、最新 events / presentations、最新 annual meeting 或 governance 文件。
- 对时间序列页面，从最新项向后检查；一旦连续命中已存在披露，可停止继续向历史翻页。
- 用 `canonical_url + published` 判断材料身份。
- 同一 URL 但正文疑似变化、且无法确认新的 `published` 时，进入 unresolved，不覆盖旧 source。
- 下载中心、IR 首页、newsroom 列表页只作为发现入口，不落盘。

### Governance 增量

- 优先参考 `checkpoints.governance.latestPublishedByDocumentType`。
- governance 文件通常低频变化，只检查 canonical 文件列表和发布日期。
- 如果文件 URL、标题、发布日期均未变，跳过。
- 如果公司替换了同一政策文件但没有稳定发布日期，进入 unresolved，并说明需要人工确认版本边界。

## 来源边界

### 允许的 discovery surface

- SEC submissions、Atom feed、filing detail 页面
- 交易所官方公司资料页
- 公司 IR、newsroom、governance、annual meeting、events 页面

这些页面默认只用于发现文件链接，不直接进入 sources。

### 明确排除

- 第三方新闻、媒体、博客、论坛、百科、数据库
- 非公司控制的镜像站、转载站、聚合站
- 普通介绍页、导航页、目录页、FAQ 页
- newsroom 列表页、IR 首页、下载中心索引页本身

### 可直接进入 sources 的 HTML 页面

只有同时满足以下条件才允许直接落盘：

- 页面本身就是正式文件载体，不是列表页或导航页
- URL 稳定，可作为该次披露的 canonical 页面
- 页面正文包含完整正式内容，不是“摘要 + 下载链接”的壳页面
- 去掉页眉、页脚、导航后，仍是一份可读的独立文件

典型允许：

- SEC filing primary document HTML
- 公司 Newsroom 中承载完整 earnings release 正文的发布页
- 公司治理页面中承载完整章程或政策正文的 canonical 页面

## 可收官方材料

### `sec`

- `10-K` / `10-Q` / `8-K`
- `20-F` / `6-K`
- `DEF 14A`
- `SC 13D` / `SC 13D/A`
- `SC 13G` / `SC 13G/A`
- `3` / `4` / `5`

对 SEC 材料，优先保留 `filing date`、`accession number`、`primary document`、`document URL`，以及可得的 `filing detail URL`。

### `company`

- earnings release
- financial statements 附件
- earnings / investor presentation
- shareholder letter
- company-hosted transcript
- annual report PDF
- governance documents
- annual meeting 正式附件

### `nasdaq` / `nyse`

只接收交易所官方直接提供的文件级材料；普通资料页本身不进入 dossier。

## `document_type` 定义

- `10-k`：SEC Form 10-K 年度报告正文。
- `10-q`：SEC Form 10-Q 季度报告正文。
- `8-k`：SEC Form 8-K 当前报告正文。
- `20-f`：SEC Form 20-F 年度报告正文，通常用于外国发行人。
- `6-k`：SEC Form 6-K 临时报告正文，通常用于外国发行人。
- `proxy-statement`：正式股东大会委托投票说明书，如 DEF 14A。
- `earnings-release`：季度或年度业绩发布正文，包括公司发布页或 SEC `EX-99.1` 业绩新闻稿。
- `financial-statements`：业绩发布包中的财务报表附件；不是 `10-q` / `10-k` 本体。
- `investor-presentation`：面向投资者的结果说明 deck、earnings presentation、investor presentation。
- `transcript`：公司自有、公司控制渠道发布的电话会或业绩会逐字稿。
- `annual-report`：公司发布的年报 PDF 或年报册页，但不是 SEC `10-K` primary document 本体。
- `listing-notice`：交易所发布的上市、停牌、恢复交易等正式通知文件。
- `governance-document`：章程、bylaws、committee charter、code of conduct 等治理文件。
- `other-official-filing`：确认为官方文件，但暂不适合归入以上明确类型的材料。

无法稳定归类时，进入 unresolved，不要硬猜。

## 归档规则

当两个官方来源发布了实质等价的同一份材料时：

- 可以同时保留，不要强行二选一
- 尽量共享同一个 `disclosure_key`
- 使用各自真实的 `authority`
- 若语义相同，使用同一个 `document_type`
- `sequence` 必须不同，通常把更接近 canonical 页面者排在更前

## 去重规则

- SEC 材料身份：`accession_no` + `primary_document`

同一个 SEC accession 下可能有多个 primary document；不要只按 accession number 去重。

## unresolved 条件

以下美国市场常见情况应作为 unresolved candidate 报告，除非 `dossier apply` 已经生成 CLI unresolved 文件：

- 无法确认 SEC primary document。
- SEC HTML 物化后主体主要是 XBRL 噪音或不可读元数据。
- 公司替换 governance PDF 但没有稳定版本日期。
- 公司 IR 页面只有摘要或下载壳，无法确认正式文件 URL。
