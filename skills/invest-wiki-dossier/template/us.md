---
template: us-listed-company-dossier
market: us
version: 2
scope: file-level-official-materials
---

# 美国上市公司 dossier 模板

## 适用范围

- 只用于单家美国上市公司 dossier
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

## 来源边界

### 允许的 discovery surface

- SEC submissions、Atom feed、filing detail 页面
- 交易所官方公司资料页
- 公司 IR、newsroom、governance、annual meeting、events 页面

这些页面默认只用于发现文件链接，不直接进入 dossier。

### 明确排除

- 第三方新闻、媒体、博客、论坛、百科、数据库
- 非公司控制的镜像站、转载站、聚合站
- 普通介绍页、导航页、目录页、FAQ 页
- newsroom 列表页、IR 首页、下载中心索引页本身

### 可直接进入 dossier 的 HTML 页面

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

目录固定为：

`dossier/{document_type}/{year}/{disclosure_key}/`

文件名固定为：

`{sequence}-{suggestedFilename}.md`

规则：

- `sequence` 使用两位数字，从 `00` 开始
- 同一次披露下，同一种 `document_type` 的文件共享同一个 `disclosure_key`
- `sequence` 在同一个 `{document_type}/{disclosure_key}` 目录内必须唯一
- 季度或年度财务报表附件不要误归为 `10-q` / `10-k`

当两个官方来源发布了实质等价的同一份材料时：

- 可以同时保留，不要强行二选一
- 尽量共享同一个 `disclosure_key`
- 使用各自真实的 `authority`
- 若语义相同，使用同一个 `document_type`
- `sequence` 必须不同，通常把更接近 canonical 页面者排在更前

## frontmatter 最小字段

每个 dossier 文件必须包含：

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
- `published` 是官方发布日期
- `created` 是本地物化日期

## 去重规则

- SEC 材料身份：`accession_no` + `primary_document`
- 非 SEC 文件级材料身份：`canonical_url` + `published`

同一个 `document_type` 不代表同一份材料；重复抓到同一材料时应跳过，不重复落盘。

## unresolved 条件

以下情况进入 unresolved：

- 文件格式无法稳定转换
- 无法确认是否为官方材料
- 无法确定 `document_type`
- 无法确定 `published`
- 无法确定 `disclosure_key`
- 物化后正文主体仍主要是导航、脚本、XBRL 噪音或不可读元数据
