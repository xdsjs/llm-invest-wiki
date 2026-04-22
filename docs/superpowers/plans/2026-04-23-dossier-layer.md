# Dossier Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为单公司 vault 增加 dossier 执行层：提供 `dossier init/apply/status/check` 命令、manifest 驱动的只读落盘流程，以及 dossier 专属的路径、frontmatter 和去重规则。

**Architecture:** 保持 `skill 编排 / CLI 执行` 边界不变。新增 dossier 领域库负责 manifest 解析、路径生成、frontmatter 渲染和重复键计算；新增 dossier 命令组负责初始化、执行、审计；`apply` 通过可扩展的内容 handler registry 把可稳定转换的文件 materialize 为 Markdown，无法稳定转换的文件记录到 unresolved，而不是让 CLI 做判断型发现。

**Tech Stack:** TypeScript ESM, Commander.js, Node.js `fs/path`, `gray-matter`, Vitest, Web Fetch API, optional `pdf-parse` for PDF 文本提取

---

## 文件结构

**创建**

- `src/commands/dossier.ts`：`dossier` 命令组，包含 `init`、`apply`、`status`、`check`
- `src/lib/dossier.ts`：dossier 类型、manifest 解析、frontmatter 渲染、路径与 identity key 规则
- `src/lib/dossier-apply.ts`：manifest 执行、内容下载、handler 调度、落盘、重复检测、unresolved 输出
- `src/lib/dossier-audit.ts`：`status` 和 `check` 所需的 dossier 扫描与审计逻辑
- `test/dossier.test.ts`：dossier 领域规则单元测试
- `test/dossier-apply.test.ts`：manifest 执行与去重测试
- `test/dossier-command.test.ts`：CLI 集成测试

**修改**

- `src/cli.ts`：注册 `dossier` 命令
- `src/lib/config.ts`：增加 dossier 目录和状态文件路径
- `src/commands/init.ts`：初始化 `dossier/` 目录并更新 bootstrap 输出
- `README.md`：增加 dossier 命令说明
- `skills/invest-wiki-dossier/SKILL.md`：改写为 orchestrator 指南，明确 CLI 调用方式
- `skills/invest-wiki-dossier/template/us.md`：重构为 U.S. dossier 策略模板
- `test/config.test.ts`：断言新增 dossier 路径
- `test/init.test.ts`：断言 `init` 创建 `dossier/`

## 实现边界

- v1 CLI 不实现通用 discover。
- v1 CLI 不直接调用 LLM。
- v1 `apply` 只消费经 skill 审定的 JSON manifest。
- v1 内容 handler 至少支持：
  - `text/plain`
  - `text/html`
  - `text/markdown`
  - `application/json`
  - `application/xml` / `text/xml`
  - `application/pdf`
- v1 遇到无法稳定转换的格式时，不静默失败，写入 unresolved 报告并继续处理其他材料。
- 未来的 `dossier sec-index` helper 不在本计划实现范围内。

## Task 1: 打通 dossier 路径与初始化骨架

**Files:**
- Modify: `src/lib/config.ts`
- Modify: `src/commands/init.ts`
- Test: `test/config.test.ts`
- Test: `test/init.test.ts`

- [ ] **Step 1: 先写失败测试，定义 dossier 路径与初始化结果**

```ts
// test/config.test.ts
it('should expose dossier paths', () => {
  mkdirSync(join(testDir, '.llm-wiki-invest'), { recursive: true });
  writeFileSync(join(testDir, '.llm-wiki-invest/config.toml'), '[vault]\nname = "Primary"\nlanguage = "zh"\n');

  const paths = vaultPaths(testDir);
  expect(paths.dossier).toBe(join(testDir, 'dossier'));
  expect(paths.dossierState).toBe(join(testDir, '.llm-wiki-invest/dossier-state.json'));
  expect(paths.dossierUnresolved).toBe(join(testDir, '.llm-wiki-invest/dossier-unresolved'));
});

// test/init.test.ts
it('should create dossier structure', () => {
  execSync(`node ${CLI} init`, { cwd: testDir });
  expect(existsSync(join(testDir, 'dossier'))).toBe(true);
});
```

- [ ] **Step 2: 运行测试，确认当前实现缺失 dossier 路径**

Run: `npx vitest run test/config.test.ts test/init.test.ts`
Expected: FAIL with missing `dossier`, `dossierState`, or `dossier` directory assertions

- [ ] **Step 3: 在 `src/lib/config.ts` 增加 dossier 路径**

