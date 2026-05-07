# Coverage Contract v0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `llm-wiki-invest` dossier run 产出版本化、原子化的 Coverage Contract v0 bundle，并让 DossierX 具备持久化消费 coverage result 的最小依赖能力。

**Architecture:** 分两段实施：先在 `llm-wiki-invest` 引擎侧完成 `us-listed-company` preset、source inventory、quality report 和 `bundle.json`；再在 DossierX 消费侧增加 task result schema、内存/Supabase 持久化和读取能力。DossierX 阶段只做 result 持久化与契约消费支撑，不新增调用 `llm-wiki-invest` 的 adapter。

**Tech Stack:** TypeScript ESM、Node.js `fs/path`、Commander.js、Vitest；DossierX 使用 pnpm workspace、Zod、Next.js route handlers、Supabase migrations。

---

## 实施边界

- 设计来源：`docs/superpowers/specs/2026-05-07-coverage-contract-v0-design.md`
- `llm-wiki-invest` 是 contract 生产方，工作目录：`/Users/jss/clawd-workspace/OPC/llm-wiki-invest`
- DossierX 是 contract 消费方，工作目录：`/Users/jss/clawd-workspace/OPC/DossierX`
- 文档类文件不写单元测试；本计划用于后续代码实现，代码实现必须补 Vitest。
- DossierX 当前 AGENTS 约束要求 MVP 阶段不新增 `llm-wiki-invest` adapter。本计划的 DossierX 阶段只增加 result payload 持久化和 contract 字段校验，不让 Web 或 daemon 主动调用引擎。
- 两个仓库分开提交。`llm-wiki-invest` 阶段全部通过后，再切到 DossierX 阶段。

## 文件结构

### `llm-wiki-invest` 引擎侧

- Create `src/lib/dossier-contract.ts`
  Coverage Contract v0 的常量、类型、blocking 判定、quality report 和 bundle 构造器。
- Create `src/lib/dossier-coverage-preset.ts`
  `us-listed-company` preset 的 expected source 定义和 `asOf/period/selectionRule` 生成。
- Create `src/lib/dossier-source-inventory.ts`
  将 preset expectations 与 apply material outcomes 对齐，生成 `source_inventory.json` items。
- Modify `src/lib/dossier.ts`
  给 `DossierManifest` 增加 `schemaVersion`、`preset`、`expectations`，同时保持旧 manifest 可读取。
- Modify `src/lib/dossier-apply.ts`
  收集 material outcomes，写 `manifest.json`、`source_inventory.json`、`quality_report.json`、`result.json`，最后原子发布 `bundle.json`。
- Modify `src/commands/dossier.ts`
  `dossier apply` 输出 bundle 路径、coverage 状态和 blocking reasons 数量。
- Test `test/dossier-contract.test.ts`
  覆盖 quality gate 与 bundle 构造。
- Test `test/dossier-coverage-preset.test.ts`
  覆盖 `us-listed-company` preset 的 required/optional expectations 和相对时间字段。
- Test `test/dossier-source-inventory.test.ts`
  覆盖 `found/missing/failed/not_applicable` 的 inventory 生成。
- Modify `test/dossier-apply.test.ts`
  覆盖完整 bundle 文件写入、`bundle.json` 最后完成入口、result summary 对齐。
- Modify `test/dossier-command.test.ts`
  覆盖 CLI 输出新增字段。

### DossierX 消费侧

- Create `packages/shared/src/task-result.ts`
  定义 task result 的 coverage contract 字段 schema。
- Modify `packages/shared/src/api.ts`
  `CompleteTaskRequestSchema.result` 接收 `bundlePath`、`coverageState`、`commercialReportAllowed`、`blockingReasons`。
- Modify `packages/shared/src/index.ts`
  导出 task result schema/type。
- Modify `packages/shared/test/shared.test.ts`
  覆盖 complete request 中 coverage result 的解析。
- Modify `apps/web/lib/types.ts`
  给 `TaskRow` 增加 `result: TaskResult | null`。
- Modify `apps/web/lib/memory-store.ts`
  创建 task 时初始化 `result: null`，complete task 时持久化完整 `input.result`。
- Modify `apps/web/lib/supabase-admin.ts`
  Supabase update task 时写入 `result` jsonb。
- Create `supabase/migrations/0006_task_result.sql`
  给 `public.tasks` 增加 `result jsonb`。
- Modify `apps/web/test/api.test.ts`
  覆盖 memory store complete 后 task result 保留 coverage 字段。
- Modify `apps/web/test/supabase-store.test.ts`
  覆盖 Supabase row 可包含 `result`，并保持 company manifest 更新行为不变。

---

## Phase A: `llm-wiki-invest` 引擎侧

### Task 1: Contract 类型与 quality gate

**Files:**
- Create: `src/lib/dossier-contract.ts`
- Modify: `src/lib/dossier.ts`
- Test: `test/dossier-contract.test.ts`

- [ ] **Step 1: 写 failing test**

Create `test/dossier-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCoverageBundle,
  buildQualityReport,
  COVERAGE_CONTRACT_SCHEMA_VERSION,
} from '../src/lib/dossier-contract.js';
import type { SourceInventoryItem } from '../src/lib/dossier-contract.js';

const preset = {
  id: 'us-listed-company',
  version: COVERAGE_CONTRACT_SCHEMA_VERSION,
};

function item(input: Partial<SourceInventoryItem> & Pick<SourceInventoryItem, 'expectationId' | 'required' | 'status'>): SourceInventoryItem {
  return {
    expectationId: input.expectationId,
    label: input.label ?? input.expectationId,
    required: input.required,
    authority: input.authority ?? 'sec',
    documentType: input.documentType ?? '10-k',
    asOf: input.asOf ?? '2026-05-07',
    period: input.period ?? 'latest-fiscal-year',
    selectionRule: input.selectionRule ?? 'test selection rule',
    status: input.status,
    manualSupplementAllowed: input.manualSupplementAllowed ?? true,
    sourceId: input.sourceId,
    contentHash: input.contentHash,
    materializedPath: input.materializedPath,
    sourceDate: input.sourceDate,
    filingDate: input.filingDate,
    errorCode: input.errorCode,
    reason: input.reason,
    message: input.message,
  };
}

describe('coverage contract v0', () => {
  it('blocks commercial reports when a required source is missing', () => {
    const report = buildQualityReport({
      runId: '2026-05-07-aapl',
      preset,
      inventory: [
        item({
          expectationId: 'sec.latest-10-k',
          required: true,
          status: 'found',
          sourceId: 'sec:0000320193-25-000008:aapl-20240928.htm',
          contentHash: 'sha256:5f2c7a4b9d8e1a30',
          materializedPath: 'sources/10-k/2024/2024-11-01-aapl/00-primary-10-k.md',
        }),
        item({
          expectationId: 'company.latest-earnings-call',
          required: true,
          authority: 'company',
          documentType: 'earnings-call-transcript',
          period: 'latest-earnings-event',
          status: 'missing',
          errorCode: 'source_missing',
          reason: 'No earnings call transcript was found',
        }),
        item({
          expectationId: 'company.latest-ir-presentation',
          required: false,
          authority: 'company',
          documentType: 'investor-presentation',
          status: 'missing',
          errorCode: 'source_missing',
          reason: 'No investor presentation was found',
        }),
      ],
    });

    expect(report.schemaVersion).toBe(COVERAGE_CONTRACT_SCHEMA_VERSION);
    expect(report.commercialReportAllowed).toBe(false);
    expect(report.summary).toEqual({
      requiredTotal: 2,
      requiredFound: 1,
      requiredMissing: 1,
      requiredFailed: 0,
      optionalTotal: 1,
    });
    expect(report.blockingReasons).toEqual([
      {
        code: 'missing_required_source',
        message: 'No earnings call transcript was found',
        expectationId: 'company.latest-earnings-call',
      },
    ]);
  });

  it('allows commercial reports when only optional sources are missing', () => {
    const report = buildQualityReport({
      runId: '2026-05-07-aapl',
      preset,
      inventory: [
        item({
          expectationId: 'sec.latest-10-k',
          required: true,
          status: 'found',
          sourceId: 'sec:0000320193-25-000008:aapl-20240928.htm',
          contentHash: 'sha256:5f2c7a4b9d8e1a30',
          materializedPath: 'sources/10-k/2024/2024-11-01-aapl/00-primary-10-k.md',
        }),
        item({
          expectationId: 'company.latest-ir-presentation',
          required: false,
          authority: 'company',
          documentType: 'investor-presentation',
          status: 'missing',
          errorCode: 'source_missing',
          reason: 'No investor presentation was found',
        }),
      ],
    });

    expect(report.commercialReportAllowed).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.summary.optionalTotal).toBe(1);
  });

  it('does not treat required not-applicable sources as missing', () => {
    const report = buildQualityReport({
      runId: '2026-05-07-aapl',
      preset,
      inventory: [
        item({
          expectationId: 'company.latest-earnings-call-transcript',
          required: true,
          authority: 'company',
          documentType: 'earnings-call-transcript',
          period: 'latest-earnings-event',
          status: 'not_applicable',
          errorCode: 'source_not_applicable',
          reason: 'Company did not host an earnings call for this period',
        }),
      ],
    });

    expect(report.commercialReportAllowed).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.summary).toEqual({
      requiredTotal: 1,
      requiredFound: 0,
      requiredMissing: 0,
      requiredFailed: 0,
      optionalTotal: 0,
    });
  });

  it('builds bundle.json as the single completion entrypoint', () => {
    const bundle = buildCoverageBundle({
      runId: '2026-05-07-aapl',
      completedAt: '2026-05-07T02:00:20.000Z',
      company: {
        market: 'us',
        ticker: 'AAPL',
        companyName: 'Apple Inc.',
        cik: '0000320193',
        exchange: 'NASDAQ',
      },
      preset,
    });

    expect(bundle).toEqual({
      schemaVersion: COVERAGE_CONTRACT_SCHEMA_VERSION,
      runId: '2026-05-07-aapl',
      completedAt: '2026-05-07T02:00:20.000Z',
      company: {
        market: 'us',
        ticker: 'AAPL',
        companyName: 'Apple Inc.',
        cik: '0000320193',
        exchange: 'NASDAQ',
      },
      preset,
      files: {
        manifest: 'manifest.json',
        sourceInventory: 'source_inventory.json',
        qualityReport: 'quality_report.json',
        result: 'result.json',
      },
    });
  });
});
```

