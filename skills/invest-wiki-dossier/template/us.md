---
template: us-listed-company-dossier
market: us
version: 4
scope: file-level-official-materials
---

# 美国上市公司建档模板

## 来源边界

本模板用于单家美国上市公司 `sources/` 事实层建档，只收官方文件级材料，不产出分析结论，不写 `wiki/`。

| authority | 含义 | 可收材料 |
| --- | --- | --- |
| `sec` | 美国 SEC 官方披露系统 | 10-K、10-Q、8-K、DEF 14A、Form 4、13D/G、prospectus、material exhibits |
| `company` | 公司控制的官方渠道 | IR、newsroom、financial results、events、presentations、governance、annual meeting 文件 |
| `nasdaq` | Nasdaq 官方来源 | 上市、停牌、退市、合规等正式通知 |
| `nyse` | NYSE 官方来源 | 上市、停牌、退市、合规等正式通知 |

只收正式文件或完整披露正文。SEC submissions、filing detail、交易所公司页、公司 IR 首页、newsroom、下载中心、events 列表页只作为 discovery surface，不直接进入 `sources/`。

排除第三方新闻、媒体、博客、论坛、百科、数据库、镜像站、转载站、普通介绍页、产品页、FAQ 页、列表页、导航页、只有摘要和下载链接的壳页面。

HTML 页面只有同时满足以下条件才可直接落盘：页面本身是正式文件载体；URL 稳定；正文包含完整正式内容；去掉页眉、页脚、导航后仍是可读独立文件。

## 公司身份解析

至少确认 `company_name`、`ticker`、`cik`、`exchange`。优先使用 SEC `submissions/CIK##########.json`、交易所公司资料页、公司 IR 首页；`ticker`、`company_name`、`exchange` 至少通过两个官方入口交叉验证。

首次建档先抓完整 SEC submissions JSON，再按覆盖矩阵筛选 filings：

```bash
llm-wiki-invest dossier fetch-sec-submissions --cik 0000320193
```

增量维护或快速筛选时使用 `--recent`，forms 按本模板覆盖矩阵选择。

## 建档覆盖原则

- 从最新材料向历史回看，先满足覆盖数量，再补关键历史事件。
- 覆盖矩阵是最低基线；公司历史短于基线时，记录已公开的全部历史。
- 成熟大型公司不追求全量历史归档；近期上市、重组、分拆、并购驱动或周期性公司，可按条件覆盖延长回看。
- 官方材料缺失、URL 失效、日期无法确认或材料身份不稳定时，进入 unresolved，不用第三方材料补洞。

## 核心覆盖矩阵

| 材料 | authority | document_type | 首次建档覆盖 | 增量窗口 | 准入说明 |
| --- | --- | --- | --- | --- | --- |
| Form 10-K | `sec` | `10-k` | 最近 5 个 fiscal years | 最新未建档 filing 起 | 年度业务、风险、MD&A、财务报表核心来源。 |
| Form 10-Q | `sec` | `10-q` | 最近 8-12 个 quarters | 最新未建档 filing 起 | 最近经营、分部、风险和现金流变化。 |
| DEF 14A | `sec` | `proxy-statement` | 最近 5 个 annual meetings | 最新 annual meeting 起 | 治理、薪酬、董事、股权结构核心来源。 |
| 业绩 8-K | `sec` | `8-k` | 最近 8-12 个 quarters 的 Item 2.02 | 最新未建档 Item 2.02 起 | 8-K 主文；附件按实际内容另分类型。 |
| Earnings release | `company` 或 `sec` | `earnings-release` | 最近 8-12 个 quarters | 最新 published 起 | 公司发布页或 SEC `EX-99.1`，可与 8-K 并存。 |
| 财务报表附件 | `company` 或 `sec` | `financial-statements` | 最近 8-12 个 quarters，如单独发布 | 最新 published 起 | 业绩包中的独立报表附件，不是 10-Q / 10-K 本体。 |
| 投资者演示 | `company` 或 `sec` | `investor-presentation` | 最近 8-12 个 quarters，如稳定发布 | 最新 published 起 | Earnings deck、results presentation、IR deck。 |
| Annual report PDF | `company` | `annual-report` | 最近 5 年，如与 10-K 不完全等价 | 最新 published 起 | 公司设计版年报可与 SEC 10-K 并存。 |
| 股东信 | `company` | `shareholder-letter` | 最近 5 年，如单独发布 | 最新 published 起 | 只收公司正式发布的完整股东信。 |
| 公司自有 transcript | `company` | `transcript` | 最近 8-12 个 quarters，如公司自有渠道发布 | 最新 published 起 | 第三方 transcript 排除。 |
| Governance 文件 | `company` 或 `sec` | `governance-document` | 最新有效版本 | canonical 文件列表变化起 | Certificate、bylaws、charter、code、governance guidelines。 |
| 年会投票结果 8-K | `sec` | `8-k` | 最近 5 个 annual meetings 的 Item 5.07 | 最新未建档 Item 5.07 起 | 用于补充 proxy 后的实际投票结果。 |