```ts
export function vaultPaths(root: string) {
  return {
    wiki: join(root, 'wiki'),
    dossier: join(root, 'dossier'),
    sources: join(root, 'sources'),
    purpose: join(root, 'wiki-purpose.md'),
    schema: join(root, 'wiki-schema.md'),
    agent: join(root, 'wiki-agent.md'),
    log: join(root, 'wiki-log.md'),
    claudeMd: join(root, 'CLAUDE.md'),
    agentsMd: join(root, 'AGENTS.md'),
    claudeSkillsDir: join(root, '.claude', 'skills'),
    agentsSkillsDir: join(root, '.agents', 'skills'),
    config: join(root, CONFIG_PATH),
    syncState: join(root, '.llm-wiki-invest/sync-state.json'),
    dossierState: join(root, '.llm-wiki-invest/dossier-state.json'),
    dossierUnresolved: join(root, '.llm-wiki-invest/dossier-unresolved'),
    lintResult: join(root, '.llm-wiki-invest/lint-result.yaml'),
    llmWikiDir: join(root, '.llm-wiki-invest'),
  };
}
```

- [ ] **Step 4: 在 `src/commands/init.ts` 创建 `dossier/` 并更新输出**

```ts
// create directories
mkdirSync(paths.wiki, { recursive: true });
mkdirSync(paths.dossier, { recursive: true });
mkdirSync(paths.sources, { recursive: true });
mkdirSync(paths.llmWikiDir, { recursive: true });

// console output
console.log('  dossier/         — Read-only dossier materials');
```

- [ ] **Step 5: 重新运行测试，确认 dossier 基础骨架通过**

Run: `npx vitest run test/config.test.ts test/init.test.ts`
Expected: PASS

- [ ] **Step 6: 提交这一层骨架改动**

```bash
git add src/lib/config.ts src/commands/init.ts test/config.test.ts test/init.test.ts
git commit -m "feat: add dossier vault paths and init scaffold"
```

## Task 2: 建 dossier 领域模型与 manifest 契约

**Files:**
- Create: `src/lib/dossier.ts`
- Test: `test/dossier.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 frontmatter、路径和 identity key 规则**

```ts
import { describe, it, expect } from 'vitest';
import {
  buildDisclosureDir,
  buildMaterialFilename,
  makeIdentityKey,
  renderDossierMarkdown,
  loadDossierManifest,
} from '../src/lib/dossier.js';

describe('dossier helpers', () => {
  it('should build disclosure paths from authority, document type, year, and disclosure key', () => {
    expect(buildDisclosureDir('dossier', {
      authority: 'sec',
      documentType: '8-k',
      published: '2026-02-01',
      disclosureKey: '2026-02-01-0000320193-8-k',
    })).toBe('dossier/sec/8-k/2026/2026-02-01-0000320193-8-k');
  });

  it('should build sequence-prefixed filenames', () => {
    expect(buildMaterialFilename(2, 'ex99-2-presentation')).toBe('02-ex99-2-presentation.md');
  });

  it('should create SEC identity keys from accession and primary document', () => {
    expect(makeIdentityKey({
      authority: 'sec',
      accessionNo: '0000320193-24-000123',
      primaryDocument: 'a10-k2024.htm',
      canonicalUrl: '',
      published: '2024-11-01',
    })).toBe('sec:0000320193-24-000123:a10-k2024.htm');
  });

  it('should create company identity keys from canonical url and published date', () => {
    expect(makeIdentityKey({
      authority: 'company',
      canonicalUrl: 'https://investor.example.com/q1-release.pdf',
      published: '2026-02-01',
    })).toBe('company:https://investor.example.com/q1-release.pdf:2026-02-01');
  });

  it('should render dossier markdown with required frontmatter', () => {
    const md = renderDossierMarkdown({
      title: 'Apple Q1 Release',
      source: 'https://example.com/q1.pdf',
      author: '[[apple.com]]',
      published: '2026-02-01',
      created: '2026-04-23',
      authority: 'company',
      documentType: 'earnings-release',
      disclosureKey: '2026-02-01-q1-results',
      body: '# Apple Q1 Release',
    });
    expect(md).toContain('title: Apple Q1 Release');
    expect(md).toContain("author: '[[apple.com]]'");
    expect(md).toContain('document_type: earnings-release');
  });
});
```

- [ ] **Step 2: 运行测试，确认 dossier 领域库尚不存在**

Run: `npx vitest run test/dossier.test.ts`
Expected: FAIL with missing exports from `src/lib/dossier.ts`

- [ ] **Step 3: 在 `src/lib/dossier.ts` 定义类型、路径规则、frontmatter 渲染和 manifest 读取**

```ts
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