- [ ] **Step 2: 运行 test，确认失败**

Run:

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test -- test/dossier-contract.test.ts
```

Expected: FAIL，错误包含 `Cannot find module '../src/lib/dossier-contract.js'`。

- [ ] **Step 3: 扩展 manifest 类型**

Modify `src/lib/dossier.ts`，在 `DossierManifestCompany` 后加入：

```ts
export interface DossierPresetRef {
  id: string;
  version: string;
}

export type DossierSourceStatus = 'found' | 'missing' | 'failed' | 'skipped' | 'not_applicable';

export type DossierContractErrorCode =
  | 'source_missing'
  | 'source_fetch_failed'
  | 'source_parse_failed'
  | 'source_materialize_failed'
  | 'source_empty_output'
  | 'source_duplicate_identity'
  | 'source_sequence_conflict'
  | 'source_not_applicable'
  | 'manual_review_required';

export interface DossierSourceExpectation {
  expectationId: string;
  label: string;
  required: boolean;
  authority: DossierAuthority;
  documentType: string;
  asOf: string;
  period: string;
  selectionRule: string;
  manualSupplementAllowed: boolean;
  match: {
    authorities?: DossierAuthority[];
    documentTypes: string[];
    sourceChannel?: string;
  };
  notApplicable?: {
    errorCode: DossierContractErrorCode;
    reason: string;
  };
}
```

Then replace `DossierManifest` with:

```ts
export interface DossierManifest {
  schemaVersion?: string;
  preset?: DossierPresetRef;
  expectations?: DossierSourceExpectation[];
  company: DossierManifestCompany;
  generatedAt: string;
  materials: DossierMaterialInput[];
}
```

- [ ] **Step 4: 实现 contract module**

Create `src/lib/dossier-contract.ts`:

```ts
import type {
  DossierContractErrorCode,
  DossierManifestCompany,
  DossierPresetRef,
  DossierSourceExpectation,
  DossierSourceStatus,
} from './dossier.js';

export const COVERAGE_CONTRACT_SCHEMA_VERSION = 'coverage-contract/v0';

export interface SourceInventoryItem extends Omit<DossierSourceExpectation, 'match' | 'notApplicable'> {
  schemaVersion?: string;
  status: DossierSourceStatus;
  sourceId?: string;
  contentHash?: string;
  sourceDate?: string;
  filingDate?: string;
  materializedPath?: string;
  errorCode?: DossierContractErrorCode;
  reason?: string;
  message?: string;
}

export interface CoverageBlockingReason {
  code: 'missing_required_source' | 'failed_required_source' | 'skipped_required_source' | 'required_source_needs_review';
  message: string;
  expectationId: string;
}

export interface QualityReport {
  schemaVersion: typeof COVERAGE_CONTRACT_SCHEMA_VERSION;
  runId: string;
  preset: DossierPresetRef;
  commercialReportAllowed: boolean;
  blockingReasons: CoverageBlockingReason[];
  summary: {
    requiredTotal: number;
    requiredFound: number;
    requiredMissing: number;
    requiredFailed: number;
    optionalTotal: number;
  };
}

export interface CoverageBundle {
  schemaVersion: typeof COVERAGE_CONTRACT_SCHEMA_VERSION;
  runId: string;
  completedAt: string;
  company: DossierManifestCompany;
  preset: DossierPresetRef;
  files: {
    manifest: 'manifest.json';
    sourceInventory: 'source_inventory.json';
    qualityReport: 'quality_report.json';
    result: 'result.json';
  };
}

function displayMessage(item: SourceInventoryItem): string {
  return item.reason ?? item.message ?? `${item.label} is not available`;
}

function blockingReasonFor(item: SourceInventoryItem): CoverageBlockingReason | null {
  if (!item.required || item.status === 'found' || item.status === 'not_applicable') {
    return null;
  }

  if (item.status === 'failed') {
    return {
      code: 'failed_required_source',
      message: displayMessage(item),
      expectationId: item.expectationId,
    };
  }

  if (item.status === 'skipped') {
    return {
      code: 'skipped_required_source',
      message: displayMessage(item),
      expectationId: item.expectationId,
    };
  }

  if (item.errorCode === 'manual_review_required') {
    return {
      code: 'required_source_needs_review',
      message: displayMessage(item),
      expectationId: item.expectationId,
    };
  }

  return {
    code: 'missing_required_source',
    message: displayMessage(item),
    expectationId: item.expectationId,
  };
}

export function buildQualityReport(input: {
  runId: string;
  preset: DossierPresetRef;
  inventory: SourceInventoryItem[];
}): QualityReport {
  const required = input.inventory.filter(item => item.required);
  const blockingReasons = input.inventory
    .map(blockingReasonFor)
    .filter((reason): reason is CoverageBlockingReason => reason !== null);

  return {
    schemaVersion: COVERAGE_CONTRACT_SCHEMA_VERSION,
    runId: input.runId,
    preset: input.preset,
    commercialReportAllowed: blockingReasons.length === 0,
    blockingReasons,
    summary: {
      requiredTotal: required.length,
      requiredFound: required.filter(item => item.status === 'found').length,
      requiredMissing: required.filter(item => item.status === 'missing').length,
      requiredFailed: required.filter(item => item.status === 'failed').length,
      optionalTotal: input.inventory.filter(item => !item.required).length,
    },
  };
}

export function buildCoverageBundle(input: {
  runId: string;
  completedAt: string;
  company: DossierManifestCompany;
  preset: DossierPresetRef;
}): CoverageBundle {
  return {
    schemaVersion: COVERAGE_CONTRACT_SCHEMA_VERSION,
    runId: input.runId,
    completedAt: input.completedAt,
    company: input.company,
    preset: input.preset,
    files: {
      manifest: 'manifest.json',
      sourceInventory: 'source_inventory.json',
      qualityReport: 'quality_report.json',
      result: 'result.json',
    },
  };
}
```

- [ ] **Step 5: 运行 targeted test**

Run:

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test -- test/dossier-contract.test.ts
```

