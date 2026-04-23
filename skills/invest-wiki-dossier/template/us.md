---
template: us-listed-company-dossier
market: us
version: 1
scope: file-level-official-materials
---

# 美国上市公司 dossier 模板

这个模板用于为**单家美国上市公司**建立 dossier。目标不是写投资结论，而是把该公司所有**文件级官方材料**按统一规则发现、登记、归类、物化为只读 Markdown，供后续分析层复用。

## 输入参数

- `ticker`: 股票代码，必填
- `company_name`: 公司法定名称，优先从官方来源确认
- `cik`: SEC Central Index Key；未知时必须先解析
- `exchange`: `NASDAQ` / `NYSE` / `NYSE American` / `OTC` / 其他
- `as_of_date`: 建档基准日期，默认今天

## 总原则

1. dossier 只收**文件级官方材料**，不收普通 HTML 页面本身。
2. 官网、IR、newsroom、governance 页面默认只作为**发现文件链接的入口**；只有满足“canonical document page”条件的正式发布页，才允许作为 dossier 材料落盘。
3. 进入 dossier 的材料必须来自以下 authority：
   - `sec`
   - `nasdaq`
   - `nyse`
   - `company`
4. dossier 落盘的是通过 `markitdown` 物化出的**Markdown 派生件**，不是原始 PDF/HTML/XBRL 文件。
5. 一份材料对应一个 `.md` 文件；同一次披露下，只有**同一种 `document_type`** 的多个文件才放到同一个 disclosure 目录。
6. 所有 dossier 文件都必须带 YAML frontmatter，保留原始 URL 和发布日期。
7. 发现不了、分类不稳、格式不支持、或物化后正文质量明显不可读时，进入 unresolved，不要猜。

## 明确排除

- 第三方新闻、媒体报道、博客、论坛、百科
- 第三方 transcript、第三方 recap、第三方数据库
- 非公司控制的镜像站、转载站、聚合站
- 任何没有明确权威来源或控制权的链接
- 公司官网中的普通介绍页、导航页、目录页本身
- 纯导航性的 newsroom 列表页、IR 首页、下载中心索引页、FAQ 页

## 公司身份解析

先确认以下字段：

- `company_name`
- `ticker`
- `cik`
- `exchange`

优先来源：

1. SEC `submissions/CIK##########.json`
2. 交易所公司资料页
3. 公司 IR 首页

必须至少通过两个官方入口交叉验证 `ticker / company_name / exchange`。

建议优先使用：

```bash
llm-wiki-invest dossier fetch-sec-submissions --cik 0000320193 --recent --forms "10-K,10-Q,8-K,DEF 14A"
```

它可作为 SEC 官方抓取辅助，快速确认最近 filings 和基础身份字段。

## 允许的 discovery surface

- SEC 公司提交索引与 filing detail 页面
- 交易所官方公司资料页
- 公司 IR 首页与文档下载页
- 公司 newsroom / press release 列表页
- 公司 governance / filings / annual meeting / events 页面

这些页面的作用是**发现文件链接**，不是作为 dossier 材料落盘。

## 允许直接进入 dossier 的 HTML 页面

只有同时满足下面条件的 HTML 页面，才允许直接进入 dossier：

- 页面本身就是公司或监管机构发布的正式文件载体，而不是列表页或导航页
- 页面 URL 稳定、可复用，且能代表该次披露的 canonical 文档页面
- 页面正文包含完整正式内容，而不是“摘要 + 下载链接”的壳页面
- 页面脱离导航、页眉、页脚后，仍能形成一份可读的独立文件

典型允许示例：

- SEC filing primary document HTML
- 公司 Newsroom 中承载完整 earnings release 正文的发布页
- 公司治理页面中承载完整章程或政策正文的 canonical 页面

典型不允许示例：

- Press Releases 列表页
- Investor Relations 首页
- 下载中心索引页
- 只提供摘要和若干附件链接的目录页

## 允许进入 dossier 的文件类型

### `sec`

- `https://data.sec.gov/submissions/CIK##########.json`
- `10-K`
- `10-Q`
- `8-K`
- `20-F`
- `6-K`
- `DEF 14A`
- `SC 13D` / `SC 13D/A`
- `SC 13G` / `SC 13G/A`
- `3` / `4` / `5`

对 SEC 材料，优先保留：
- filing date
- accession number
- primary document
- document URL
- filing detail URL（如可得）

### `company`

公司控制的文件级材料可包括：

- earnings release
- earnings presentation
- investor presentation / deck
- shareholder letter
- annual report PDF
- company-hosted transcript
- governance documents PDF
- charter / bylaws / code of conduct PDF
- annual meeting 相关正式附件

### `nasdaq` / `nyse`

只接收交易所官方直接提供的文件级材料。普通资料页本身不进入 dossier。

## `document_type` 归类

优先使用以下类型：