export type DossierAuthority = 'sec' | 'nasdaq' | 'nyse' | 'company';

export interface DossierMaterialInput {
  companyName: string;
  ticker: string;
  market: string;
  authority: DossierAuthority;
  title: string;
  source: string;
  canonicalUrl: string;
  author: string;
  published: string;
  documentType: string;
  disclosureKey: string;
  sequence: number;
  suggestedFilename: string;
  accessionNo?: string;
  primaryDocument?: string;
  sourceChannel?: string;
  contentType?: string;
  notes?: string;
}

export interface DossierManifest {
  company: {
    companyName: string;
    ticker: string;
    market: string;
    cik?: string;
    exchange?: string;
  };
  generatedAt: string;
  materials: DossierMaterialInput[];
}

export function loadDossierManifest(filePath: string): DossierManifest {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as DossierManifest;
}

export function buildDisclosureDir(root: string, input: {
  authority: DossierAuthority;
  documentType: string;
  published: string;
  disclosureKey: string;
}): string {
  const year = input.published.slice(0, 4);
  return posix.join(root, input.authority, input.documentType, year, input.disclosureKey);
}

export function buildMaterialFilename(sequence: number, slug: string): string {
  return `${String(sequence).padStart(2, '0')}-${slug}.md`;
}

export function makeIdentityKey(input: {
  authority: DossierAuthority;
  canonicalUrl?: string;
  published: string;
  accessionNo?: string;
  primaryDocument?: string;
}): string {
  if (input.authority === 'sec') {
    if (!input.accessionNo || !input.primaryDocument) {
      throw new Error('SEC materials require accessionNo and primaryDocument');
    }
    return `sec:${input.accessionNo}:${input.primaryDocument}`;
  }
  if (!input.canonicalUrl) {
    throw new Error(`${input.authority} materials require canonicalUrl`);
  }
  return `${input.authority}:${input.canonicalUrl}:${input.published}`;
}

export function renderDossierMarkdown(input: {
  title: string;
  source: string;
  author: string;
  published: string;
  created: string;
  authority: DossierAuthority;
  documentType: string;
  disclosureKey: string;
  body: string;
  retrievedAt?: string;
  canonicalUrl?: string;
  sourceChannel?: string;
}): string {
  const lines = [
    '---',
    `title: ${input.title}`,
    `source: ${input.source}`,
    `author: '${input.author}'`,
    `published: ${input.published}`,
    `created: ${input.created}`,
    `authority: ${input.authority}`,
    `document_type: ${input.documentType}`,
    `disclosure_key: ${input.disclosureKey}`,
  ];
  if (input.retrievedAt) lines.push(`retrieved_at: ${input.retrievedAt}`);
  if (input.canonicalUrl) lines.push(`canonical_url: ${input.canonicalUrl}`);
  if (input.sourceChannel) lines.push(`source_channel: ${input.sourceChannel}`);
  lines.push('---', '', input.body.trim(), '');
  return lines.join('\n');
}
```

- [ ] **Step 4: 重新运行 dossier 领域测试**

Run: `npx vitest run test/dossier.test.ts`
Expected: PASS

- [ ] **Step 5: 提交 dossier 领域模型**

```bash
git add src/lib/dossier.ts test/dossier.test.ts
git commit -m "feat: add dossier manifest and path helpers"
```

## Task 3: 增加 `dossier init` 命令与 CLI 接线

**Files:**
- Create: `src/commands/dossier.ts`
- Modify: `src/cli.ts`
- Test: `test/dossier-command.test.ts`

- [ ] **Step 1: 先写失败的 CLI 集成测试，只覆盖 `dossier init`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI = join(import.meta.dirname, '..', 'dist', 'cli.js');
let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-dossier-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  execSync(`node ${CLI} init`, { cwd: testDir });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

it('should initialize dossier state from explicit identity fields', () => {
  execSync(
    `node ${CLI} dossier init --market us --ticker AAPL --company-name "Apple Inc." --cik 0000320193 --exchange NASDAQ`,
    { cwd: testDir }
  );

  const statePath = join(testDir, '.llm-wiki-invest', 'dossier-state.json');
  expect(existsSync(statePath)).toBe(true);

  const state = JSON.parse(readFileSync(statePath, 'utf-8'));
  expect(state.market).toBe('us');
  expect(state.ticker).toBe('AAPL');
  expect(state.companyName).toBe('Apple Inc.');
  expect(state.cik).toBe('0000320193');
  expect(state.exchange).toBe('NASDAQ');
});
```

