# Dossier Layer Design

Date: 2026-04-23
Topic: single-company invest dossier layer
Status: approved in discussion, not yet implemented

## Goal

Define the dossier layer for a single-company invest vault.

The dossier layer is the vault's read-only fact layer. It stores official, regulatory,
exchange, and company-controlled file-level materials as Markdown derivatives so that
humans and agents can inspect them in Obsidian, while preserving a stable execution
boundary between agent orchestration and deterministic CLI actions.

## Non-goals

- Do not redesign the existing `wiki/` layer.
- Do not make the CLI call LLMs directly.
- Do not store original binary or HTML source files inside `dossier/`.
- Do not let LLMs freely edit dossier files after they are materialized.

## Core decisions

### Vault model

- One company equals one vault.
- This spec only defines `dossier/`.
- The existing `wiki/` layer remains separate and is out of scope for this spec.

### Dossier semantics

- `dossier/` is read-only.
- Dossier stores file-level official materials only.
- Ordinary company or IR HTML pages are discovery inputs only and do not become dossier files.
- Each dossier file is a near-original Markdown derivative of one official source file.
- LLMs may help decide what to fetch and how to classify it, but they may not freely rewrite dossier outputs.

### Authority model

The first path segment under `dossier/` is the publishing authority, not the content topic.

Allowed first-level authorities in the U.S. template:

- `sec`
- `nasdaq`
- `nyse`
- `company`

Company-controlled materials are not split in the path by `ir`, `governance`, or `newsroom`.
That channel detail belongs in metadata, not in the directory tree.

### Material and disclosure boundaries

- One official file maps to one dossier Markdown file.
- One disclosure event maps to one directory.
- Multiple files from the same disclosure must live under the same disclosure directory.
- Different documents of the same type are different materials when their publication identity differs.
  Example: two `10-K` filings from different dates are different materials.

### Read-only derivative model

The dossier does not store original raw files. Instead it stores Markdown derivatives whose
frontmatter points back to the original URL and source authority.

The derivative should stay close to the original document structure and wording. It is not a
fact summary page and not an analysis page.

## Approaches considered

### Approach A: thick template, thin CLI

- Put most U.S.-specific logic into `template/us.md`
- Keep CLI as a very small downloader/materializer

Pros:

- Fast to iterate at the template level
- Easy for agents to reason about market-specific behavior

Cons:

- Too much execution logic drifts into prose
- Hard to test deterministic behavior
- Skill layer becomes overloaded

### Approach B: thick CLI, thin template

- Hardcode most U.S. discovery and classification logic in CLI
- Use template mostly for high-level policy

Pros:

- Stable execution path
- Easier deterministic replay

Cons:

- Violates the project's current philosophy
- Makes the CLI own judgment-heavy logic
- Harder to extend cleanly to other markets later

### Approach C: medium template, medium CLI, explicit orchestration boundary

- `template/us.md` defines policy, scope, classification, dedupe rules, and output schema
- `invest-wiki-dossier` skill orchestrates discovery and classification under the template
- CLI executes deterministic primitives from a reviewed manifest

Recommendation:

- Choose Approach C.
- It best matches the desired boundary: skill as orchestration layer, CLI as execution layer.

## Recommended architecture

### Skill responsibility

`invest-wiki-dossier` is the orchestration layer.

It must:

- read `template/us.md`
- resolve company identity
- inspect official discovery pages and APIs
- decide which links are valid official file-level materials
- classify each material into a dossier `document_type`
- group materials into disclosure directories
- emit a reviewed manifest for deterministic execution
- call dossier CLI commands

It must not:

- directly write dossier Markdown files except through CLI execution
- turn HTML discovery pages into dossier materials
- rewrite already materialized dossier files
- write investment conclusions into dossier

### Template responsibility

`template/us.md` is the U.S. market policy file.

It must define:

- what counts as an allowed dossier material
- what discovery surfaces are allowed
- what document types exist
- how authorities and channels are interpreted
- how paths and disclosure directories are formed
- what frontmatter fields are required
- how duplicate detection should behave
- what should be marked unresolved instead of materialized

It should not act as pseudocode for downloading or file I/O.

### CLI responsibility

The CLI is the deterministic execution layer.

It must:

- initialize local dossier state from explicit identity inputs
- read a reviewed manifest
- create dossier directories
- fetch source files
- turn those files into near-original Markdown derivatives
- write dossier frontmatter
- enforce naming rules
- run duplicate checks
- report status and structural problems

It must not:

- discover candidate materials from the web on its own in v1
- infer company identity from ambiguous inputs
- call LLMs directly

## Directory layout

The dossier tree removes the extra `materials/` nesting and uses:

```text
dossier/{authority}/{document_type}/{year}/{disclosure_key}/
```

Examples:

```text
dossier/sec/10-k/2024/2024-11-01-0000320193-10-k/
  00-primary-10-k.md
  01-ex13-annual-report.md

dossier/sec/8-k/2026/2026-02-01-0000320193-8-k/
  00-primary-8-k.md
  01-ex99-1-press-release.md
  02-ex99-2-presentation.md

dossier/company/earnings-release/2026/2026-02-01-q1-results/
  00-earnings-release.md
  01-presentation.md
  02-transcript.md
```

Rules:

- The disclosure directory is the grouping unit.
- Sequence-prefixed filenames are mandatory within a disclosure directory.
- All files in a disclosure directory follow the same naming convention.
- The year segment is derived from the official publication date.

## Frontmatter schema

Dossier files use YAML frontmatter.

Minimum required fields:

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

Field meaning:

- `title`: official or best available official document title
- `source`: original file URL
- `author`: Obsidian-style authority link such as `[[sec.gov]]` or `[[apple.com]]`
- `published`: official publication date
- `created`: local materialization date
- `authority`: one of `sec`, `nasdaq`, `nyse`, `company`
- `document_type`: normalized dossier document type
- `disclosure_key`: stable grouping key for the enclosing disclosure directory

Recommended additional fields:

- `retrieved_at`
- `canonical_url`
- `source_channel`

## Dedupe and identity model

The dossier should avoid fetching the same material multiple times.

Document type is not identity.

Identity rules:

- SEC materials: identify by `accession_no + primary_document`
- NASDAQ materials: identify by `canonical_url + published`
- NYSE materials: identify by `canonical_url + published`
- Company materials: identify by `canonical_url + published`

Supporting rules:

- `content_hash` is a verification signal, not the primary identity key
- if identity matches and content is unchanged, skip as duplicate
- if identity matches and content changes, flag for review or version handling rather than silently overwrite
- if publication identity differs, treat as a new material

This supports the principle discussed in design review:

- avoid duplicate fetches
- keep separate materials separate
- never collapse different disclosures just because they share the same `document_type`

## Manifest contract

The manifest is the boundary between orchestration and deterministic execution.

The skill produces it. The CLI consumes it.

Each manifest record should include at least:

- `company_name`
- `ticker`
- `market`
- `authority`
- `source`
- `canonical_url`
- `author`
- `published`
- `document_type`
- `disclosure_key`
- `sequence`
- `suggested_filename`

Optional fields:

- `accession_no`
- `primary_document`
- `source_channel`
- `content_type`
- `notes`

The manifest must already reflect the orchestration judgment. The CLI should not need to infer
classification from scratch.

## CLI command definitions

### `llm-wiki-invest dossier init`

Purpose:

- initialize dossier state for the current single-company vault

Expected input:

- explicit identity values such as market, ticker, company name, CIK, exchange

Important boundary:

- this command does not discover identity itself
- it records already-confirmed identity for later deterministic execution

### `llm-wiki-invest dossier apply <manifest>`

Purpose:

- apply a reviewed manifest to the local dossier tree

Responsibilities:

- create disclosure directories
- fetch files
- materialize Markdown derivatives
- write frontmatter
- enforce naming
- perform duplicate checks
- skip confirmed duplicates
- report created, skipped, and unresolved items

### `llm-wiki-invest dossier status`

Purpose:

- report dossier coverage and state

Suggested output:

- material count
- disclosure count
- counts by authority
- counts by document type
- latest publication date
- unresolved count
- last apply time

### `llm-wiki-invest dossier check`

Purpose:

- validate dossier structure and frontmatter consistency

Suggested checks:

- required frontmatter exists
- `author` uses Obsidian-style links
- path matches authority/document_type/year/disclosure_key
- filenames use sequence prefixes
- directory contents are consistently named
- duplicate identity keys do not exist
- empty or malformed files are flagged

### Future narrow helper: `llm-wiki-invest dossier sec-index`

Not part of v1, but explicitly allowed as a future narrow CLI helper.

Purpose:

- fetch only structured SEC index data

Reason:

- this is a constrained deterministic helper and does not violate the orchestration boundary
- it is preferable to a generic CLI `discover` command

## End-to-end workflow

### Initial build

1. skill reads `template/us.md`
2. skill resolves company identity
3. skill inspects allowed discovery surfaces
4. skill chooses valid file-level materials
5. skill classifies materials and assigns disclosure groups
6. skill writes manifest
7. skill runs `dossier init`
8. skill runs `dossier apply <manifest>`
9. skill runs `dossier check`

### Incremental sync

1. skill re-runs discovery against allowed sources
2. skill compares candidate materials against known identity keys
3. skill writes a delta manifest
4. skill runs `dossier apply <delta-manifest>`
5. skill runs `dossier check`

## Why this design

This design preserves the project's existing philosophy while making dossier practical:

- the agent keeps the judgment-heavy work
- the CLI stays deterministic and testable
- the dossier tree remains read-only and auditable
- file-level materials remain grouped correctly by disclosure
- future market templates can extend the same architecture without turning the CLI into an LLM runtime