Expected: PASS `test/dossier-contract.test.ts`。

- [ ] **Step 6: 提交**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
git add src/lib/dossier.ts src/lib/dossier-contract.ts test/dossier-contract.test.ts
git commit -m "feat: add coverage contract primitives"
```

Expected: commit created.

### Task 2: `us-listed-company` preset

**Files:**
- Create: `src/lib/dossier-coverage-preset.ts`
- Test: `test/dossier-coverage-preset.test.ts`

- [ ] **Step 1: 写 failing test**

Create `test/dossier-coverage-preset.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COVERAGE_CONTRACT_SCHEMA_VERSION } from '../src/lib/dossier-contract.js';
import { buildUsListedCompanyPreset } from '../src/lib/dossier-coverage-preset.js';

describe('us-listed-company coverage preset', () => {
  it('emits versioned required and optional source expectations', () => {
    const preset = buildUsListedCompanyPreset({
      asOf: '2026-05-07',
      company: {
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        cik: '0000320193',
        exchange: 'NASDAQ',
      },
    });

    expect(preset.ref).toEqual({
      id: 'us-listed-company',
      version: COVERAGE_CONTRACT_SCHEMA_VERSION,
    });
    expect(preset.expectations.map(item => item.expectationId)).toEqual([
      'sec.latest-10-k',
      'sec.latest-10-q',
      'sec.latest-proxy',
      'sec.latest-earnings-8-k',
      'company.latest-earnings-release',
      'company.latest-earnings-call-transcript',
      'company.latest-ir-presentation',
      'company.latest-governance-documents',
      'exchange.latest-company-profile',
    ]);
    expect(preset.expectations.filter(item => item.required)).toHaveLength(6);
    expect(preset.expectations.filter(item => !item.required)).toHaveLength(3);
    expect(preset.expectations[0]).toMatchObject({
      label: 'Latest annual report on Form 10-K',
      authority: 'sec',
      documentType: '10-k',
      asOf: '2026-05-07',
      period: 'latest-fiscal-year',
      manualSupplementAllowed: true,
      match: {
        authorities: ['sec'],
        documentTypes: ['10-k'],
      },
    });
    expect(preset.expectations[5]).toMatchObject({
      expectationId: 'company.latest-earnings-call-transcript',
      period: 'latest-earnings-event',
      match: {
        authorities: ['company'],
        documentTypes: ['earnings-call-transcript'],
      },
    });
  });
});
```

- [ ] **Step 2: 运行 test，确认失败**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test -- test/dossier-coverage-preset.test.ts
```

Expected: FAIL，错误包含 `Cannot find module '../src/lib/dossier-coverage-preset.js'`。

- [ ] **Step 3: 实现 preset builder**

Create `src/lib/dossier-coverage-preset.ts`:

```ts
import type { DossierManifestCompany, DossierSourceExpectation } from './dossier.js';
import { COVERAGE_CONTRACT_SCHEMA_VERSION } from './dossier-contract.js';

export function buildUsListedCompanyPreset(input: {
  asOf: string;
  company: DossierManifestCompany;
}): {
  ref: { id: 'us-listed-company'; version: typeof COVERAGE_CONTRACT_SCHEMA_VERSION };
  expectations: DossierSourceExpectation[];
} {
  const selectionPrefix = `for ${input.company.ticker} as of ${input.asOf}`;

  return {
    ref: {
      id: 'us-listed-company',
      version: COVERAGE_CONTRACT_SCHEMA_VERSION,
    },
    expectations: [
      {
        expectationId: 'sec.latest-10-k',
        label: 'Latest annual report on Form 10-K',
        required: true,
        authority: 'sec',
        documentType: '10-k',
        asOf: input.asOf,
        period: 'latest-fiscal-year',
        selectionRule: `latest annual report on Form 10-K ${selectionPrefix}`,
        manualSupplementAllowed: true,
        match: { authorities: ['sec'], documentTypes: ['10-k'] },
      },
      {
        expectationId: 'sec.latest-10-q',
        label: 'Latest quarterly report on Form 10-Q',
        required: true,
        authority: 'sec',
        documentType: '10-q',
        asOf: input.asOf,
        period: 'latest-quarter',
        selectionRule: `latest quarterly report on Form 10-Q ${selectionPrefix}`,
        manualSupplementAllowed: true,
        match: { authorities: ['sec'], documentTypes: ['10-q'] },
      },
      {
        expectationId: 'sec.latest-proxy',
        label: 'Latest proxy statement',
        required: true,
        authority: 'sec',
        documentType: 'proxy-statement',
        asOf: input.asOf,
        period: 'latest-annual-meeting',
        selectionRule: `latest DEF 14A proxy statement ${selectionPrefix}`,
        manualSupplementAllowed: true,
        match: { authorities: ['sec'], documentTypes: ['def-14a', 'proxy-statement'] },
      },
      {
        expectationId: 'sec.latest-earnings-8-k',
        label: 'Latest earnings-related Form 8-K',
        required: true,
        authority: 'sec',
        documentType: '8-k',
        asOf: input.asOf,
        period: 'latest-earnings-event',
        selectionRule: `latest earnings-related Form 8-K or exhibit ${selectionPrefix}`,
        manualSupplementAllowed: true,
        match: { authorities: ['sec'], documentTypes: ['8-k'] },
      },
      {
        expectationId: 'company.latest-earnings-release',
        label: 'Latest earnings release',
        required: true,
        authority: 'company',
        documentType: 'earnings-release',
        asOf: input.asOf,
        period: 'latest-earnings-event',
        selectionRule: `latest company-controlled earnings release ${selectionPrefix}`,
        manualSupplementAllowed: true,
        match: { authorities: ['company'], documentTypes: ['earnings-release'] },
      },
      {
        expectationId: 'company.latest-earnings-call-transcript',
        label: 'Latest earnings call transcript',
        required: true,
        authority: 'company',
        documentType: 'earnings-call-transcript',
        asOf: input.asOf,
        period: 'latest-earnings-event',
        selectionRule: `latest earnings call transcript or explicit not-applicable evidence ${selectionPrefix}`,
        manualSupplementAllowed: true,
        match: { authorities: ['company'], documentTypes: ['earnings-call-transcript'] },
      },
      {
        expectationId: 'company.latest-ir-presentation',
        label: 'Latest investor presentation',
        required: false,
        authority: 'company',
        documentType: 'investor-presentation',
        asOf: input.asOf,
        period: 'latest-investor-update',
        selectionRule: `latest company-controlled investor presentation ${selectionPrefix}`,
        manualSupplementAllowed: true,
        match: { authorities: ['company'], documentTypes: ['investor-presentation'] },
      },
      {
        expectationId: 'company.latest-governance-documents',
        label: 'Latest company governance documents',
        required: false,
        authority: 'company',
        documentType: 'governance-document',
        asOf: input.asOf,
        period: 'current-governance',
        selectionRule: `current bylaws, committee charters, or governance guidelines ${selectionPrefix}`,
        manualSupplementAllowed: true,
        match: { authorities: ['company'], documentTypes: ['governance-document'] },
      },
      {
        expectationId: 'exchange.latest-company-profile',
        label: 'Latest exchange company profile',
        required: false,
        authority: input.company.exchange === 'NYSE' ? 'nyse' : 'nasdaq',
        documentType: 'exchange-profile',
        asOf: input.asOf,
        period: 'current-profile',
        selectionRule: `current primary exchange company profile ${selectionPrefix}`,
        manualSupplementAllowed: false,
        match: { authorities: ['nasdaq', 'nyse'], documentTypes: ['exchange-profile'] },
      },
    ],
  };
}
```

- [ ] **Step 4: 运行 targeted tests**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test -- test/dossier-coverage-preset.test.ts test/dossier-contract.test.ts
```

Expected: PASS 两个 test files。

- [ ] **Step 5: 提交**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
git add src/lib/dossier-coverage-preset.ts test/dossier-coverage-preset.test.ts
git commit -m "feat: add us listed company coverage preset"
```

Expected: commit created.

### Task 3: Source inventory builder

**Files:**
- Create: `src/lib/dossier-source-inventory.ts`
- Test: `test/dossier-source-inventory.test.ts`

- [ ] **Step 1: 写 failing test**

