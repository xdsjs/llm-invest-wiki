# 物化 Markdown 说明文档

本文说明 `llm-wiki-invest dossier apply` 如何把官方材料物化为 `sources/` 下的 Markdown。核心原则是：agent 只负责审定“哪些官方文件级材料值得建档”，不负责选择 Defuddle、MarkItDown 或 PDF 解析器。

## 责任边界

- reviewed manifest 只描述材料身份：`source`、`canonicalUrl`、`published`、`authority`、`documentType`、`disclosureKey`、`sequence` 等。
- CLI 在 `dossier apply` 内部根据 MIME、URL 扩展名和来源类型自动选择物化策略。
- `sources/` 中落盘的是长期事实层；正文应视为不可手工改写。
- wiki 层只引用 `sources/`，不引用下载缓存、临时 HTML 或外部原始 URL。

## 策略选择

| 来源形态 | 默认策略 | 目的 |
| --- | --- | --- |
| HTML / HTM | `defuddle-markitdown` | 先抽取主内容并清理 SEC inline XBRL 噪音，再交给 MarkItDown 生成 Markdown。 |
| PDF | `markitdown`，缺依赖时兜底 `pdf-parse` | 优先保留 MarkItDown 的通用格式转换能力；环境缺 PDF 依赖时仍能得到文本。 |
| Markdown / TXT / JSON / XML / 其他普通文件 | `markitdown` | 使用统一转换入口，避免 agent 手工拼接 Markdown。 |

HTML 目前不直接使用 Defuddle 的 Markdown 输出，因为实测 SEC inline XBRL 表格中仍可能残留大量 raw HTML 和 `ix:*` 标签。当前采用“Defuddle 清主内容 + inline XBRL 清理 + MarkItDown 转 Markdown”的混合策略。

## SEC HTML 处理

SEC 10-K、10-Q、8-K 这类 inline XBRL HTML 的主要风险是：正文前混入大量 XBRL context/unit 元数据，或把 `ix:nonfraction`、`ix:nonnumeric` 等标签直接留在 Markdown 中。

CLI 的处理顺序：

1. 使用 SEC 兼容请求头下载原始 HTML。
2. 使用 Defuddle 从 HTML 中抽取主内容。
3. 删除 `ix:header`、`ix:hidden`、`ix:references`、`ix:resources` 等元数据节点。
4. 展开其他 `ix:*` 节点，保留其可见文本。
5. 把清理后的 HTML 交给 MarkItDown 生成 Markdown。
6. 如果 HTML 混合策略失败，则退回原始文件的 MarkItDown 转换；如果兜底也失败，写入 unresolved。

## 落盘记录

每个 source Markdown 会在 frontmatter 中记录实际使用的物化策略：

```yaml
---
materializer: 'defuddle-markitdown'
---
```

`dossier-state.json` 会同步保存 `materializer`，用于后续排查“同一来源为什么 Markdown 形态不同”。`dossier-runs/<run-id>/result.json` 中的 `materialized` 字段记录本次新增 source 与对应策略。

## 失败处理

无法稳定下载、无法确认内容类型、转换结果为空、MarkItDown/兜底解析失败，都会进入 unresolved：

- 全局位置：`.llm-wiki-invest/dossier-unresolved/`
- 本次 run 位置：`.llm-wiki-invest/dossier-runs/<run-id>/unresolved/`

unresolved 表示“材料候选存在，但当前规则不能稳定物化”，不应由 agent 猜测补齐正文。

## 后续优化方向

- 增加物化质量评分，例如 raw HTML 标签比例、正文长度、关键章节命中率。
- 对 SEC 年报/季报增加章节级拆分，降低单个 source 的 ingest 成本。
- 为演示文稿、XLSX、图片型 PDF 增加更明确的专用转换器或 OCR 策略。
- 把物化策略版本写入状态，方便未来批量重物化和差异审计。
