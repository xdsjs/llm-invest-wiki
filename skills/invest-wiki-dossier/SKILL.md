---
name: invest-wiki-dossier
description: 为单家上市公司建立事实层 dossier。你负责按市场模板发现和审定官方材料，再调用 llm-wiki-invest dossier CLI 落盘为只读 markdown。用于用户要求为一家上市公司建档、抓取 SEC/交易所/IR 文件级材料、或维护 dossier 时。
---

# Invest Wiki Dossier

你负责为单家上市公司建立事实层 dossier。`dossier/` 是事实层、只读层，不是分析层。你只能通过 `llm-wiki-invest dossier ...` 命令来创建或更新 dossier，不要手工编辑 dossier 文件正文。

## 系统边界

- `dossier/` 只收**文件级官方材料**
- 官网、IR、newsroom、governance HTML 页面通常只作为**发现入口**
- dossier 落盘的是通过 `markitdown` 物化出来的**近原文 Markdown 派生件**
- 一份材料对应一个 `.md` 文件
- 同一次披露下，只有**同一种 `document_type`** 的多个文件才放在同一个 disclosure 目录
- 第三方媒体、论坛、百科、券商研报、二手转述不得进入 dossier

## 角色分工

- 你是**编排层**
- `llm-wiki-invest dossier` CLI 是**执行层**
- CLI 不负责 discover，也不直接调用 LLM
- 你负责：
  - 读取市场模板
  - 解析公司身份
  - 从官方入口发现候选文件
  - 判断哪些文件可进入 dossier
  - 归类 `authority` / `document_type` / `disclosure_key`
  - 产出 reviewed manifest
- CLI 负责：
  - 初始化 dossier 状态
  - 读取 reviewed manifest
  - 下载与转换材料
  - 落盘为 Markdown
  - 去重
  - unresolved 输出
  - 状态与检查

## 美国上市公司

当目标是美国上市公司时，先读取同目录下的 `template/us.md`。它定义了：

- 允许发现哪些来源
- 哪些 HTML 页面只允许作为 discovery surface
- 哪些文件级材料允许进入 dossier
- `authority` / `document_type` / `disclosure_key` 的归类规则
- frontmatter 最小字段
- 路径与命名规范
- 去重与 unresolved 规则

## 标准工作流

1. 读取模板，确认市场范围和排除项。
2. 解析公司身份，至少确认：
   - `ticker`
   - `company_name`
   - `cik`（如果适用）
   - `exchange`
   - 如果目标是美国上市公司，优先使用 `llm-wiki-invest dossier fetch-sec-submissions --cik <cik> --recent --forms "10-K,10-Q,8-K,DEF 14A"` 作为 SEC 抓取辅助，确认最近 filings 和公司身份。
3. 调用 CLI 初始化 dossier 状态：
   - `llm-wiki-invest dossier init --market ... --ticker ... --company-name ... [--cik ...] [--exchange ...]`
4. 严格按模板从官方入口发现**文件级**材料，不把 HTML 页面本身写入 dossier。
5. 为每个可接受材料生成 reviewed manifest，至少包含：
   - `title`
   - `source`
   - `canonicalUrl`
   - `author`
   - `published`
   - `authority`
   - `documentType`
   - `disclosureKey`
   - `sequence`
   - `suggestedFilename`
6. 调用 CLI 落盘：
   - `llm-wiki-invest dossier apply <manifest.json>`
7. 用下面两个命令检查结果：
   - `llm-wiki-invest dossier status`
   - `llm-wiki-invest dossier check`
8. 如果有未能稳定处理的材料，查看 `.llm-wiki-invest/dossier-unresolved/`，而不是猜测补齐。

## 输出规则

- dossier 只写事实，不写投资结论
- 不能把你的推断写入 dossier frontmatter 或正文
- 不要省略来源元数据
- 同一材料再次出现时要避免重复落盘
- 真的无法判定时，宁可进入 unresolved，也不要硬分类

## 禁止事项

- 不要手工改写已有 dossier 文件正文
- 不要把第三方页面当作 dossier 材料
- 不要跳过 `template/us.md` 直接凭印象抓取
- 不要把“官网上能看到的所有页面”都塞进 dossier
- 不要让 CLI 代替你做 discover 或判断