Create `test/dossier-source-inventory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSourceInventory } from '../src/lib/dossier-source-inventory.js';
import type { DossierSourceExpectation } from '../src/lib/dossier.js';

const expectations: DossierSourceExpectation[] = [
  {
    expectationId: 'sec.latest-10-k',
    label: 'Latest annual report on Form 10-K',
    required: true,
    authority: 'sec',
    documentType: '10-k',
    asOf: '2026-05-07',
    period: 'latest-fiscal-year',
    selectionRule: 'latest annual report on Form 10-K',
    manualSupplementAllowed: true,
    match: { authorities: ['sec'], documentTypes: ['10-k'] },
  },
  {
    expectationId: 'company.latest-earnings-call-transcript',
    label: 'Latest earnings call transcript',
    required: true,
    authority: 'company',
    documentType: 'earnings-call-transcript',
    asOf: '2026-05-07',
    period: 'latest-earnings-event',
    selectionRule: 'latest earnings call transcript',
    manualSupplementAllowed: true,
    match: { authorities: ['company'], documentTypes: ['earnings-call-transcript'] },
  },
  {
    expectationId: 'company.latest-ir-presentation',
    label: 'Latest investor presentation',
    required: false,
    authority: 'company',
    documentType: 'investor-presentation',
    asOf: '2026-05-07',
    period: 'latest-investor-update',
    selectionRule: 'latest investor presentation',
    manualSupplementAllowed: true,
    match: { authorities: ['company'], documentTypes: ['investor-presentation'] },
  },
];

describe('source inventory builder', () => {
  it('marks found sources with source id, hash, dates, and materialized path', () => {
    const inventory = buildSourceInventory({
      root: '/vault',
      expectations,
      outcomes: [
        {
          status: 'found',
          sourceId: 'sec:0000320193-25-000008:aapl-20240928.htm',
          contentHash: 'sha256:5f2c7a4b9d8e1a30',
          outputPath: '/vault/sources/10-k/2024/2024-11-01-aapl/00-primary-10-k.md',
          material: {
            authority: 'sec',
            documentType: '10-k',
            published: '2024-11-01',
            accessionNo: '0000320193-25-000008',
            primaryDocument: 'aapl-20240928.htm',
          },
        },
      ],
    });

    expect(inventory[0]).toMatchObject({
      expectationId: 'sec.latest-10-k',
      status: 'found',
      sourceId: 'sec:0000320193-25-000008:aapl-20240928.htm',
      contentHash: 'sha256:5f2c7a4b9d8e1a30',
      filingDate: '2024-11-01',
      sourceDate: '2024-11-01',
      materializedPath: 'sources/10-k/2024/2024-11-01-aapl/00-primary-10-k.md',
    });
  });

  it('marks required unmatched expectations as missing', () => {
    const inventory = buildSourceInventory({
      root: '/vault',
      expectations,
      outcomes: [],
    });

    expect(inventory[0]).toMatchObject({
      expectationId: 'sec.latest-10-k',
      required: true,
      status: 'missing',
      errorCode: 'source_missing',
      reason: 'Latest annual report on Form 10-K was not found',
    });
    expect(inventory[2]).toMatchObject({
      expectationId: 'company.latest-ir-presentation',
      required: false,
      status: 'missing',
      errorCode: 'source_missing',
    });
  });

  it('marks failed materialization with stable error code and display reason', () => {
    const inventory = buildSourceInventory({
      root: '/vault',
      expectations,
      outcomes: [
        {
          status: 'failed',
          errorCode: 'source_materialize_failed',
          error: 'unsupported content-type: application/vnd.ms-powerpoint',
          material: {
            authority: 'company',
            documentType: 'earnings-call-transcript',
            published: '2026-02-01',
          },
        },
      ],
    });

    expect(inventory[1]).toMatchObject({
      expectationId: 'company.latest-earnings-call-transcript',
      status: 'failed',
      errorCode: 'source_materialize_failed',
      reason: 'unsupported content-type: application/vnd.ms-powerpoint',
    });
  });

  it('keeps not-applicable expectations separate from missing sources', () => {
    const inventory = buildSourceInventory({
      root: '/vault',
      expectations: [{
        expectationId: 'company.latest-earnings-call-transcript',
        label: 'Latest earnings call transcript',
        required: true,
        authority: 'company',
        documentType: 'earnings-call-transcript',
        asOf: '2026-05-07',
        period: 'latest-earnings-event',
        selectionRule: 'latest earnings call transcript',
        manualSupplementAllowed: true,
        match: { authorities: ['company'], documentTypes: ['earnings-call-transcript'] },
        notApplicable: {
          errorCode: 'source_not_applicable',
          reason: 'Company did not host an earnings call for this period',
        },
      }],
      outcomes: [],
    });

    expect(inventory).toEqual([
      {
        expectationId: 'company.latest-earnings-call-transcript',
        label: 'Latest earnings call transcript',
        required: true,
        authority: 'company',
        documentType: 'earnings-call-transcript',
        asOf: '2026-05-07',
        period: 'latest-earnings-event',
        selectionRule: 'latest earnings call transcript',
        manualSupplementAllowed: true,
        status: 'not_applicable',
        errorCode: 'source_not_applicable',
        reason: 'Company did not host an earnings call for this period',
      },
    ]);
  });
});
```

- [ ] **Step 2: 运行 test，确认失败**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test -- test/dossier-source-inventory.test.ts
```

Expected: FAIL，错误包含 `Cannot find module '../src/lib/dossier-source-inventory.js'`。

- [ ] **Step 3: 实现 inventory builder**

Create `src/lib/dossier-source-inventory.ts`:

```ts
import { relative, sep } from 'node:path';
import type {
  DossierAuthority,
  DossierContractErrorCode,
  DossierMaterialInput,
  DossierSourceExpectation,
} from './dossier.js';
import type { SourceInventoryItem } from './dossier-contract.js';

export interface DossierMaterialOutcome {
  status: 'found' | 'failed' | 'skipped';
  material: Pick<
    DossierMaterialInput,
    'authority' | 'documentType' | 'published' | 'accessionNo' | 'primaryDocument'
  >;
  sourceId?: string;
  contentHash?: string;
  outputPath?: string;
  errorCode?: DossierContractErrorCode;
  error?: string;
}

function toVaultRelative(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}

function authorityMatches(expectation: DossierSourceExpectation, authority: DossierAuthority): boolean {
  return expectation.match.authorities ? expectation.match.authorities.includes(authority) : expectation.authority === authority;
}

function outcomeMatches(expectation: DossierSourceExpectation, outcome: DossierMaterialOutcome): boolean {
  return (
    authorityMatches(expectation, outcome.material.authority) &&
    expectation.match.documentTypes.includes(outcome.material.documentType)
  );
}

function statusFromOutcome(outcome: DossierMaterialOutcome): SourceInventoryItem['status'] {
  if (outcome.status === 'found') {
    return 'found';
  }
  if (outcome.status === 'skipped') {
    return 'skipped';
  }
  return 'failed';
}

function missingItem(expectation: DossierSourceExpectation): SourceInventoryItem {
  if (expectation.notApplicable) {
    return {
      expectationId: expectation.expectationId,
      label: expectation.label,
      required: expectation.required,
      authority: expectation.authority,
      documentType: expectation.documentType,
      asOf: expectation.asOf,
      period: expectation.period,
      selectionRule: expectation.selectionRule,
      manualSupplementAllowed: expectation.manualSupplementAllowed,
      status: 'not_applicable',
      errorCode: expectation.notApplicable.errorCode,
      reason: expectation.notApplicable.reason,
    };
  }

  return {
    expectationId: expectation.expectationId,
    label: expectation.label,
    required: expectation.required,
    authority: expectation.authority,
    documentType: expectation.documentType,
    asOf: expectation.asOf,
    period: expectation.period,
    selectionRule: expectation.selectionRule,
    manualSupplementAllowed: expectation.manualSupplementAllowed,
    status: 'missing',
    errorCode: 'source_missing',
    reason: `${expectation.label} was not found`,
  };
}