- `10-k`：SEC Form 10-K 年度报告正文。
- `10-q`：SEC Form 10-Q 季度报告正文。
- `8-k`：SEC Form 8-K 当前报告正文。
- `20-f`：SEC Form 20-F 年度报告正文，通常用于外国发行人。
- `6-k`：SEC Form 6-K 临时报告正文，通常用于外国发行人。
- `proxy-statement`：正式股东大会委托投票说明书，如 DEF 14A。
- `earnings-release`：季度或年度业绩发布正文，包括公司发布页或 SEC `EX-99.1` 这类业绩新闻稿。
- `financial-statements`：业绩发布包中的财务报表附件，如 consolidated financial statements PDF；不是 10-Q / 10-K 本体。
- `investor-presentation`：面向投资者的结果说明 deck、earnings presentation、investor presentation。
- `transcript`：公司自有、公司控制渠道发布的电话会或业绩会逐字稿。
- `annual-report`：公司发布的年报 PDF 或年报册页，但不是 SEC 10-K primary document 本体。
- `listing-notice`：交易所发布的上市、停牌、恢复交易等正式通知文件。
- `governance-document`：章程、bylaws、committee charter、code of conduct 等治理文件。
- `other-official-filing`：确认为官方文件，但暂不适合归入上面任一明确类型的材料。

如果无法稳定归类，不要硬猜，进入 unresolved。

## 目录与命名

根路径固定为：

`dossier/{document_type}/{year}/{disclosure_key}/`

文件名固定为：

`{sequence}-{suggestedFilename}.md`

其中：

- `sequence` 使用两位数字，从 `00` 开始
- `disclosure_key` 代表一次披露事件
- 同一次披露下的同类型文件必须共享同一个 `disclosure_key`
- `sequence` 在同一个 `{document_type}/{disclosure_key}` 目录内必须唯一，不允许重复编号

示例：

```text
dossier/8-k/2026/2026-02-01-0000320193-8-k/
  00-primary-8-k.md
  01-ex99-1-press-release.md
  02-ex99-2-presentation.md
```

## frontmatter 最小字段

每个 dossier 文件都必须包含：

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

要求：

- `author` 使用 Obsidian 风格值，例如 `[[sec.gov]]`
- `source` 保留原始材料 URL
- `published` 是材料官方发布日期
- `created` 是本地物化日期

## 去重规则

### SEC

同一材料身份由以下字段确定：

- `accession_no`
- `primary_document`

### 非 SEC 文件级材料

同一材料身份由以下字段确定：

- `canonical_url`
- `published`

说明：

- 同一个 `document_type` 不代表同一份材料
- 两份不同发布日期的 `10-K` 是两份不同材料
- 再次抓到同一材料时，应避免重复落盘

## 等价官方材料处理

当两个官方来源发布了**实质等价**的同一份材料时，按下面规则处理：

- 如果两者都属于独立官方载体，可以同时保留，不要强行二选一
- 两者应尽量共享同一个 `disclosure_key`
- 两者应使用各自真实的 `authority`
- 如果语义上属于同一类材料，应使用同一个 `document_type`
- `sequence` 必须不同，通常把更接近 canonical document page 的材料排在更前面

例子：

- 公司 Newsroom earnings release 页面
- 同次 8-K 中的 `EX-99.1` earnings release

这两份都可以保留，但要分别记录来源，不要伪装成单一材料。

## reviewed manifest 要求

在调用 CLI 前，你必须先产出 reviewed manifest。每个 material 至少包含：

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

额外要求：

- `sequence` 必须在目标 disclosure 目录内唯一
- 季度或年度财务报表附件不要误归为 `10-q` / `10-k`
- 只有满足 “允许直接进入 dossier 的 HTML 页面” 规则的 HTML 页面才可直接落盘

## CLI 调用顺序

1. 初始化 dossier：

```bash
llm-wiki-invest dossier init --market us --ticker AAPL --company-name "Apple Inc." --cik 0000320193 --exchange NASDAQ
```

2. 生成 reviewed manifest（由你完成，不是 CLI 负责 discover）
3. 落盘：

```bash
llm-wiki-invest dossier apply manifest.json
```

4. 检查结果：

```bash
llm-wiki-invest dossier status
llm-wiki-invest dossier check
```

## unresolved 规则

以下情况进入 unresolved，而不是硬落盘：

- 文件格式无法稳定转换
- 无法确定 `document_type`
- 无法确定 `published`
- 无法判断是否为官方材料
- 无法确定该文件属于哪个 `disclosure_key`
- materialize 后正文主体仍然主要是导航、脚本、XBRL 噪音或不可读元数据

## 完整性检查

完成后至少检查：

- 是否已确认 `ticker / company_name / cik / exchange`
- 是否已覆盖 SEC 定期与事件型披露
- 是否已覆盖公司控制的财报发布、deck、transcript、治理附件
- 是否所有 dossier 文件都符合目录与 frontmatter 规范
- 是否存在 unresolved 待处理项
