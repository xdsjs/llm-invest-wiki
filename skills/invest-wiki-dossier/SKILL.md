---
name: invest-wiki-dossier
description: 为单家上市公司建立事实层 sources。你负责按市场模板发现和审定官方材料，再调用 llm-wiki-invest dossier CLI 落盘为只读 markdown。用于用户要求为一家上市公司建档、抓取 SEC/交易所/IR 文件级材料、或维护官方来源材料时。
---

# Invest Wiki Dossier

你负责为单家上市公司发现、审定并物化官方材料。`sources/` 是唯一长期事实层、只读层，不是分析层；dossier 是抓取、审定和运行记录流程，不是 wiki 的引用层。

## 系统边界

- 建档材料最终落盘到 `sources/`，只收**文件级官方材料**
- dossier 落盘的是通过 `markitdown` 物化出来的**近原文 Markdown 派生件**
- 一份材料对应一个 `.md` 文件

## 角色分工

- 你是**编排层**
- `llm-wiki-invest dossier` CLI 是**执行层**
- CLI 不负责 discover，也不直接调用 LLM
- 你负责：
  - 读取市场模板
  - 解析公司身份
  - 从官方入口发现候选文件
  - 判断哪些文件可进入官方建档 sources
  - 归类 `authority` / `document_type` / `disclosure_key`
  - 产出 reviewed manifest
- CLI 负责：
  - 初始化 dossier 状态
  - 读取 reviewed manifest
  - 为每次 apply 建立 `.llm-wiki-invest/dossier-runs/<run-id>/`
  - 写入 `result.json`，供 ingest 从 run 目录解析本次 created sources
  - 下载与转换材料
  - 落盘为 Markdown
  - 去重
  - unresolved 输出
  - 状态与检查

## 美国上市公司

当目标是美国上市公司时，先读取同目录下的 `template/us.md`。它定义了：

- 市场特有的来源边界
- HTML 页面准入规则
- `authority` / `document_type` / `disclosure_key` 的归类规则
- 路径、frontmatter、去重与 unresolved 规则

工作流、CLI 调用顺序、reviewed manifest 产出责任，以本 `SKILL.md` 为准；`template/us.md` 只保留美国市场特有规则。

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
   - 并确保 `sequence` 在目标 disclosure 目录内唯一
6. 调用 CLI 落盘：
   - `llm-wiki-invest dossier apply <manifest.json>`
   - 如需稳定审计路径，可加 `--run-id <YYYY-MM-DD-ticker-purpose>`
7. 用下面两个命令检查结果：
   - `llm-wiki-invest dossier status`
   - `llm-wiki-invest dossier check`
8. 查看 `.llm-wiki-invest/dossier-runs/<run-id>/report.md`，确认本次 created / skipped / unresolved。机器消费使用同目录的 `result.json`。若有未能稳定处理的材料，同时查看该 run 下的 `unresolved/` 和全局 `.llm-wiki-invest/dossier-unresolved/`，不要猜测补齐。

## 输出规则

- 不能把你的推断写入来源 frontmatter 或正文
- 同一材料再次出现时要避免重复落盘
- 真的无法判定时，宁可进入 unresolved，也不要硬分类