export function buildSourceInventory(input: {
  root: string;
  expectations: DossierSourceExpectation[];
  outcomes: DossierMaterialOutcome[];
}): SourceInventoryItem[] {
  return input.expectations.map(expectation => {
    const outcome = input.outcomes.find(item => outcomeMatches(expectation, item));
    if (!outcome) {
      return missingItem(expectation);
    }

    const status = statusFromOutcome(outcome);
    return {
      expectationId: expectation.expectationId,
      label: expectation.label,
      required: expectation.required,
      authority: expectation.authority,
      documentType: expectation.documentType,
      asOf: expectation.asOf,
      period: expectation.period,
      selectionRule: expectation.selectionRule,
      manualSupplementAllowed: expectation.manualSupplementAllowed,
      status,
      sourceId: outcome.sourceId,
      contentHash: outcome.contentHash,
      sourceDate: outcome.material.published,
      filingDate: outcome.material.authority === 'sec' ? outcome.material.published : undefined,
      materializedPath: outcome.outputPath ? toVaultRelative(input.root, outcome.outputPath) : undefined,
      errorCode: status === 'found' ? undefined : outcome.errorCode ?? 'manual_review_required',
      reason: status === 'found' ? undefined : outcome.error ?? `${expectation.label} requires review`,
    };
  });
}
```

- [ ] **Step 4: 运行 targeted tests**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test -- test/dossier-source-inventory.test.ts test/dossier-contract.test.ts
```

Expected: PASS targeted tests.

- [ ] **Step 5: 提交**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
git add src/lib/dossier-source-inventory.ts test/dossier-source-inventory.test.ts
git commit -m "feat: build dossier source inventory"
```

Expected: commit created.

### Task 4: Apply run 写入 atomic bundle

**Files:**
- Modify: `src/lib/dossier-apply.ts`
- Modify: `test/dossier-apply.test.ts`

- [ ] **Step 1: 写 failing test for complete bundle**

Append to `describe('applyManifest', ...)` in `test/dossier-apply.test.ts`:

```ts
  it('should write a coverage contract bundle as the run completion entrypoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('# 10-K', {
      status: 200,
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    })) as typeof fetch);

    const result = await applyManifest(testDir, {
      schemaVersion: 'coverage-contract/v0',
      preset: { id: 'us-listed-company', version: 'coverage-contract/v0' },
      company: {
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        cik: '0000320193',
        exchange: 'NASDAQ',
      },
      generatedAt: '2026-05-07T02:00:00Z',
      expectations: [{
        expectationId: 'sec.latest-10-k',
        label: 'Latest annual report on Form 10-K',
        required: true,
        authority: 'sec',
        documentType: '10-k',
        asOf: '2026-05-07',
        period: 'latest-fiscal-year',
        selectionRule: 'latest annual report on Form 10-K for AAPL',
        manualSupplementAllowed: true,
        match: { authorities: ['sec'], documentTypes: ['10-k'] },
      }],
      materials: [{
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        authority: 'sec',
        title: 'Apple 10-K',
        source: 'https://sec.example.com/aapl-10k.htm',
        canonicalUrl: 'https://sec.example.com/aapl-10k.htm',
        author: '[[sec.gov]]',
        published: '2024-11-01',
        documentType: '10-k',
        disclosureKey: '2024-11-01-aapl-10-k',
        sequence: 0,
        suggestedFilename: 'primary-10-k',
        accessionNo: '0000320193-25-000008',
        primaryDocument: 'aapl-20240928.htm',
        contentType: 'text/html',
      }],
    }, { runId: '2026-05-07-aapl' });

    expect(result.bundlePath).toBe(join(result.runDir, 'bundle.json'));
    expect(existsSync(join(result.runDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(result.runDir, 'source_inventory.json'))).toBe(true);
    expect(existsSync(join(result.runDir, 'quality_report.json'))).toBe(true);
    expect(existsSync(join(result.runDir, 'result.json'))).toBe(true);
    expect(existsSync(join(result.runDir, 'bundle.json'))).toBe(true);

    const bundle = JSON.parse(readFileSync(join(result.runDir, 'bundle.json'), 'utf-8')) as {
      schemaVersion: string;
      files: Record<string, string>;
    };
    expect(bundle.schemaVersion).toBe('coverage-contract/v0');
    expect(bundle.files).toEqual({
      manifest: 'manifest.json',
      sourceInventory: 'source_inventory.json',
      qualityReport: 'quality_report.json',
      result: 'result.json',
    });

    const qualityReport = JSON.parse(readFileSync(join(result.runDir, 'quality_report.json'), 'utf-8')) as {
      commercialReportAllowed: boolean;
      blockingReasons: unknown[];
    };
    expect(qualityReport.commercialReportAllowed).toBe(true);
    expect(qualityReport.blockingReasons).toEqual([]);

    const inventory = JSON.parse(readFileSync(join(result.runDir, 'source_inventory.json'), 'utf-8')) as Array<{
      expectationId: string;
      status: string;
      contentHash: string;
      materializedPath: string;
    }>;
    expect(inventory[0]).toMatchObject({
      expectationId: 'sec.latest-10-k',
      status: 'found',
      materializedPath: 'sources/10-k/2024/2024-11-01-aapl-10-k/00-primary-10-k.md',
    });
    expect(inventory[0]?.contentHash).toMatch(/^sha256:[a-f0-9]{16}$/);
  });
```

- [ ] **Step 2: 写 failing test for blocking missing required source**

Append to `test/dossier-apply.test.ts`:

```ts
  it('should keep failed coverage runs consumable when a required source is missing', async () => {
    const result = await applyManifest(testDir, {
      schemaVersion: 'coverage-contract/v0',
      preset: { id: 'us-listed-company', version: 'coverage-contract/v0' },
      company: { companyName: 'Apple Inc.', ticker: 'AAPL', market: 'us' },
      generatedAt: '2026-05-07T02:00:00Z',
      expectations: [{
        expectationId: 'company.latest-earnings-call-transcript',
        label: 'Latest earnings call transcript',
        required: true,
        authority: 'company',
        documentType: 'earnings-call-transcript',
        asOf: '2026-05-07',
        period: 'latest-earnings-event',
        selectionRule: 'latest earnings call transcript for AAPL',
        manualSupplementAllowed: true,
        match: { authorities: ['company'], documentTypes: ['earnings-call-transcript'] },
      }],
      materials: [],
    }, { runId: '2026-05-07-aapl-missing' });

    const qualityReport = JSON.parse(readFileSync(join(result.runDir, 'quality_report.json'), 'utf-8')) as {
      commercialReportAllowed: boolean;
      blockingReasons: Array<{ code: string; expectationId: string }>;
    };
    expect(result.commercialReportAllowed).toBe(false);
    expect(qualityReport.commercialReportAllowed).toBe(false);
    expect(qualityReport.blockingReasons).toEqual([
      {
        code: 'missing_required_source',
        message: 'Latest earnings call transcript was not found',
        expectationId: 'company.latest-earnings-call-transcript',
      },
    ]);
    expect(existsSync(join(result.runDir, 'bundle.json'))).toBe(true);
  });
```

- [ ] **Step 3: 运行 tests，确认失败**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test -- test/dossier-apply.test.ts
```

Expected: FAIL，错误包含 `Property 'bundlePath' does not exist` 或缺少 `source_inventory.json`。

- [ ] **Step 4: 更新 ApplyResult 类型和 helpers**

Modify imports in `src/lib/dossier-apply.ts`:

```ts
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import {
  buildCoverageBundle,
  buildQualityReport,
  COVERAGE_CONTRACT_SCHEMA_VERSION,
} from './dossier-contract.js';
import { buildUsListedCompanyPreset } from './dossier-coverage-preset.js';
import { buildSourceInventory } from './dossier-source-inventory.js';
import type { CoverageBlockingReason, SourceInventoryItem } from './dossier-contract.js';
import type { DossierMaterialOutcome } from './dossier-source-inventory.js';
```

Extend `ApplyResult`:

```ts
export interface ApplyResult {
  created: string[];
  materialized: Array<{ path: string; materializer: MaterializerName }>;
  skippedDuplicates: string[];
  unresolved: string[];
  runDir: string;
  runId: string;
  bundlePath: string;
  sourceInventoryPath: string;
  qualityReportPath: string;
  commercialReportAllowed: boolean;
  blockingReasons: CoverageBlockingReason[];
}
```

Add helpers near `renderRunResult`:

```ts
function writeJsonFile(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeCompletionJson(path: string, value: unknown): void {
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeJsonFile(tmpPath, value);
  renameSync(tmpPath, path);
}

function hashToContractHash(hash: string): string {
  return hash.startsWith('sha256:') ? hash : `sha256:${hash}`;
}

function normalizeManifestForContract(manifest: DossierManifest): DossierManifest {
  if (manifest.preset && manifest.expectations) {
    return {
      ...manifest,
      schemaVersion: manifest.schemaVersion ?? COVERAGE_CONTRACT_SCHEMA_VERSION,
    };
  }

  const asOf = manifest.generatedAt.slice(0, 10);
  const preset = buildUsListedCompanyPreset({ asOf, company: manifest.company });
  return {
    ...manifest,
    schemaVersion: COVERAGE_CONTRACT_SCHEMA_VERSION,
    preset: preset.ref,
    expectations: preset.expectations,
  };
}
```

- [ ] **Step 5: 收集 material outcomes**

Inside `applyManifest`, replace:

```ts
writeFileSync(join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
```

with:

```ts
const contractManifest = normalizeManifestForContract(manifest);
writeJsonFile(join(runDir, 'manifest.json'), contractManifest);
```

Initialize result and outcomes:

```ts
const result: ApplyResult = {
  created: [],
  materialized: [],
  skippedDuplicates: [],
  unresolved: [],
  runDir,
  runId,
  bundlePath: join(runDir, 'bundle.json'),
  sourceInventoryPath: join(runDir, 'source_inventory.json'),
  qualityReportPath: join(runDir, 'quality_report.json'),
  commercialReportAllowed: false,
  blockingReasons: [],
};
const outcomes: DossierMaterialOutcome[] = [];
```

In the `for (const material of contractManifest.materials)` loop, move identity calculation inside the `try` block so malformed material identity becomes a failed outcome instead of aborting the whole run:

```ts
for (const material of contractManifest.materials) {
  try {
    const identityKey = makeIdentityKey(material);
    const seqKey = sequenceKey(material);
    // existing materialization logic stays in this try block
  } catch (error) {
    // catch block records unresolved and outcomes below
  }
}
```

When materialization skips duplicate, before `continue`:

```ts
outcomes.push({
  status: 'found',
  material,
  sourceId: identityKey,
  contentHash: hashToContractHash(existing.contentHash),
  outputPath: existing.outputPath,
});
```

When materialization writes a new file, after `result.materialized.push(...)`:

```ts
outcomes.push({
  status: 'found',
  material,
  sourceId: identityKey,
  contentHash: hashToContractHash(contentHash),
  outputPath: outPath,
});
```

In the catch block, before writing unresolved payload:

```ts
const message = error instanceof Error ? error.message : String(error);
outcomes.push({
  status: 'failed',
  material,
  errorCode: message.includes('duplicate sequence')
    ? 'source_sequence_conflict'
    : 'source_materialize_failed',
  error: message,
});
```

- [ ] **Step 6: 生成 inventory、quality report、result、bundle**

Replace the final `writeFileSync(join(runDir, 'result.json'), ...)` with:

```ts
const inventory = buildSourceInventory({
  root,
  expectations: contractManifest.expectations ?? [],
  outcomes,
});
const qualityReport = buildQualityReport({
  runId,
  preset: contractManifest.preset ?? {
    id: 'us-listed-company',
    version: COVERAGE_CONTRACT_SCHEMA_VERSION,
  },
  inventory,
});
result.commercialReportAllowed = qualityReport.commercialReportAllowed;
result.blockingReasons = qualityReport.blockingReasons;

writeJsonFile(result.sourceInventoryPath, inventory);
writeJsonFile(result.qualityReportPath, qualityReport);
writeFileSync(join(runDir, 'result.json'), `${renderRunResult(root, contractManifest, result, inventory, qualityReport)}\n`);

const bundle = buildCoverageBundle({
  runId,
  completedAt: now,
  company: contractManifest.company,
  preset: qualityReport.preset,
});
writeCompletionJson(result.bundlePath, bundle);
return result;
```

Change `renderRunResult` signature and body:

```ts
function renderRunResult(
  root: string,
  manifest: DossierManifest,
  result: ApplyResult,
  inventory: SourceInventoryItem[],
  qualityReport: ReturnType<typeof buildQualityReport>
): string {
  return JSON.stringify({
    runId: result.runId,
    company: manifest.company,
    generatedAt: manifest.generatedAt,
    created: result.created.map(path => toVaultRelative(root, path)),
    materialized: result.materialized.map(item => ({
      path: toVaultRelative(root, item.path),
      materializer: item.materializer,
    })),
    skippedDuplicates: result.skippedDuplicates,
    unresolved: result.unresolved.map(path => toVaultRelative(root, path)),
    sourceInventory: 'source_inventory.json',
    qualityReport: 'quality_report.json',
    commercialReportAllowed: qualityReport.commercialReportAllowed,
    blockingReasons: qualityReport.blockingReasons,
    coverageSummary: qualityReport.summary,
    inventorySummary: inventory.map(item => ({
      expectationId: item.expectationId,
      status: item.status,
      sourceId: item.sourceId,
      materializedPath: item.materializedPath,
      errorCode: item.errorCode,
    })),
  }, null, 2);
}
```

- [ ] **Step 7: 运行 apply tests**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test -- test/dossier-apply.test.ts test/dossier-source-inventory.test.ts test/dossier-contract.test.ts
```

Expected: PASS targeted tests。

- [ ] **Step 8: 提交**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
git add src/lib/dossier-apply.ts test/dossier-apply.test.ts
git commit -m "feat: emit coverage contract bundles"
```

Expected: commit created.

### Task 5: CLI 输出和引擎侧全量验证

**Files:**
- Modify: `src/commands/dossier.ts`
- Modify: `test/dossier-command.test.ts`

- [ ] **Step 1: 更新 CLI test**

In `test/dossier-command.test.ts`, inside `it('should apply a reviewed manifest through the CLI', ...)`, add assertions:

```ts
    expect(output).toContain('Coverage: incomplete');
    expect(output).toContain('Blocking reasons: 5');
    expect(output).toContain('Bundle: .llm-wiki-invest/dossier-runs/2026-04-25-aapl/bundle.json');
    expect(existsSync(join(testDir, '.llm-wiki-invest/dossier-runs/2026-04-25-aapl/bundle.json'))).toBe(true);
    expect(existsSync(join(testDir, '.llm-wiki-invest/dossier-runs/2026-04-25-aapl/source_inventory.json'))).toBe(true);
    expect(existsSync(join(testDir, '.llm-wiki-invest/dossier-runs/2026-04-25-aapl/quality_report.json'))).toBe(true);
```

This existing CLI manifest contains only an earnings release, so the US preset should block five required expectations.

- [ ] **Step 2: 运行 test，确认失败**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test -- test/dossier-command.test.ts
```

Expected: FAIL，stdout lacks `Coverage:` and `Bundle:` lines.

- [ ] **Step 3: 更新 CLI 输出**

Modify `src/commands/dossier.ts`, in `dossier apply` action after `Run:`:

```ts
    console.log(`Run: ${relative(root, result.runDir).split(sep).join('/')}`);
    console.log(`Bundle: ${relative(root, result.bundlePath).split(sep).join('/')}`);
    console.log(`Coverage: ${result.commercialReportAllowed ? 'complete' : 'incomplete'}`);
    console.log(`Blocking reasons: ${result.blockingReasons.length}`);
```

Remove the old duplicate `Run:` line if both old and new code are present.

- [ ] **Step 4: 运行引擎侧 targeted tests**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test -- test/dossier-command.test.ts test/dossier-apply.test.ts test/dossier-contract.test.ts test/dossier-coverage-preset.test.ts test/dossier-source-inventory.test.ts
```

Expected: PASS targeted tests。

- [ ] **Step 5: 运行完整引擎侧测试和 type build**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test
npm run build
```

Expected:
- `npm test`: all Vitest tests PASS。
- `npm run build`: tsup build succeeds with no TypeScript errors。

- [ ] **Step 6: 提交**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
git add src/commands/dossier.ts test/dossier-command.test.ts
git commit -m "feat: show coverage bundle in dossier apply"
```