- [ ] **Step 2: 运行测试，确认 CLI 还没有 `dossier` 命令**

Run: `npm test -- test/dossier-command.test.ts`
Expected: FAIL with unknown command `dossier`

- [ ] **Step 3: 新建 `src/commands/dossier.ts`，先只实现 `init`**

```ts
import { Command } from 'commander';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { requireVaultRoot, vaultPaths } from '../lib/config.js';

export const dossierCommand = new Command('dossier')
  .description('Manage read-only dossier materials');

dossierCommand
  .command('init')
  .requiredOption('--market <market>', 'market code')
  .requiredOption('--ticker <ticker>', 'ticker symbol')
  .requiredOption('--company-name <name>', 'legal company name')
  .option('--cik <cik>', 'SEC CIK')
  .option('--exchange <exchange>', 'primary exchange')
  .action((opts: {
    market: string;
    ticker: string;
    companyName: string;
    cik?: string;
    exchange?: string;
  }) => {
    const root = requireVaultRoot();
    const paths = vaultPaths(root);
    mkdirSync(paths.dossier, { recursive: true });
    mkdirSync(dirname(paths.dossierState), { recursive: true });
    writeFileSync(
      paths.dossierState,
      JSON.stringify({
        market: opts.market,
        ticker: opts.ticker,
        companyName: opts.companyName,
        cik: opts.cik ?? null,
        exchange: opts.exchange ?? null,
        initializedAt: new Date().toISOString(),
      }, null, 2),
    );
    console.log(`Initialized dossier state for ${opts.ticker}`);
  });
```

- [ ] **Step 4: 在 `src/cli.ts` 注册 dossier 命令**

```ts
import { dossierCommand } from './commands/dossier.js';

program.addCommand(dossierCommand);
```

- [ ] **Step 5: 运行集成测试，确认 `dossier init` 可用**

Run: `npm test -- test/dossier-command.test.ts`
Expected: PASS

- [ ] **Step 6: 提交 dossier CLI 骨架**

```bash
git add src/commands/dossier.ts src/cli.ts test/dossier-command.test.ts
git commit -m "feat: add dossier init command"
```

## Task 4: 实现 `dossier apply` 执行管线与 unresolved 机制

**Files:**
- Create: `src/lib/dossier-apply.ts`
- Modify: `src/commands/dossier.ts`
- Test: `test/dossier-apply.test.ts`
- Test: `test/dossier-command.test.ts`

- [ ] **Step 1: 先写失败测试，覆盖 manifest 落盘、重复跳过和 unresolved 输出**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyManifest } from '../src/lib/dossier-apply.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-apply-${Date.now()}`);
  mkdirSync(join(testDir, 'dossier'), { recursive: true });
  mkdirSync(join(testDir, '.llm-wiki-invest'), { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

it('should materialize a reviewed manifest into a disclosure directory', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('# Q1 Results', {
    status: 200,
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  })) as any);

  const result = await applyManifest(testDir, {
    company: { companyName: 'Apple Inc.', ticker: 'AAPL', market: 'us' },
    generatedAt: '2026-04-23T10:00:00Z',
    materials: [{
      companyName: 'Apple Inc.',
      ticker: 'AAPL',
      market: 'us',
      authority: 'company',
      title: 'Apple Q1 Results Release',
      source: 'https://investor.apple.com/q1-release.md',
      canonicalUrl: 'https://investor.apple.com/q1-release.md',
      author: '[[apple.com]]',
      published: '2026-02-01',
      documentType: 'earnings-release',
      disclosureKey: '2026-02-01-q1-results',
      sequence: 0,
      suggestedFilename: 'primary-q1-release',
      contentType: 'text/markdown',
    }],
  });

  const out = join(
    testDir,
    'dossier/company/earnings-release/2026/2026-02-01-q1-results/00-primary-q1-release.md',
  );
  expect(result.created).toEqual([out]);
  expect(existsSync(out)).toBe(true);
  expect(readFileSync(out, 'utf-8')).toContain("author: '[[apple.com]]'");
});

