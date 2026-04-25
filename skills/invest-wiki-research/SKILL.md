---
name: invest-wiki-research
description: Use when an llm-wiki-invest vault lacks enough internal knowledge and external source research is needed before updating wiki pages.超出当前 wiki 继续研究：搜索网络 → 保存资料 → ingest → 产出综合报告。
---

# Invest Wiki Research

你负责做一次超出现有 wiki 内容的外部研究，并把有价值来源物化、ingest、综合。

## 前置规则

先读取 `wiki-purpose.md`、`wiki-schema.md` 和 `wiki-agent.md`（如果存在）。Research 是成本最高的操作：只有在 Query 不足以回答问题，或用户明确要求外部研究时才使用。

研究必须围绕问题边界推进。所有可复用外部材料都要先落到 `sources/`，再通过 `/ingest` workflow 编译进 wiki。

## /research <topic>

### 步骤

1. 读取 `wiki-purpose.md`，确认主题在 wiki 范围内。
2. 读取 `wiki-schema.md`，理解页面类型和命名规则。
3. 先执行 `/query <topic>`，搞清 wiki 已经知道什么，并找出知识缺口。
4. 定义清晰的研究问题和边界，避免范围失控。
5. 搜索高质量外部来源。每次研究控制在 5 到 10 个来源内，优先级如下：
   - 一手来源：官方文档、论文、原始公告、公司材料、监管文件
   - 权威二手来源：知名出版物、专业博客、行业报告
   - 时效性：变化快的主题优先使用近期来源
6. 对每个找到的通用研究来源，先物化到明确的 source category，例如 `sources/research/YYYY/YYYY-MM-DD-<slug>/`，并加上 frontmatter：
   ```yaml
   ---
   title: 来源标题
   url: https://original-url
   author: 作者名
   date: YYYY-MM-DD
   retrieved: YYYY-MM-DD
   type: article | paper | documentation | blog | video-transcript
   ---
   ```
7. 对每个新增 source，执行 `/ingest <path>` workflow。
8. 所有来源 ingest 完成后，撰写研究总结并展示给用户。
9. 如果研究过程产出了新的综合结论，按 `/query` 的写回标准创建或更新综合页面。
10. 向 `wiki-log.md` 追加 research 记录。
11. 运行 `llm-wiki-invest sync`。

### 研究报告格式

```md
## 研究报告：[Topic]

### 问题
[原始研究问题]

### 发现
[基于全部来源综合出的答案]

### 新增来源
- sources/research/YYYY/YYYY-MM-DD-source-1/source-1.md — 这个来源贡献了什么

### 新建/更新的 Wiki 页面
- [[page-1]] — 这个页面新增了什么

### 剩余缺口
- 还有哪些问题没能回答
- 建议的后续研究方向
```

### Research 指南

- 不要依赖单一来源，关键结论至少对照 2 个以上来源。
- 记录来源发布日期；变化快的领域中，超过 2 年的信息要明确标记。
- 每个 source-derived 结论都必须能通过正文脚注和末尾 `## Refs` 回溯到来源。
- 遇到有价值但超出范围的支线，只记录为后续研究建议，不要当场扩展。
