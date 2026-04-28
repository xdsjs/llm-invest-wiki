---
name: invest-wiki-right-price
description: Use when updating the human-facing Right Price judgment page from existing llm-wiki-invest wiki knowledge, after sources have already been ingested.
---

# Invest Wiki Right Price

你负责更新 `wiki/right/right-price.md`。这是判断层，不是事实层；只能基于已有 `wiki/` 知识页、事件页和它们的引用来源来判断当前价格是否有足够赔率。

## 边界

- 输入来自已有 `wiki/` 页面，不直接从 `sources/` 跳写判断。
- 如果关键来源还没有 ingest，先建议运行 `invest-wiki-ingest`，不要补猜。
- `right-price` 只回答价格、估值、市场预期和赔率，不重复写业务质量或管理层托付判断。
- 判断必须同时保留支持证据、反证、关键假设和可证伪条件。
- 当价格、股本、市值等市场数据不足以完成判断时，可以使用 yfinance 查询当前市场输入；查询结果必须标注查询时间、ticker、字段口径和局限性。
- yfinance 查询结果只作为 `right-price` 的估值输入说明；默认不创建 source，也不写普通 wiki 页面。

## Workflow

1. 读取 `wiki-purpose.md`、`wiki-schema.md` 和 `wiki-agent.md`（如果存在）。
2. 读取相关知识页，至少包括 `wiki/financials.md`、`wiki/business-overview.md`、`wiki/capital-allocation.md`、相关 `wiki/events/*.md` 和 `wiki/open-questions.md`。
3. 如果缺少当前价格、市值、股本口径、企业价值或市场预期输入，优先使用 yfinance 查询；如果 yfinance 不可用或字段缺失，再向用户请求输入，并明确标注 right-price 暂不能完整完成。
4. 只在已有 wiki 证据和必要市场输入足够时更新 `wiki/right/right-price.md`。
5. 如果页面不存在，按 `wiki-schema.md` 的判断层结构创建。
6. 向 `wiki-log.md` 追加记录，并运行 `llm-wiki-invest sync`。

## yfinance 查询

当价格或估值输入不足时，可以用 yfinance 查询当前市场数据。示例：

```bash
python - <<'PY'
import yfinance as yf
ticker = "AAPL"
t = yf.Ticker(ticker)
print(t.fast_info)
print(t.info)
PY
```

优先读取这些字段：`lastPrice` / `regularMarketPrice`、`marketCap`、`sharesOutstanding`、`enterpriseValue`、`totalCash`、`totalDebt`、`trailingPE`、`forwardPE`、`forwardEps`、`targetMeanPrice`、`recommendationMean`、`currency`。不同 ticker 的字段可能缺失或口径不同，不要伪造。

在 `wiki/right/right-price.md` 中必须写清：

- yfinance 查询时间。
- 查询 ticker 和交易货币。
- 使用了哪些字段，以及字段缺失时采用了什么替代口径。
- 这些市场数据只是估值输入，不是官方披露事实。
- 如果 yfinance 不可用或关键字段为空，不要猜测；向用户请求输入或把缺口写入 `反证与疑点` / `改变判断的条件`。

## 高质量问题

- 当前价格大概隐含什么增长、利润率、资本回报和终局预期。
- 市场可能错在哪里：低估业务质量、高估风险、低估管理层、忽略周期位置，还是反过来。
- Base / Bull / Bear case 的关键假设是什么，哪些变量最敏感。
- 下行风险来自估值压缩、盈利下修、现金流恶化、稀释还是永久性业务损害。
- 预期收益是否足以补偿不确定性和等待时间。
- 什么价格会让赔率变差，什么事实会让估值假设失效。
- 最近披露中有什么事实改变了盈利能力、现金流、风险或市场预期。

## 输出结构

`wiki/right/right-price.md` 至少包含：

```md
# Right Price

## 当前判断

## 市场隐含预期

## 基准 / 乐观 / 悲观情景

## 支持证据

## 反证与疑点

## 最近变化

## 改变判断的条件

## 来源
```

`## 来源` 优先引用 `wiki/` 页面；必要时可以引用这些 wiki 页面背后的 `sources/` 脚注。
