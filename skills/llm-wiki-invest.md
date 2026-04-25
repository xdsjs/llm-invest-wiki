# LLM Wiki Invest

你是一个 wiki 维护代理。你的操作对象是一个 LLM Wiki Invest vault：它是一个结构化、互相链接的 Markdown 知识库，会把原始材料持续编译成可演化、可交叉引用的页面。人类通过 Obsidian 浏览结果；写作和维护由你完成。

## 操作

- **`/ingest <path>`**：读取一个源文件，抽取实体与关系，创建或更新带有 `[[wikilinks]]` 的 wiki 页面，并把通用原始材料复制到 `sources/YYYY-MM-DD/`。
- **`/query <question>`**：搜索 wiki，综合回答问题，并把有价值的新洞见写回 wiki，让知识持续复利。
- **`/lint`**：执行健康检查（坏链接、孤儿页、陈旧内容、frontmatter 漂移、矛盾），并自动修复安全的问题。
- **`/research <topic>`**：超出当前 wiki 继续研究：搜索网络 → 保存资料 → ingest → 产出综合报告。

## 不变量

在执行任何操作前，先读取 vault 根目录下的 `wiki-purpose.md` 和 `wiki-schema.md`。它们定义了 wiki 的范围、页面类型、命名约定、frontmatter 规则和标签体系，下面所有步骤都默认你已经加载这些信息。

如果存在 `wiki-agent.md`，也要一并读取。它定义了这个 vault 专属的 agent 身份，以及 MUST / MAY / NEVER 的 ingest 标准，会覆盖 `CLAUDE.md` / `AGENTS.md` 中的默认规则。如果不存在，则回退到 bootstrap 文件里的默认规则。

绝不要手工修改 `sources/` 下已有来源的正文内容。通用 `/ingest` 可以新增来源副本，官方建档材料只能由 dossier CLI 写入；已有来源唯一允许的更新是通过 `llm-wiki-invest sources mark-ingested` 写入 ingest 状态字段。正文编辑应当发生在 `wiki/` 中。

每次执行完操作后，无论是 ingest、query、lint 还是 research，都要在 `wiki-log.md` 追加一条单行记录，并运行 `llm-wiki-invest sync`。不要因为改动小就跳过。日志是给人审计的，sync 则用来保持 embedding 和 DB9 状态同步。

## /ingest <path>

`/ingest` 的完整流程在 `invest-wiki-ingest` skill 中。执行 ingest 时先读取 `.agents/skills/invest-wiki-ingest/SKILL.md` 或 `.claude/skills/invest-wiki-ingest/SKILL.md`，再按其中步骤处理 source、写 wiki、标记 `ingested`、记录日志并 sync。

## /query <question>

搜索 wiki 并综合回答。

### 步骤

1. 读取 `wiki-purpose.md`，确认问题在 wiki 覆盖范围内。
2. 用混合搜索找到相关页面：
   - 运行 `llm-wiki-invest search "<question>"` 做语义 / BM25 搜索
   - 需要时再扫描 `wiki/` 做精确关键词匹配
   - 合并两种结果：语义搜索抓相关概念，关键词搜索抓精确术语。
3. 读取返回的 `wiki/` 中 Markdown 文件。
4. 跟随命中的页面里的 `[[wikilinks]]` 和 `## Related`，继续发现相连知识（图遍历）。
5. 综合答案时要做到：
   - 直接回答用户问题
   - 用 `[[page-name]]` 形式引用 wiki 页面，例如：“根据 [[page-name]]，……”
   - 明确指出发现的矛盾或知识空白
   - 区分有明确来源支持的结论和推断
6. 如果 wiki 里没有足够信息回答，就明确说明，并建议应当 ingest 哪些来源。
7. 如果这次回答产出了**有价值的新知识**（例如比较、关联、综合结论，而这些内容原本不在单一页面里），则把它写回 wiki：
   - 创建一个新的 wiki 页面，并使用完整 frontmatter：
     ```yaml
     ---
     title: 综合标题
     description: 一行摘要
     tags: [synthesis]
     source_type: query-synthesis
     created: YYYY-MM-DD
     updated: YYYY-MM-DD
     ---
     ```
   - 添加指向源页面的 `[[wikilinks]]`
   - 对贡献该综合结论的 wiki 页面或 source，在正文中使用脚注，并在文件末尾 `## Refs` 统一列出
   - 更新相关页面中的交叉引用
   - 向 `wiki-log.md` 追加：
     ```
     ## [YYYY-MM-DD] query | 问题摘要
     - created `page-name` — 记录 query 综合结果
     ```
   - 运行 `llm-wiki-invest sync`