## 条件覆盖矩阵

| 触发条件 | authority | document_type | 覆盖范围 | 准入说明 |
| --- | --- | --- | --- | --- |
| 近 10 年 IPO、直接上市、SPAC 或重大上市结构变化 | `sec` | `ipo-prospectus` | S-1 / F-1 / 424B4 等关键版本 | 对公司起点、商业模式或股权结构仍有解释价值时收。 |
| 重大并购、分拆、重组、反向合并 | `sec` 或 `company` | `transaction-filing` | 关键 S-4、10-12B、8-K、proxy、交易文件 | 以完成、分拆生效、重大资产买卖为准，不收传闻。 |
| 重大协议、协议终止、重大融资 | `sec` | `material-agreement` / `securities-offering` | 最近 3-5 年 | 只收对业务、融资、供应、客户、授权或资本结构重要的正式文件。 |
| 管理层、董事、控制权重大变化 | `sec` | `8-k` | 最近 5 年 Item 5.02 / 5.01 | CEO、CFO、COO、CAO、董事长、关键董事优先。 |
| 审计师、财报不可依赖、重大减值或重组 | `sec` | `8-k` | 最近 5 年 Item 4.01 / 4.02 / 2.05 / 2.06 | 会计质量、治理风险、战略调整信号。 |
| 资本配置重大事项 | `company` 或 `sec` | `capital-allocation-release` | 最近 5 年 | 回购授权、重大派息政策、资本返回框架。 |
| 投资者日 / Capital Markets Day | `company` 或 `sec` | `capital-markets-day` | 最近 5-10 年 | 只收完整材料包或核心 deck。 |
| 重要持股和董监高交易 | `sec` | `ownership-filing` / `insider-transaction` | 当前有效、最近 1-3 年重大变化 | 13D/G、Form 3/4/5；不全量收普通机构持仓噪音。 |
| ESG / sustainability 报告 | `company` | `sustainability-report` | 最近 3 年 | 只收公司正式报告，不收营销页。 |
| 交易所正式通知 | `nasdaq` 或 `nyse` | `listing-notice` | 仅重大事件 | 上市、转板、停牌、退市、恢复交易、合规通知。 |

## 8-K Item 筛选规则

不要全量抓取 8-K。按 item 和附件判断投资研究价值。

| 优先级 | Item | 规则 |
| --- | --- | --- |
| 优先收 | `2.02` | Results of Operations and Financial Condition，业绩发布相关 8-K。 |
| 优先收 | `5.02` | 董事、高管和薪酬安排变化。 |
| 优先收 | `5.07` | 股东投票结果。 |
| 优先收 | `9.01` | 只在附件本身是正式文件时收对应附件。 |
| 条件收 | `1.01` / `1.02` / `2.01` / `2.03` / `2.04` | 重大协议、交易、债务、违约。 |
| 条件收 | `2.05` / `2.06` / `3.01` / `4.01` / `4.02` | 重组、减值、交易所合规、审计师、财报不可依赖。 |
| 条件收 | `5.01` / `5.03` / `7.01` / `8.01` | 控制权、章程、Reg FD、Other Events；只有承载重大正式材料时收。 |

## `document_type` 定义