Expected: commit created.

---

## Phase B: DossierX 消费侧依赖

### Task 6: Shared task result schema

**Files:**
- Create: `/Users/jss/clawd-workspace/OPC/DossierX/packages/shared/src/task-result.ts`
- Modify: `/Users/jss/clawd-workspace/OPC/DossierX/packages/shared/src/api.ts`
- Modify: `/Users/jss/clawd-workspace/OPC/DossierX/packages/shared/src/index.ts`
- Modify: `/Users/jss/clawd-workspace/OPC/DossierX/packages/shared/test/shared.test.ts`

- [ ] **Step 1: 写 failing test**

In `/Users/jss/clawd-workspace/OPC/DossierX/packages/shared/test/shared.test.ts`, after the existing `CompleteTaskRequestSchema accepts manifest metadata` test, add:

```ts
  it('CompleteTaskRequestSchema accepts coverage contract task result', () => {
    const request = CompleteTaskRequestSchema.parse({
      result: {
        generatedFiles: [],
        manifestPath: 'companies/AAPL/manifest.json',
        bundlePath: '.llm-wiki-invest/dossier-runs/2026-05-07-aapl/bundle.json',
        coverageState: 'incomplete',
        commercialReportAllowed: false,
        blockingReasons: [
          {
            code: 'missing_required_source',
            message: 'Required source is missing',
            expectationId: 'sec.latest-10-k'
          }
        ]
      }
    });

    expect(request.result.bundlePath).toBe(
      '.llm-wiki-invest/dossier-runs/2026-05-07-aapl/bundle.json'
    );
    expect(request.result.coverageState).toBe('incomplete');
    expect(request.result.commercialReportAllowed).toBe(false);
    expect(request.result.blockingReasons).toEqual([
      {
        code: 'missing_required_source',
        message: 'Required source is missing',
        expectationId: 'sec.latest-10-k'
      }
    ]);
  });
```

- [ ] **Step 2: 运行 shared test，确认失败**

```bash
cd /Users/jss/clawd-workspace/OPC/DossierX
pnpm --filter @xdsjs/dossierx-shared exec vitest run test/shared.test.ts
```

Expected: FAIL，parsed result drops or rejects coverage fields.

- [ ] **Step 3: 创建 task-result schema**

Create `/Users/jss/clawd-workspace/OPC/DossierX/packages/shared/src/task-result.ts`:

```ts
import { z } from 'zod'
import { CompanyManifestSchema } from './manifest'

export const CoverageStateSchema = z.enum(['complete', 'incomplete'])

export const CoverageBlockingReasonSchema = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  expectationId: z.string().trim().min(1)
})

export const TaskResultSchema = z.object({
  generatedFiles: z.array(z.string()).default([]),
  manifestPath: z.string().optional(),
  manifest: CompanyManifestSchema.optional(),
  commitSha: z.string().optional(),
  gitSnapshot: z
    .object({
      status: z.enum(['published', 'unchanged']),
      commitSha: z.string().optional(),
      previousCommitSha: z.string().optional(),
      treeHash: z.string(),
      branch: z.string(),
      pushed: z.boolean(),
      remoteUrl: z.string().optional(),
      generatedAt: z.string()
    })
    .optional(),
  bundlePath: z.string().optional(),
  coverageState: CoverageStateSchema.optional(),
  commercialReportAllowed: z.boolean().optional(),
  blockingReasons: z.array(CoverageBlockingReasonSchema).default([])
})

export type CoverageState = z.infer<typeof CoverageStateSchema>
export type CoverageBlockingReason = z.infer<
  typeof CoverageBlockingReasonSchema
>
export type TaskResult = z.infer<typeof TaskResultSchema>
```

- [ ] **Step 4: 接入 API schema 和 exports**

Modify `/Users/jss/clawd-workspace/OPC/DossierX/packages/shared/src/api.ts` imports:

```ts
import { TaskResultSchema } from './task-result'
```

Replace `CompleteTaskRequestSchema` with:

```ts
export const CompleteTaskRequestSchema = z.object({
  result: TaskResultSchema
})
```

Modify `/Users/jss/clawd-workspace/OPC/DossierX/packages/shared/src/index.ts`:

```ts
export * from './task-result'
```

- [ ] **Step 5: 运行 shared tests**

```bash
cd /Users/jss/clawd-workspace/OPC/DossierX
pnpm --filter @xdsjs/dossierx-shared test
pnpm --filter @xdsjs/dossierx-shared typecheck
```

Expected:
- shared tests PASS。
- typecheck exits 0。

- [ ] **Step 6: 提交 DossierX shared schema**

```bash
cd /Users/jss/clawd-workspace/OPC/DossierX
git add packages/shared/src/task-result.ts packages/shared/src/api.ts packages/shared/src/index.ts packages/shared/test/shared.test.ts
git commit -m "feat: add coverage task result schema"
```

Expected: commit created.

### Task 7: DossierX task result 持久化

**Files:**
- Modify: `/Users/jss/clawd-workspace/OPC/DossierX/apps/web/lib/types.ts`
- Modify: `/Users/jss/clawd-workspace/OPC/DossierX/apps/web/lib/memory-store.ts`
- Modify: `/Users/jss/clawd-workspace/OPC/DossierX/apps/web/lib/supabase-admin.ts`
- Create: `/Users/jss/clawd-workspace/OPC/DossierX/supabase/migrations/0006_task_result.sql`
- Modify: `/Users/jss/clawd-workspace/OPC/DossierX/apps/web/test/api.test.ts`
- Modify: `/Users/jss/clawd-workspace/OPC/DossierX/apps/web/test/supabase-store.test.ts`

- [ ] **Step 1: 写 memory store failing test**

In `/Users/jss/clawd-workspace/OPC/DossierX/apps/web/test/api.test.ts`, inside `POST /api/tasks/:id/complete sets succeeded`, change the complete payload to:

```ts
          result: {
            generatedFiles: ['companies/OXY/right/right-business.md'],
            manifestPath: 'companies/OXY/manifest.json',
            bundlePath: '.llm-wiki-invest/dossier-runs/2026-05-07-oxy/bundle.json',
            coverageState: 'incomplete',
            commercialReportAllowed: false,
            blockingReasons: [
              {
                code: 'missing_required_source',
                message: 'Required source is missing',
                expectationId: 'sec.latest-10-k'
              }
            ]
          }
```

Then add assertions after status assertion:

```ts
    expect(getMemoryStoreSnapshot().tasks[0]?.result).toMatchObject({
      generatedFiles: ['companies/OXY/right/right-business.md'],
      manifestPath: 'companies/OXY/manifest.json',
      bundlePath: '.llm-wiki-invest/dossier-runs/2026-05-07-oxy/bundle.json',
      coverageState: 'incomplete',
      commercialReportAllowed: false,
      blockingReasons: [
        {
          code: 'missing_required_source',
          message: 'Required source is missing',
          expectationId: 'sec.latest-10-k'
        }
      ]
    });
```

- [ ] **Step 2: 写 Supabase migration/store expectation**

In `/Users/jss/clawd-workspace/OPC/DossierX/apps/web/test/supabase-store.test.ts`, add a test near the complete-task related tests:

```ts
  it('persists task result when completing Supabase tasks', async () => {
    const task: TaskRow = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      user_id: '00000000-0000-4000-8000-000000000001',
      machine_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      agent_id: null,
      workspace_id: null,
      company_id: null,
      type: 'mock.write_company_report',
      payload: { ticker: 'OXY', market: 'us' },
      status: 'claimed',
      claimed_at: '2026-05-01T00:00:00.000Z',
      started_at: null,
      finished_at: null,
      error: null,
      result: null,
      created_at: '2026-05-01T00:00:00.000Z'
    };
    const state: FakeState = {
      machines: [],
      agents: [],
      workspaces: [],
      companies: [],
      tasks: [task]
    };
    createClientMock.mockReturnValue(createFakeClient(state));

    const { createSupabaseStore } = await import('../lib/supabase-admin');
    const completed = await createSupabaseStore().completeTask(
      task.machine_id,
      task.id,
      {
        result: {
          generatedFiles: [],
          bundlePath: '.llm-wiki-invest/dossier-runs/2026-05-07-oxy/bundle.json',
          coverageState: 'incomplete',
          commercialReportAllowed: false,
          blockingReasons: [
            {
              code: 'missing_required_source',
              message: 'Required source is missing',
              expectationId: 'sec.latest-10-k'
            }
          ]
        }
      }
    );

    expect(completed?.result).toMatchObject({
      bundlePath: '.llm-wiki-invest/dossier-runs/2026-05-07-oxy/bundle.json',
      coverageState: 'incomplete',
      commercialReportAllowed: false
    });
    expect(state.tasks[0]?.result).toMatchObject({
      blockingReasons: [
        {
          code: 'missing_required_source',
          message: 'Required source is missing',
          expectationId: 'sec.latest-10-k'
        }
      ]
    });
  });
```