### Query 指南

- 始终以 wiki 里的内容为依据，不要编造。
- 如果 wiki 信息不足，就直接承认，不要猜测。
- 两种搜索都要用：`llm-wiki-invest search` 用于语义匹配，文件扫描用于精确命中。
- **适合写回 wiki 的情况**：
  - 这次答案把 3 个以上页面连接成了此前未被记录的关系
  - 这次答案解决了一个矛盾
  - 这次答案高置信度地补上了某个知识空白
  - 用户明确要求保存答案
- **不适合写回 wiki 的情况**：
  - 只是从单个页面里查出来的简单事实
  - 回答严重依赖 wiki 之外的信息
  - 综合结果带有明显猜测或低置信度
- 写回的综合页面必须包含完整 frontmatter，包括 `source_type: query-synthesis`；来源追溯放在正文脚注和末尾 `## Refs`，不要放进 frontmatter。

## /lint

对 wiki 做健康检查。

变体：`/lint <page>` 检查单个页面。`/lint --fix` 自动修复安全问题。

### 步骤

1. 读取 `wiki-schema.md`，理解预期结构、命名规范和必填 frontmatter 字段。
2. 扫描 `wiki/` 中所有页面，以及 `sources/` 中所有文件。
3. 构建链接图，为每个页面提取全部 `[[wikilinks]]`。
4. 从三类问题中检查：

#### 结构问题
- **坏链接**：`[[wikilinks]]` 指向不存在的页面
- **孤儿页**：没有被任何其他页面链接进来的页面
- **缺少 frontmatter**：页面缺少必需字段（title、description、tags、updated）。issue/bug 页面还必须有 `status`
- **缺少 aliases**：页面有明显别名或常用称呼，但没有 `aliases`
- **命名违规**：页面名不符合 `wiki-schema.md` 的规则
- **主题重复**：多个页面覆盖了同一个实体 / 概念（可结合 `aliases` 判断）

#### 内容问题
- **矛盾**：多个页面对同一主题给出冲突说法（可比较共享 `[[wikilinks]]` 或标签的页面）
- **陈旧内容**：页面 `updated` 日期早于其 `## Refs` 引用来源文件的修改时间
- **无来源结论**：页面存在 source-derived 事实，但缺少正文脚注或末尾 `## Refs`
- **过浅页面**：除去 frontmatter 后正文不足 3 句，应扩充或合并

#### 来源问题
- **未 ingest 的来源**：`llm-wiki-invest sources pending` 中状态为 `new` 的文件
- **来源漂移**：`llm-wiki-invest sources pending` 中状态为 `changed` 的文件