| document_type | 定义 |
| --- | --- |
| `10-k` | SEC Form 10-K 年度报告正文。 |
| `10-q` | SEC Form 10-Q 季度报告正文。 |
| `8-k` | SEC Form 8-K 当前报告正文。 |
| `20-f` | SEC Form 20-F 年度报告正文，通常用于外国发行人。 |
| `6-k` | SEC Form 6-K 临时报告正文，通常用于外国发行人。 |
| `proxy-statement` | 正式股东大会委托投票说明书，如 DEF 14A。 |
| `earnings-release` | 季度或年度业绩发布正文。 |
| `financial-statements` | 业绩发布包中的独立财务报表附件，不是 10-Q / 10-K 本体。 |
| `investor-presentation` | Earnings deck、results presentation、IR deck。 |
| `annual-report` | 公司发布的年报 PDF 或年报册页，不是 SEC 10-K primary document 本体。 |
| `shareholder-letter` | 公司正式发布的股东信。 |
| `transcript` | 公司自有、公司控制渠道发布的电话会或业绩会逐字稿。 |
| `governance-document` | Certificate、bylaws、committee charter、code of conduct、governance guidelines 等治理文件。 |
| `capital-markets-day` | 投资者日、资本市场日等完整正式材料包。 |
| `ipo-prospectus` | IPO、直接上市、SPAC 上市相关核心招股书或最终 prospectus。 |
| `transaction-filing` | 重大并购、分拆、重组、反向合并相关正式交易文件。 |
| `material-agreement` | 对业务、融资、供应、客户、授权或资本结构重要的正式协议。 |
| `securities-offering` | 重大证券发行相关 prospectus、supplement、indenture、purchase agreement 等文件。 |
| `capital-allocation-release` | 回购、分红、资本返回框架等资本配置正式公告。 |
| `ownership-filing` | SC 13D / 13G 及 amendment 等重要持股披露。 |
| `insider-transaction` | Form 3 / 4 / 5 董监高或 10% holder 交易披露。 |
| `sustainability-report` | 公司正式 ESG、sustainability、impact 或 climate 报告。 |
| `listing-notice` | 交易所上市、转板、停牌、退市、恢复交易或合规通知。 |
| `other-official-filing` | 确认为官方文件，但暂不适合归入以上明确类型的材料。 |

无法稳定归类时，进入 unresolved，不要硬猜。

## 材料身份、去重和归档键

- SEC 材料身份：`accession_no + primary_document`。
- 公司材料身份：`canonical_url + published + document_type`。
- Governance 材料身份：`canonical_url + title + published/version`；版本不稳时进入 unresolved。
- 交易所材料身份：`canonical_url + published + title`。
- 同一个 SEC accession 下可能有多个正式文件；不要只按 accession number 去重。
- 同一官方披露下，不同文件可以共用 `disclosure_key`；同一 `document_type` 下有多个文件时，用不同 `sequence` 区分。
- 实质等价但来自不同官方来源的材料可以同时保留，使用各自真实 `authority`。
- `disclosure_key` 优先用报告期、事件日期或会议日期；没有明确事件日期时用 `published`。
- `disclosure_key` 使用小写 kebab-case，例如 `2026-q1-results`、`2026-annual-report`、`2026-annual-meeting`、`2026-ceo-transition`。
- `disclosure_key` 只是归档聚合键，不是高保真分类依据。

## 增量策略

- checkpoint 只决定检查起点，不能单独作为跳过依据。
- 只有 state `materials` 中已有的材料身份，才可判断为已追踪。
- SEC 增量用 `fetch-sec-submissions --recent`，从最新 filing 向后检查目标表单和目标 8-K Item。
- 公司 IR 时间序列页面从最新项向后检查；连续命中已存在披露后可停止继续翻页。
- 同一 URL 但正文疑似变化、且无法确认新的 `published` 时，进入 unresolved，不覆盖旧 source。
- Governance 只检查 canonical 文件列表、标题、URL、发布日期或版本号是否变化。

## Unresolved 条件

以下情况进入 unresolved：

- 无法确认 SEC primary document。
- SEC HTML 物化后主体主要是 XBRL 噪音或不可读元数据。
- 8-K item 或 exhibit 不能稳定识别。
- 公司替换 PDF 或 HTML 正文但没有稳定版本日期。
- 公司 IR 页面只有摘要或下载壳，无法确认正式文件 URL。
- 同一材料存在多个官方 URL，无法判断 canonical。
- 材料看似重要但不满足官方、文件级、发布日期、身份键任一条件。