- [ ] **Step 3: 运行 web tests，确认失败**

```bash
cd /Users/jss/clawd-workspace/OPC/DossierX
pnpm --filter @xdsjs/dossierx-web exec vitest run test/api.test.ts test/supabase-store.test.ts
```

Expected: FAIL，TypeScript/test error shows `TaskRow` has no `result` or stores do not persist it.

- [ ] **Step 4: 更新 TaskRow 类型**

Modify `/Users/jss/clawd-workspace/OPC/DossierX/apps/web/lib/types.ts` imports:

```ts
  TaskResult,
```

Add to `TaskRow` after `payload`:

```ts
  result: TaskResult | null
```

- [ ] **Step 5: 更新 memory store**

Modify every `TaskRow` literal in `/Users/jss/clawd-workspace/OPC/DossierX/apps/web/lib/memory-store.ts` to include:

```ts
    result: null,
```

In `completeTask`, after `task.error = null`, add:

```ts
      task.result = input.result
```

- [ ] **Step 6: 更新 Supabase store**

Modify `/Users/jss/clawd-workspace/OPC/DossierX/apps/web/lib/supabase-admin.ts`, in `completeTask` update payload:

```ts
        .update({
          status: 'succeeded',
          finished_at: new Date().toISOString(),
          error: null,
          result: input.result
        })
```

No change is needed in `toTask(row)` because daemon claim payload intentionally remains `id/type/payload` only.

- [ ] **Step 7: 添加 migration**

Create `/Users/jss/clawd-workspace/OPC/DossierX/supabase/migrations/0006_task_result.sql`:

```sql
alter table public.tasks
  add column if not exists result jsonb;
```

- [ ] **Step 8: 运行 DossierX targeted tests**

```bash
cd /Users/jss/clawd-workspace/OPC/DossierX
pnpm --filter @xdsjs/dossierx-web exec vitest run test/api.test.ts test/supabase-store.test.ts
pnpm --filter @xdsjs/dossierx-web typecheck
```

Expected:
- targeted web tests PASS。
- web typecheck exits 0。

- [ ] **Step 9: 提交 DossierX persistence**

```bash
cd /Users/jss/clawd-workspace/OPC/DossierX
git add apps/web/lib/types.ts apps/web/lib/memory-store.ts apps/web/lib/supabase-admin.ts apps/web/test/api.test.ts apps/web/test/supabase-store.test.ts supabase/migrations/0006_task_result.sql
git commit -m "feat: persist task completion results"
```

Expected: commit created.

### Task 8: Final verification and handoff

**Files:**
- Modify only if tests reveal code issues in files touched by Tasks 1-7.

- [ ] **Step 1: 验证 `llm-wiki-invest`**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
npm test
npm run build
git status --short --branch
```

Expected:
- all Vitest tests PASS。
- build succeeds。
- `git status` shows clean working tree and branch ahead by the implementation commits.

- [ ] **Step 2: 验证 DossierX**

```bash
cd /Users/jss/clawd-workspace/OPC/DossierX
pnpm test
pnpm typecheck
git status --short --branch
```

Expected:
- all package tests PASS。
- typecheck succeeds。
- `git status` shows clean working tree and branch ahead by the DossierX implementation commits.

- [ ] **Step 3: 手动 smoke run**

Create `/tmp/coverage-contract-aapl-manifest.json`:

```json
{
  "company": {
    "companyName": "Apple Inc.",
    "ticker": "AAPL",
    "market": "us",
    "cik": "0000320193",
    "exchange": "NASDAQ"
  },
  "generatedAt": "2026-05-07T02:00:00Z",
  "materials": [
    {
      "companyName": "Apple Inc.",
      "ticker": "AAPL",
      "market": "us",
      "authority": "company",
      "title": "Apple Q1 Results Release",
      "source": "data:text/markdown,%23%20Q1%20Results",
      "canonicalUrl": "data:text/markdown,%23%20Q1%20Results",
      "author": "[[apple.com]]",
      "published": "2026-02-01",
      "documentType": "earnings-release",
      "disclosureKey": "2026-02-01-q1-results",
      "sequence": 0,
      "suggestedFilename": "primary-q1-release"
    }
  ]
}
```

Run:

```bash
cd /tmp
mkdir -p coverage-contract-smoke
cd coverage-contract-smoke
node /Users/jss/clawd-workspace/OPC/llm-wiki-invest/dist/cli.js init
node /Users/jss/clawd-workspace/OPC/llm-wiki-invest/dist/cli.js dossier apply /tmp/coverage-contract-aapl-manifest.json --run-id smoke-aapl
test -f .llm-wiki-invest/dossier-runs/smoke-aapl/bundle.json
test -f .llm-wiki-invest/dossier-runs/smoke-aapl/source_inventory.json
test -f .llm-wiki-invest/dossier-runs/smoke-aapl/quality_report.json
```

Expected CLI output includes:

```text
Created: 1
Skipped duplicates: 0
Unresolved: 0
Run: .llm-wiki-invest/dossier-runs/smoke-aapl
Bundle: .llm-wiki-invest/dossier-runs/smoke-aapl/bundle.json
Coverage: incomplete
Blocking reasons: 5
```

- [ ] **Step 4: 检查 bundle JSON**

Run:

```bash
cd /tmp/coverage-contract-smoke
node -e "const fs=require('fs'); const b=JSON.parse(fs.readFileSync('.llm-wiki-invest/dossier-runs/smoke-aapl/bundle.json','utf8')); const q=JSON.parse(fs.readFileSync('.llm-wiki-invest/dossier-runs/smoke-aapl/quality_report.json','utf8')); console.log(JSON.stringify({schemaVersion:b.schemaVersion, entry:Object.keys(b.files), allowed:q.commercialReportAllowed, blockers:q.blockingReasons.length}, null, 2))"
```

Expected:

```json
{
  "schemaVersion": "coverage-contract/v0",
  "entry": [
    "manifest",
    "sourceInventory",
    "qualityReport",
    "result"
  ],
  "allowed": false,
  "blockers": 5
}
```

- [ ] **Step 5: 最终 diff check**

```bash
cd /Users/jss/clawd-workspace/OPC/llm-wiki-invest
git diff --check
cd /Users/jss/clawd-workspace/OPC/DossierX
git diff --check
```

Expected: no output from both commands.

- [ ] **Step 6: 汇报**

Post in `#all:ca69e614`:

```text
Coverage Contract v0 implementation is ready for review.

llm-wiki-invest:
- emits versioned bundle.json / manifest.json / source_inventory.json / quality_report.json / result.json
- blocks commercial report generation with quality_report.commercialReportAllowed and blockingReasons[]
- tests and build pass

DossierX:
- CompleteTaskRequest accepts coverage result fields
- task result is persisted in memory store and Supabase tasks.result jsonb
- tests and typecheck pass

No report-generation adapter was added on the DossierX side.
```

---

## Review Checklist

- [ ] `bundle.json` is written last and is the only completion entrypoint.
- [ ] Every non-`found` inventory item has `errorCode` plus `reason` or `message`.
- [ ] Required `missing/failed/skipped` items block `commercialReportAllowed`.
- [ ] `not_applicable` is not counted as missing or failed.
- [ ] `source_inventory.json` entries include `asOf`, `period`, `selectionRule`, and found-date fields.
- [ ] DossierX can represent `task.status = succeeded` with `task.result.coverageState = "incomplete"`.
- [ ] DossierX result persistence is not only a task event.
- [ ] No DossierX adapter/invocation was introduced in this plan.
