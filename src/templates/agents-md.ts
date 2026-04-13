export function generateAgentsMd(wikiName: string, language: string): string {
  const lang = language === "zh" ? "Chinese" : "English";

  return `# ${wikiName} — Agent Instructions

This is an LLM Wiki — a persistent, evolving knowledge base maintained by AI agents.

## Architecture

\`\`\`
sources/     → Raw, immutable documents (articles, papers, notes, web clips)
wiki/        → LLM-maintained markdown pages with cross-references
schema.md    → Structure rules and page type definitions
purpose.md   → Wiki direction and intent
index.md     → Content catalog organized by category
log.md       → Append-only operation log
\`\`\`

## Core Principles

1. **Don't re-derive, compile.** Knowledge is processed once into wiki pages, not re-read on every query.
2. **Knowledge compounds.** Every valuable query result gets written back as a new wiki page.
3. **Cross-reference everything.** Use \`[[wikilinks]]\` liberally to build a connected knowledge graph.
4. **Preserve sources.** Never modify files in \`sources/\`. They are immutable evidence.
5. **Log everything.** Append a one-line entry to \`log.md\` after every operation.

## Wiki Page Format

Every wiki page must have YAML frontmatter:

\`\`\`markdown
---
title: Page Title
description: One-line summary of what this page covers
tags: [tag1, tag2]
sources: [sources/2024-01-15/article.md]
page_type: concept | entity | topic | insight
created: 2024-01-15
updated: 2024-01-15
---

Page content with [[wikilinks]] to related pages.
\`\`\`

## Wikilink Convention

Use Obsidian-style \`[[shortest-unique-name]]\` links:
- If filename is unique: \`[[machine-learning]]\`
- If ambiguous: \`[[concepts/machine-learning]]\`
- With alias: \`[[machine-learning|ML]]\`

## Default Language

Write wiki content in **${lang}** unless the source material is in another language.

## Available Skills

The following skills are available in \`.agents/skills/\`:

- **ingest** — Process source documents into wiki pages (two-step chain-of-thought)
- **query** — Search the wiki and synthesize answers (with knowledge compounding)
- **lint** — Health check and self-repair of the wiki
- **deep-research** — Web research to fill knowledge gaps

## CLI Commands

The \`llm-wiki\` CLI provides these utilities:

- \`llm-wiki search <query>\` — Hybrid search (BM25 + vector + graph)
- \`llm-wiki status\` — Health check: broken links, orphans, missing frontmatter
- \`llm-wiki graph\` — Build knowledge graph and generate insights
- \`llm-wiki index\` — List all wiki pages with metadata
- \`llm-wiki sync\` — Sync to DB9 (vector index + backup)

## Getting Started

If the wiki is empty, **do not start creating pages immediately**. First:
1. Read \`purpose.md\` and \`schema.md\` to understand the wiki's direction
2. Discuss with the user: What topics should the wiki cover? What structure?
3. Agree on naming conventions, directory organization, and page types
4. Only then begin ingesting sources and creating pages
`;
}