5. 输出结构化报告：
   ```
   ## Lint 报告 — YYYY-MM-DD

   ### 摘要
   - 页面总数：N | 来源总数：N
   - 问题数：N（严重：X，警告：Y，提示：Z）

   ### 严重问题
   - **坏链接**：[[page-a]] → [[nonexistent]]
   - **矛盾**：[[page-b]] 与 [[page-c]] 在主题 Z 上存在冲突

   ### 警告
   - **孤儿页**：[[page-d]] — 没有入链
   - **陈旧**：[[page-e]] — 自 YYYY-MM-DD 起未更新
   - **无来源**：[[page-f]] — 缺少正文脚注或 `## Refs`

   ### 提示
   - **过浅页面**：[[page-g]] — 只有 2 句，建议扩写
   - **待写页**：[[unwritten-page]] — 被 3 个页面链接
   - **未 ingest 来源**：sources/YYYY-MM-DD/new-article.md
   ```

6. 如果显式请求了 `--fix`，则自动应用安全修复：

| 问题 | 自动修复 |
|-------|----------|
| 坏链接 | 删除链接或创建 stub 页面 |
| 缺少 frontmatter | 补上合理默认值 |
| 孤儿页 | 从相关页面补链接（按 tag / topic 查找） |
| 陈旧内容 | 重新读取来源并更新页面（mini-ingest） |
| 主题重复 | 合并成一个页面，并把另一个作为 alias |
| 过浅页面 | 基于来源扩写，或并入相关页面 |

7. 在 `.llm-wiki-invest/lint-result.yaml` 中写入机器可读结果：
   ```yaml
   date: YYYY-MM-DD
   summary:
     pages: N
     sources: N
     issues: {critical: X, warning: Y, info: Z}
   issues:
     - type: broken_link
       severity: critical
       page: wiki/page-a.md
       detail: "links to [[nonexistent-page]]"
   ```
8. **绝不要自动修复矛盾**，这类问题必须交给人判断。
9. 向 `wiki-log.md` 追加：
   ```
   ## [YYYY-MM-DD] lint | 健康检查
   - fixed `page-name` — 修复内容
   - flagged `page-name` — 需要人工处理
   ```
10. 如果产生了任何修改，运行 `llm-wiki-invest sync`。

### Lint 指南

- 先展示发现，再做修改。
- 除非用户明确请求了 `--fix`，否则在自动修复前先征得确认。
- 处理重复主题时，优先合并，不要直接删除。
- 矛盾需要人工判断，绝不自动决策。
- 随着 wiki 增长，应定期运行 lint 保持健康状态。

## /research <topic>

做一次超出现有 wiki 内容的深度研究。

### 步骤

1. 读取 `wiki-purpose.md`，确认主题在 wiki 范围之内。
2. 读取 `wiki-schema.md`，理解页面类型和命名规则。
3. 先执行一次 **Query**，搞清楚 wiki 已经知道什么，并找出知识缺口。
4. 定义清晰的研究问题和边界，避免研究范围失控。
5. 搜索高质量外部来源（每次研究控制在 **5 到 10 个来源** 内，避免范围过大）。优先级如下：
   - 一手来源（官方文档、论文、原始公告）
   - 权威二手来源（知名出版物、专业博客）
   - 时效性，快速变化主题优先使用近期来源
6. 对每个找到的通用研究来源，把内容保存到 `sources/YYYY-MM-DD/`，并加上 frontmatter：
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
7. 对每个新增来源，执行 **Ingest** 流程：
   - 提取关键实体和结论
   - 创建或更新 wiki 页面
   - 添加交叉引用
   - 标记该来源已 ingest
8. 所有来源 ingest 完成后，撰写研究总结并展示给用户：
   ```
   ## 研究报告：[Topic]

   ### 问题
   [原始研究问题]

   ### 发现
   [基于全部来源综合出的答案]

   ### 新增来源
   - sources/YYYY-MM-DD/source-1.md — 这个来源贡献了什么

   ### 新建/更新的 Wiki 页面
   - [[page-1]] — 这个页面新增了什么

   ### 剩余缺口
   - 还有哪些问题没能回答
   - 建议的后续研究方向
   ```
9. 如果研究过程产出了新的综合结论，就按 Query 的复利规则创建综合页面。
10. 向 `wiki-log.md` 追加：
    ```
    ## [YYYY-MM-DD] research | 主题摘要
    - added N sources
    - created `page-name` — 原因
    - updated `page-name` — 变更内容
    ```
11. 运行 `llm-wiki-invest sync`。

### Research 指南

- **来源多样性**：不要依赖单一来源，关键结论要交叉验证，至少对照 2 个以上来源。
- **时效性**：记录来源发布日期。对于变化快的领域，超过 2 年的信息要明确标记。
- **可追溯性**：每个 source-derived 结论都必须能通过正文脚注和末尾 `## Refs` 回溯到来源。
- **范围纪律**：始终围绕研究问题推进。遇到有价值但超出范围的支线，只记录为“建议后续研究”，不要当场扩展。
- Research 是成本最高的操作：它会先调用 Query，再收集外部来源，然后对每个来源执行 Ingest。只有在 Query 不足以回答问题时才使用。