it('should skip duplicate materials with the same identity key and unchanged content', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('# Same body', {
    status: 200,
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  })) as any);

  const manifest = {
    company: { companyName: 'Apple Inc.', ticker: 'AAPL', market: 'us' },
    generatedAt: '2026-04-23T10:00:00Z',
    materials: [{
      companyName: 'Apple Inc.',
      ticker: 'AAPL',
      market: 'us',
      authority: 'company',
      title: 'Apple Q1 Results Release',
      source: 'https://investor.apple.com/q1-release.md',
      canonicalUrl: 'https://investor.apple.com/q1-release.md',
      author: '[[apple.com]]',
      published: '2026-02-01',
      documentType: 'earnings-release',
      disclosureKey: '2026-02-01-q1-results',
      sequence: 0,
      suggestedFilename: 'primary-q1-release',
      contentType: 'text/markdown',
    }],
  };

  await applyManifest(testDir, manifest);
  const second = await applyManifest(testDir, manifest);

  expect(second.created).toEqual([]);
  expect(second.skippedDuplicates).toEqual([
    'company:https://investor.apple.com/q1-release.md:2026-02-01',
  ]);
});

it('should write unresolved records for unsupported content types', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'content-type': 'application/vnd.ms-powerpoint' },
  })) as any);

  const result = await applyManifest(testDir, {
    company: { companyName: 'Apple Inc.', ticker: 'AAPL', market: 'us' },
    generatedAt: '2026-04-23T10:00:00Z',
    materials: [{
      companyName: 'Apple Inc.',
      ticker: 'AAPL',
      market: 'us',
      authority: 'company',
      title: 'Apple Q1 Results Deck',
      source: 'https://investor.apple.com/q1-results.ppt',
      canonicalUrl: 'https://investor.apple.com/q1-results.ppt',
      author: '[[apple.com]]',
      published: '2026-02-01',
      documentType: 'investor-presentation',
      disclosureKey: '2026-02-01-q1-results',
      sequence: 1,
      suggestedFilename: 'ex99-2-presentation',
      contentType: 'application/vnd.ms-powerpoint',
    }],
  });

  const unresolved = join(
    testDir,
    '.llm-wiki-invest/dossier-unresolved/2026-02-01-q1-results-1.json',
  );
  expect(result.unresolved).toEqual([unresolved]);
  expect(existsSync(unresolved)).toBe(true);
  expect(readFileSync(unresolved, 'utf-8')).toContain('unsupported content-type');
});
```

- [ ] **Step 2: 运行测试，确认 apply 管线尚不存在**

Run: `npx vitest run test/dossier-apply.test.ts`
Expected: FAIL with missing `applyManifest`

- [ ] **Step 3: 实现 `src/lib/dossier-apply.ts` 的核心执行器**

```ts
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  DossierManifest,
  DossierMaterialInput,
  buildDisclosureDir,
  buildMaterialFilename,
  makeIdentityKey,
  renderDossierMarkdown,
} from './dossier.js';
import { vaultPaths } from './config.js';

export interface ApplyResult {
  created: string[];
  skippedDuplicates: string[];
  unresolved: string[];
}

interface DossierStateFile {
  materials: Record<string, { outputPath: string; contentHash: string }>;
}

function loadDossierState(statePath: string): DossierStateFile {
  if (!existsSync(statePath)) return { materials: {} };
  return JSON.parse(readFileSync(statePath, 'utf-8')) as DossierStateFile;
}

function saveDossierState(statePath: string, state: DossierStateFile): void {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function hashBody(body: string): string {
  return createHash('sha256').update(body).digest('hex').slice(0, 16);
}

async function fetchAsMarkdown(input: DossierMaterialInput): Promise<{ body: string; retrievedAt: string }> {
  const response = await fetch(input.source);
  if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
  const contentType = response.headers.get('content-type') ?? input.contentType ?? '';
  const retrievedAt = new Date().toISOString();

  if (
    contentType.startsWith('text/plain') ||
    contentType.startsWith('text/markdown') ||
    contentType.startsWith('text/html') ||
    contentType.startsWith('application/json') ||
    contentType.startsWith('application/xml') ||
    contentType.startsWith('text/xml')
  ) {
    return { body: (await response.text()).trim(), retrievedAt };
  }

  if (contentType.startsWith('application/pdf')) {
    const pdfParse = (await import('pdf-parse')).default;
    const text = await pdfParse(Buffer.from(await response.arrayBuffer()));
    return { body: text.text.trim(), retrievedAt };
  }

  throw new Error(`unsupported content-type: ${contentType}`);
}

export async function applyManifest(root: string, manifest: DossierManifest): Promise<ApplyResult> {
  const paths = vaultPaths(root);
  mkdirSync(paths.dossier, { recursive: true });
  mkdirSync(paths.dossierUnresolved, { recursive: true });
  mkdirSync(dirname(paths.dossierState), { recursive: true });

  const state = loadDossierState(paths.dossierState);
  const result: ApplyResult = { created: [], skippedDuplicates: [], unresolved: [] };

  for (const material of manifest.materials) {
    const identityKey = makeIdentityKey(material);
    try {
      const { body, retrievedAt } = await fetchAsMarkdown(material);
      const contentHash = hashBody(body);
      const existing = state.materials[identityKey];

      if (existing && existing.contentHash === contentHash) {
        result.skippedDuplicates.push(identityKey);
        continue;
      }

      const relDir = buildDisclosureDir('dossier', {
        authority: material.authority,
        documentType: material.documentType,
        published: material.published,
        disclosureKey: material.disclosureKey,
      });
      const outDir = join(root, relDir);
      mkdirSync(outDir, { recursive: true });
      const outPath = join(outDir, buildMaterialFilename(material.sequence, material.suggestedFilename));
      const markdown = renderDossierMarkdown({
        title: material.title,
        source: material.source,
        author: material.author,
        published: material.published,
        created: new Date().toISOString().slice(0, 10),
        authority: material.authority,
        documentType: material.documentType,
        disclosureKey: material.disclosureKey,
        body,
        retrievedAt,
        canonicalUrl: material.canonicalUrl,
        sourceChannel: material.sourceChannel,
      });
      writeFileSync(outPath, markdown);
      state.materials[identityKey] = { outputPath: outPath, contentHash };
      result.created.push(outPath);
    } catch (error) {
      const unresolvedPath = join(paths.dossierUnresolved, `${material.disclosureKey}-${material.sequence}.json`);
      writeFileSync(unresolvedPath, JSON.stringify({
        material,
        error: error instanceof Error ? error.message : String(error),
      }, null, 2));
      result.unresolved.push(unresolvedPath);
    }
  }

  saveDossierState(paths.dossierState, state);
  return result;
}
```

- [ ] **Step 4: 在 `src/commands/dossier.ts` 增加 `apply` 子命令**

```ts
import { loadDossierManifest } from '../lib/dossier.js';
import { applyManifest } from '../lib/dossier-apply.js';

dossierCommand
  .command('apply')
  .argument('<manifest>', 'path to reviewed dossier manifest json')
  .action(async (manifestPath: string) => {
    const root = requireVaultRoot();
    const manifest = loadDossierManifest(manifestPath);
    const result = await applyManifest(root, manifest);

    console.log(`Created: ${result.created.length}`);
    console.log(`Skipped duplicates: ${result.skippedDuplicates.length}`);
    console.log(`Unresolved: ${result.unresolved.length}`);
  });
```

- [ ] **Step 5: 为 PDF handler 增加依赖并在 package.json 中声明**

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1"
  }
}
```

- [ ] **Step 6: 运行 dossier apply 单元测试和 CLI 集成测试**

Run: `npx vitest run test/dossier-apply.test.ts test/dossier-command.test.ts`
Expected: PASS

- [ ] **Step 7: 运行全量测试，确认新增 apply 管线未破坏现有功能**

Run: `npm test`
Expected: PASS with existing DB9 tests still skipped

- [ ] **Step 8: 提交 apply 管线**

```bash
git add package.json package-lock.json src/lib/dossier-apply.ts src/commands/dossier.ts test/dossier-apply.test.ts test/dossier-command.test.ts
git commit -m "feat: add dossier apply pipeline"
```

## Task 5: 实现 `dossier status` 和 `dossier check`

**Files:**
- Create: `src/lib/dossier-audit.ts`
- Modify: `src/commands/dossier.ts`
- Test: `test/dossier-apply.test.ts`
- Test: `test/dossier-command.test.ts`

- [ ] **Step 1: 先写失败测试，覆盖结构审计与状态汇总**

```ts
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditDossier, summarizeDossier } from '../src/lib/dossier-audit.js';

it('should summarize dossier counts by authority and document type', () => {
  mkdirSync(join(testDir, 'dossier/sec/10-k/2024/disclosure-a'), { recursive: true });
  writeFileSync(join(testDir, 'dossier/sec/10-k/2024/disclosure-a/00-primary-10-k.md'), `---
title: Apple 10-K
source: https://sec.gov/10-k
author: '[[sec.gov]]'
published: 2024-11-01
created: 2026-04-23
authority: sec
document_type: 10-k
disclosure_key: disclosure-a
---

# body
`);

  const summary = summarizeDossier(join(testDir, 'dossier'));
  expect(summary.materialCount).toBe(1);
  expect(summary.disclosureCount).toBe(1);
  expect(summary.byAuthority.sec).toBe(1);
  expect(summary.byDocumentType['10-k']).toBe(1);
});

it('should flag files with missing required frontmatter or bad path layout', () => {
  const issues = auditDossier(join(testDir, 'dossier'));
  expect(issues.some(issue => issue.type === 'missing_frontmatter')).toBe(true);
});
```

- [ ] **Step 2: 运行测试，确认 dossier 审计库尚不存在**

Run: `npx vitest run test/dossier-command.test.ts test/dossier-apply.test.ts`
Expected: FAIL with missing `auditDossier` or `summarizeDossier`

- [ ] **Step 3: 在 `src/lib/dossier-audit.ts` 实现状态汇总和检查**

```ts
import { statSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import matter from 'gray-matter';
import { listMarkdownFiles } from './wiki.js';

export interface DossierIssue {
  type: string;
  path: string;
  detail: string;
}

export function summarizeDossier(dossierDir: string) {
  const files = listMarkdownFiles(dossierDir);
  const disclosures = new Set<string>();
  const byAuthority: Record<string, number> = {};
  const byDocumentType: Record<string, number> = {};
  let latestPublished = '';

  for (const file of files) {
    const { data } = matter(readFileSync(file, 'utf-8'));
    const rel = relative(dossierDir, file);
    disclosures.add(rel.split('/').slice(0, 4).join('/'));
    byAuthority[data.authority] = (byAuthority[data.authority] ?? 0) + 1;
    byDocumentType[data.document_type] = (byDocumentType[data.document_type] ?? 0) + 1;
    if (typeof data.published === 'string' && data.published > latestPublished) {
      latestPublished = data.published;
    }
  }

  return {
    materialCount: files.length,
    disclosureCount: disclosures.size,
    byAuthority,
    byDocumentType,
    latestPublished,
  };
}

export function auditDossier(dossierDir: string): DossierIssue[] {
  const issues: DossierIssue[] = [];
  for (const file of listMarkdownFiles(dossierDir)) {
    const rel = relative(dossierDir, file);
    const { data, content } = matter(readFileSync(file, 'utf-8'));
    const parts = rel.split('/');
    if (parts.length < 5) {
      issues.push({ type: 'bad_path_layout', path: rel, detail: 'expected authority/document_type/year/disclosure_key/file' });
    }
    for (const field of ['title', 'source', 'author', 'published', 'created', 'authority', 'document_type', 'disclosure_key']) {
      if (!data[field]) {
        issues.push({ type: 'missing_frontmatter', path: rel, detail: `missing ${field}` });
      }
    }
    if (typeof data.author !== 'string' || !data.author.startsWith('[[') || !data.author.endsWith(']]')) {
      issues.push({ type: 'bad_author_format', path: rel, detail: 'author must be an Obsidian wikilink' });
    }
    if (!content.trim()) {
      issues.push({ type: 'empty_body', path: rel, detail: 'materialized body is empty' });
    }
  }
  return issues;
}
```

- [ ] **Step 4: 在 `src/commands/dossier.ts` 增加 `status` 与 `check`**

```ts
import { summarizeDossier, auditDossier } from '../lib/dossier-audit.js';

dossierCommand
  .command('status')
  .action(() => {
    const root = requireVaultRoot();
    const paths = vaultPaths(root);
    const summary = summarizeDossier(paths.dossier);

    console.log(`Materials: ${summary.materialCount}`);
    console.log(`Disclosures: ${summary.disclosureCount}`);
    console.log(`Latest published: ${summary.latestPublished || 'n/a'}`);
  });

dossierCommand
  .command('check')
  .action(() => {
    const root = requireVaultRoot();
    const paths = vaultPaths(root);
    const issues = auditDossier(paths.dossier);

    if (issues.length === 0) {
      console.log('Dossier: OK');
      return;
    }

    for (const issue of issues) {
      console.log(`${issue.type}: ${issue.path} — ${issue.detail}`);
    }
    process.exitCode = 1;
  });
```

- [ ] **Step 5: 运行 status/check 测试**

Run: `npx vitest run test/dossier-apply.test.ts test/dossier-command.test.ts`
Expected: PASS

- [ ] **Step 6: 提交 dossier 审计命令**

```bash
git add src/lib/dossier-audit.ts src/commands/dossier.ts test/dossier-apply.test.ts test/dossier-command.test.ts
git commit -m "feat: add dossier status and check commands"
```

## Task 6: 更新 skill、模板和文档，使其匹配 v1 执行模型

**Files:**
- Modify: `skills/invest-wiki-dossier/SKILL.md`
- Modify: `skills/invest-wiki-dossier/template/us.md`
- Modify: `README.md`

- [ ] **Step 1: 改写 `skills/invest-wiki-dossier/SKILL.md`，明确 skill 只做编排**

```md
## 工作边界

- 你是 dossier 编排层，不是 dossier 写作者
- 你必须先读取 `template/us.md`
- 你可以解析公司身份、发现候选官方文件、判定材料类型、生成 manifest
- 你不得绕过 CLI 直接写 `dossier/` 文件
- 你必须通过以下命令执行：
  - `llm-wiki-invest dossier init ...`
  - `llm-wiki-invest dossier apply <manifest>`
  - `llm-wiki-invest dossier status`
  - `llm-wiki-invest dossier check`
```

- [ ] **Step 2: 重构 `template/us.md`，把它从研究说明文改成执行策略模板**

```md
## 允许的发现入口

- SEC `submissions` 和 filing detail 页面
- NASDAQ/NYSE 官方 listing 页面
- 公司 IR 发布页中指向正式文件的链接

## 不进入 dossier 的对象

- 普通 HTML 内容页
- 第三方镜像或转载页

## 输出规则

- 路径：`dossier/{authority}/{document_type}/{year}/{disclosure_key}/`
- 文件：同一披露目录内使用顺序前缀命名
- frontmatter 最小必填字段：
  - `title`
  - `source`
  - `author`
  - `published`
  - `created`
  - `authority`
  - `document_type`
  - `disclosure_key`
```

- [ ] **Step 3: 更新 README，把 dossier 命令和执行边界写进去**

```md
| `llm-wiki-invest dossier init ...` | 初始化当前单公司 vault 的 dossier 状态 |
| `llm-wiki-invest dossier apply <manifest>` | 根据经 skill 审定的 manifest 落盘 dossier 材料 |
| `llm-wiki-invest dossier status` | 查看 dossier 覆盖状态 |
| `llm-wiki-invest dossier check` | 检查 dossier 结构和 frontmatter |

说明：dossier 发现和分类由 `invest-wiki-dossier` skill 完成；CLI 只负责确定性执行。
```

- [ ] **Step 4: 手动检查文档与已批准 spec 是否一致**

Run: `git diff -- README.md skills/invest-wiki-dossier/SKILL.md skills/invest-wiki-dossier/template/us.md docs/superpowers/specs/2026-04-23-dossier-layer-design.md`
Expected: 变更与 spec 一致，没有出现 CLI 直接 discover 或 CLI 直接调用 LLM 的描述

- [ ] **Step 5: 提交文档与 skill 更新**

```bash
git add README.md skills/invest-wiki-dossier/SKILL.md skills/invest-wiki-dossier/template/us.md
git commit -m "docs: align dossier skill and docs with execution model"
```

## Self-Review

### Spec coverage

- `dossier` 只读层：Task 2 与 Task 4 通过 frontmatter 渲染、identity key 和只读 materialize 路径实现。
- 单公司单 vault：Task 1 与 Task 3 通过 `dossier/` 初始化和 `dossier-state.json` 绑定。
- `skill 编排 / CLI 执行`：Task 6 明确写入 skill 与 README；Task 3-5 只给 CLI 执行原语。
- `dossier/{authority}/{document_type}/{year}/{disclosure_key}/`：Task 2 路径 helper，Task 4 落盘执行，Task 5 结构校验。
- 一披露一目录、一文件一材料：Task 2 文件命名和 Task 4 apply 管线覆盖。
- YAML frontmatter 最小字段：Task 2 的 `renderDossierMarkdown` 与 Task 5 的 `auditDossier` 覆盖。
- 去重规则：Task 2 的 `makeIdentityKey` 与 Task 4 的 duplicate skip 覆盖。
- v1 不做 CLI discover：Task 3-5 的命令集只包含 `init/apply/status/check`。
- 未来窄 helper `dossier sec-index`：在计划边界中保留为未来项，不纳入 v1。

### Placeholder scan

- 没有保留“待补”“以后再说”这类占位式标记。
- 每个代码步骤都给了具体文件路径、代码和运行命令。
- 文档步骤未附测试，符合“文档类文件原则上不写单测”的仓库约束。

### Type consistency

- dossier authority 统一使用：`sec | nasdaq | nyse | company`
- frontmatter 字段统一使用：`authority`、`document_type`、`disclosure_key`
- manifest 字段统一使用：`companyName`、`title`、`canonicalUrl`、`suggestedFilename`
- CLI 子命令统一使用：`init`、`apply`、`status`、`check`
