#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";

// src/commands/init.ts
import {
  mkdirSync,
  writeFileSync,
  existsSync as existsSync2,
  symlinkSync
} from "fs";
import { join as join2 } from "path";

// src/config.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseToml } from "smol-toml";
var DEFAULT_CONFIG = {
  wiki: {
    name: "My Wiki",
    language: "en",
    template: "general"
  },
  db9: {
    enabled: false
  },
  search: {
    bm25_weight: 1,
    vector_weight: 1,
    graph_weight: 0.5
  },
  graph: {
    direct_link_weight: 3,
    source_overlap_weight: 4,
    adamic_adar_weight: 1.5,
    type_affinity_weight: 1,
    community_cohesion_threshold: 0.15
  }
};
function loadConfig(dir = process.cwd()) {
  const configPath = join(dir, "llm-wiki.toml");
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = readFileSync(configPath, "utf-8");
  const parsed = parseToml(raw);
  return {
    wiki: { ...DEFAULT_CONFIG.wiki, ...parsed.wiki },
    db9: { ...DEFAULT_CONFIG.db9, ...parsed.db9 },
    search: { ...DEFAULT_CONFIG.search, ...parsed.search },
    graph: { ...DEFAULT_CONFIG.graph, ...parsed.graph }
  };
}
function generateToml(config) {
  const lines = [];
  lines.push("[wiki]");
  lines.push(`name = "${config.wiki.name}"`);
  lines.push(`language = "${config.wiki.language}"`);
  lines.push(`template = "${config.wiki.template}"`);
  lines.push("");
  lines.push("[db9]");
  lines.push(`enabled = ${config.db9.enabled}`);
  if (config.db9.host) lines.push(`host = "${config.db9.host}"`);
  if (config.db9.database) lines.push(`database = "${config.db9.database}"`);
  lines.push("");
  lines.push("[search]");
  lines.push(`bm25_weight = ${config.search.bm25_weight}`);
  lines.push(`vector_weight = ${config.search.vector_weight}`);
  lines.push(`graph_weight = ${config.search.graph_weight}`);
  lines.push("");
  lines.push("[graph]");
  lines.push(`direct_link_weight = ${config.graph.direct_link_weight}`);
  lines.push(
    `source_overlap_weight = ${config.graph.source_overlap_weight}`
  );
  lines.push(`adamic_adar_weight = ${config.graph.adamic_adar_weight}`);
  lines.push(`type_affinity_weight = ${config.graph.type_affinity_weight}`);
  lines.push(
    `community_cohesion_threshold = ${config.graph.community_cohesion_threshold}`
  );
  return lines.join("\n") + "\n";
}

// src/templates/agents-md.ts
function generateAgentsMd(wikiName, language) {
  const lang = language === "zh" ? "Chinese" : "English";
  return `# ${wikiName} \u2014 Agent Instructions

This is an LLM Wiki \u2014 a persistent, evolving knowledge base maintained by AI agents.

## Architecture

\`\`\`
sources/     \u2192 Raw, immutable documents (articles, papers, notes, web clips)
wiki/        \u2192 LLM-maintained markdown pages with cross-references
schema.md    \u2192 Structure rules and page type definitions
purpose.md   \u2192 Wiki direction and intent
index.md     \u2192 Content catalog organized by category
log.md       \u2192 Append-only operation log
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

- **ingest** \u2014 Process source documents into wiki pages (two-step chain-of-thought)
- **query** \u2014 Search the wiki and synthesize answers (with knowledge compounding)
- **lint** \u2014 Health check and self-repair of the wiki
- **deep-research** \u2014 Web research to fill knowledge gaps

## CLI Commands

The \`llm-wiki\` CLI provides these utilities:

- \`llm-wiki search <query>\` \u2014 Hybrid search (BM25 + vector + graph)
- \`llm-wiki status\` \u2014 Health check: broken links, orphans, missing frontmatter
- \`llm-wiki graph\` \u2014 Build knowledge graph and generate insights
- \`llm-wiki index\` \u2014 List all wiki pages with metadata
- \`llm-wiki sync\` \u2014 Sync to DB9 (vector index + backup)

## Getting Started

If the wiki is empty, **do not start creating pages immediately**. First:
1. Read \`purpose.md\` and \`schema.md\` to understand the wiki's direction
2. Discuss with the user: What topics should the wiki cover? What structure?
3. Agree on naming conventions, directory organization, and page types
4. Only then begin ingesting sources and creating pages
`;
}

// src/templates/skill-ingest.ts
function generateIngestSkill() {
  return `# Skill: Ingest

Process source documents into structured wiki pages using a two-step chain-of-thought approach.

## When to Use

When the user provides new documents, articles, notes, or any source material to add to the wiki.

## Workflow

### Step 0: Preparation

1. Copy the source file to \`sources/YYYY-MM-DD/\` (use today's date)
2. Read \`purpose.md\` and \`schema.md\` to understand the wiki's direction and structure
3. Run \`llm-wiki index\` to see existing wiki pages
4. Read the source document thoroughly

### Step 1: Analysis (Chain-of-Thought)

Before creating any pages, write out your analysis:

1. **Key Entities**: List all named entities (people, organizations, tools, projects, etc.)
2. **Core Concepts**: Identify abstract concepts, theories, patterns, or principles
3. **Relationships**: How do these entities and concepts relate to each other?
4. **Existing Connections**: Which existing wiki pages does this source connect to?
5. **Contradictions**: Does this source contradict any existing wiki content?
6. **Knowledge Gaps**: What questions does this source raise that aren't answered?

### Step 2: Wiki Page Generation

Based on your analysis, create or update wiki pages:

1. **For each significant entity**: Create or update a page in \`wiki/entities/\`
2. **For each core concept**: Create or update a page in \`wiki/concepts/\`
3. **For broader topics**: Create or update a page in \`wiki/topics/\`
4. **For novel insights**: Create a page in \`wiki/insights/\`

Each page must have:
- Complete YAML frontmatter (title, description, tags, sources, page_type, created, updated)
- Clear, structured content
- \`[[wikilinks]]\` to related pages (both new and existing)
- Source attribution referencing files in \`sources/\`

### Step 3: Update Cross-References

1. Read existing pages that should link to the new content
2. Add \`[[wikilinks]]\` to those existing pages where relevant
3. Update \`index.md\` with new pages organized by category
4. Append a summary to \`log.md\`:
   \`\`\`
   YYYY-MM-DD HH:MM \u2014 Ingested: [source filename]. Created N new pages, updated M existing pages.
   \`\`\`

### Step 4: Sync

Run \`llm-wiki sync\` to update the vector index and backup.

## Quality Checklist

Before finishing, verify:
- [ ] Source file is in \`sources/YYYY-MM-DD/\`
- [ ] Every new page has complete frontmatter
- [ ] Every new page has at least 2 wikilinks to other pages
- [ ] Existing related pages have been updated with backlinks
- [ ] index.md is updated
- [ ] log.md has the operation entry
- [ ] No broken wikilinks (run \`llm-wiki status\` to check)

## Important Rules

- **Never modify source files** \u2014 they are immutable
- **Don't create stub pages** \u2014 every page should have substantive content
- **Prefer updating existing pages** over creating redundant new ones
- **Use the shortest unique wikilink form** (Obsidian convention)
- **One page per concept/entity** \u2014 avoid duplication
`;
}

// src/templates/skill-query.ts
function generateQuerySkill() {
  return `# Skill: Query

Search the wiki and synthesize answers. Valuable answers are written back as new wiki pages (knowledge compounding).

## When to Use

When the user asks a question about topics covered by (or related to) the wiki.

## Workflow

### Step 1: Search

1. Run \`llm-wiki search "<user's query>"\` to find relevant pages
2. Read the top 5-10 results in full
3. If results are insufficient, try alternative search terms
4. Check \`index.md\` for additional relevant pages not found by search

### Step 2: Graph Exploration

1. Run \`llm-wiki graph --json\` to see the knowledge graph
2. From the search hits, follow \`[[wikilinks]]\` to explore related pages (1-2 hops)
3. Check if any of the linked pages contain additional relevant information

### Step 3: Synthesize Answer

1. Combine information from all relevant pages
2. Cite sources using wiki page references: "According to [[page-name]], ..."
3. Note any contradictions between sources
4. Identify gaps \u2014 what the wiki doesn't cover that would be helpful

### Step 4: Knowledge Compounding

**If the synthesized answer contains novel insights, connections, or conclusions not already in the wiki:**

1. Create a new page in \`wiki/insights/\` with the synthesis
2. Include:
   - Complete frontmatter with all source pages listed
   - The synthesized answer as structured content
   - \`[[wikilinks]]\` to all referenced pages
   - Any new connections discovered during synthesis
3. Update referenced pages with backlinks to the new insight page
4. Update \`index.md\`
5. Append to \`log.md\`:
   \`\`\`
   YYYY-MM-DD HH:MM \u2014 Query: "[question]". Synthesized from N pages. Created insight: [page-name].
   \`\`\`
6. Run \`llm-wiki sync\`

**If the answer is straightforward and doesn't add new knowledge:**

Just answer the question with citations. Append to \`log.md\`:
\`\`\`
YYYY-MM-DD HH:MM \u2014 Query: "[question]". Answered from N pages. No new pages created.
\`\`\`

## Quality Standards

- Every claim must reference a wiki page or source
- Contradictions between sources must be explicitly noted
- Gaps in knowledge should be flagged as potential research topics
- New insight pages must add value beyond what individual pages contain

## Important Rules

- **Always search before answering** \u2014 don't rely on memory alone
- **Cite wiki pages, not raw sources** \u2014 the wiki is the compiled knowledge
- **Knowledge compounding is the goal** \u2014 every valuable exploration should leave the wiki richer
- **Don't create redundant pages** \u2014 check if an existing page covers the topic
`;
}

// src/templates/skill-lint.ts
function generateLintSkill() {
  return `# Skill: Lint

Health check and self-repair of the wiki. Identifies and fixes structural issues to maintain wiki quality.

## When to Use

- Periodically (recommended: after every 5-10 ingest operations)
- When the user asks to check wiki health
- Before major restructuring
- When \`llm-wiki status\` reports issues

## Workflow

### Step 1: Automated Checks

Run \`llm-wiki status\` and review the output:

1. **Broken links**: \`[[wikilinks]]\` pointing to nonexistent pages
2. **Duplicate filenames**: Pages with the same base filename (causes ambiguous links)
3. **Orphan pages**: Pages with no incoming links
4. **Missing frontmatter**: Pages lacking required fields (title, description, tags)
5. **Ambiguous links**: Links that could resolve to multiple pages

### Step 2: Graph Analysis

Run \`llm-wiki graph --insights\` and review:

1. **Low cohesion communities**: Groups of pages that aren't well connected internally
2. **Hub nodes**: Pages with too many connections (may need splitting)
3. **Knowledge gaps**: Isolated topics, missing bridge pages
4. **Unexpected connections**: Cross-community links worth investigating

### Step 3: Auto-Fix (Safe Repairs)

Fix these issues automatically:

#### Broken Links
- If a target page was renamed: update the link
- If a target page was deleted: remove the link and note in the content
- If a target page should exist but doesn't: create a stub with a TODO marker

#### Missing Frontmatter
- Add missing \`title\` (derive from filename)
- Add missing \`description\` (generate from first paragraph)
- Add missing \`tags\` (infer from content and directory)
- Add missing \`page_type\` (infer from directory: concepts/, entities/, etc.)
- Add \`created\` and \`updated\` dates

#### Orphan Pages
- Find existing pages that should link to the orphan (based on content similarity)
- Add \`[[wikilinks]]\` to those pages
- If the orphan is truly irrelevant, flag for human review

#### Duplicate Filenames
- Rename to include parent directory for disambiguation
- Update all references throughout the wiki

### Step 4: Flag for Human Review

Some issues require human judgment. Create a section in the lint output:

1. **Contradictions**: Two pages making conflicting claims
2. **Stale content**: Pages not updated in a long time but frequently referenced
3. **Overgrown pages**: Pages that are too long and should be split
4. **Questionable connections**: Links that seem incorrect or outdated

### Step 5: Update Log

Append to \`log.md\`:
\`\`\`
YYYY-MM-DD HH:MM \u2014 Lint: Fixed N broken links, M missing frontmatter, K orphan pages. Flagged L items for review.
\`\`\`

Run \`llm-wiki sync\` after fixes.

## Severity Levels

| Level | Action |
|-------|--------|
| **Critical** | Broken links, missing required frontmatter \u2014 auto-fix immediately |
| **Warning** | Orphan pages, low cohesion communities \u2014 auto-fix if safe |
| **Info** | Hub nodes, unexpected connections, knowledge gaps \u2014 report only |

## Important Rules

- **Fix, don't just report** \u2014 the goal is self-healing, not just diagnostics
- **Be conservative with deletions** \u2014 prefer fixing over removing content
- **Always preserve attribution** \u2014 when merging or restructuring, keep source references
- **Run status after fixes** \u2014 verify that fixes didn't introduce new issues
`;
}

// src/templates/skill-deep-research.ts
function generateDeepResearchSkill() {
  return `# Skill: Deep Research

Fill knowledge gaps by researching topics on the web and ingesting findings into the wiki.

## When to Use

- When graph insights reveal knowledge gaps
- When a query cannot be fully answered from existing wiki content
- When the user requests research on a specific topic
- When lint finds areas that need more coverage

## Workflow

### Step 1: Identify Research Target

1. Review the knowledge gap or research request
2. Run \`llm-wiki graph --insights\` to find related gaps
3. Read existing wiki pages on the topic to understand current coverage
4. Formulate specific research questions

### Step 2: Web Research

1. Use your web search capability to find authoritative sources
2. For each research question, search with multiple query formulations:
   - Direct question
   - Key terms and synonyms
   - Related concepts
3. Prioritize:
   - Primary sources (official documentation, papers, original reports)
   - Recent content (prefer up-to-date information)
   - Authoritative sources (known experts, reputable publications)

### Step 3: Collect and Save Sources

For each valuable source found:

1. Save the content to \`sources/YYYY-MM-DD/\` as a markdown file:
   \`\`\`markdown
   ---
   title: Article Title
   url: https://example.com/article
   retrieved: YYYY-MM-DD
   author: Author Name
   ---

   [Article content in markdown]
   \`\`\`
2. Name the file descriptively: \`topic-source-name.md\`

### Step 4: Ingest Research Results

Follow the **Ingest** skill workflow for each collected source:

1. Analyze the source (entities, concepts, relationships)
2. Create or update wiki pages
3. Cross-reference with existing content
4. Update index.md and log.md

### Step 5: Synthesize Research Summary

Create an insight page summarizing the research:

\`\`\`markdown
---
title: "Research: [Topic]"
description: Summary of deep research on [topic]
tags: [research, topic-tags]
sources: [list of all collected sources]
page_type: insight
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

## Research Questions
- [List of questions investigated]

## Key Findings
- [Synthesized findings with citations]

## New Connections
- [Relationships discovered between new and existing knowledge]

## Remaining Gaps
- [What still needs investigation]
\`\`\`

### Step 6: Update and Sync

1. Update \`index.md\` with all new pages
2. Append to \`log.md\`:
   \`\`\`
   YYYY-MM-DD HH:MM \u2014 Deep Research: "[topic]". Collected N sources, created M pages. Remaining gaps: [list].
   \`\`\`
3. Run \`llm-wiki sync\`

## Research Quality Standards

- **Verify claims across multiple sources** \u2014 don't trust single sources
- **Note conflicting information** \u2014 flag disagreements for human review
- **Distinguish fact from opinion** \u2014 mark opinions clearly
- **Include retrieval dates** \u2014 web content changes over time
- **Prefer depth over breadth** \u2014 thorough coverage of focused topics > shallow coverage of many

## Important Rules

- **Always save sources** \u2014 never create wiki pages from ephemeral web results without saving
- **Attribute everything** \u2014 every claim should trace back to a source
- **Don't over-research** \u2014 set a scope before starting and stick to it
- **Knowledge compounding** \u2014 connect new research to existing wiki knowledge
`;
}

// src/templates/schema-templates.ts
var templates = {
  research: {
    purpose: `# Purpose

This wiki serves as a **research knowledge base** \u2014 collecting, organizing, and synthesizing information from academic papers, technical reports, and other research sources.

## Goals
- Build a comprehensive understanding of the research landscape in the target domain
- Track key researchers, institutions, and their contributions
- Identify trends, open problems, and emerging directions
- Synthesize connections between different research threads

## Priorities
1. Accuracy and proper source attribution
2. Cross-referencing related work
3. Tracking the evolution of ideas over time
4. Identifying contradictions and open questions
`,
    schema: `# Schema

## Page Types

### entity
Pages about specific named things: researchers, institutions, tools, datasets, conferences.
- Directory: \`wiki/entities/\`
- Required: description of the entity, key contributions, relationships

### concept
Pages about abstract ideas, theories, methods, algorithms, or paradigms.
- Directory: \`wiki/concepts/\`
- Required: definition, background, key properties, applications

### topic
Broad survey pages covering a research area or theme.
- Directory: \`wiki/topics/\`
- Required: overview, key concepts, major works, open problems

### insight
Synthesized observations, comparisons, or novel connections.
- Directory: \`wiki/insights/\`
- Required: the insight, supporting evidence from wiki pages, implications

## Naming Convention
- Use kebab-case: \`transformer-architecture.md\`
- Be specific: \`attention-mechanism.md\` not \`attention.md\`
- For people: \`firstname-lastname.md\`

## Tags
Use hierarchical tags: \`[ml, nlp, transformers]\` from broad to specific.
`
  },
  reading: {
    purpose: `# Purpose

This wiki serves as a **reading knowledge base** \u2014 capturing and connecting ideas from books, articles, essays, and other reading material.

## Goals
- Extract and organize key ideas from everything read
- Build connections between ideas across different sources
- Create a personal intellectual framework that evolves over time
- Enable rapid retrieval of relevant knowledge when needed

## Priorities
1. Capturing the essence of ideas, not just summaries
2. Building unexpected connections between disparate sources
3. Personal commentary and critical analysis
4. Practical applicability of ideas
`,
    schema: `# Schema

## Page Types

### entity
Pages about authors, books, publications, or organizations.
- Directory: \`wiki/entities/\`
- Required: key works, main ideas, influence

### concept
Pages about ideas, frameworks, mental models, or principles.
- Directory: \`wiki/concepts/\`
- Required: definition, origin/source, applications, related concepts

### topic
Broad pages covering themes that span multiple sources.
- Directory: \`wiki/topics/\`
- Required: overview, key ideas from multiple sources, synthesis

### insight
Personal observations, connections between ideas, or original thoughts.
- Directory: \`wiki/insights/\`
- Required: the insight, supporting evidence, practical implications

## Naming Convention
- Use kebab-case: \`antifragility.md\`
- For books: \`book-title.md\`
- For authors: \`firstname-lastname.md\`

## Tags
Use thematic tags: \`[psychology, decision-making, biases]\`
`
  },
  business: {
    purpose: `# Purpose

This wiki serves as a **business knowledge base** \u2014 organizing market intelligence, competitive analysis, strategic insights, and operational knowledge.

## Goals
- Maintain up-to-date competitive landscape analysis
- Track industry trends and market dynamics
- Capture strategic decisions and their rationale
- Build institutional knowledge that compounds over time

## Priorities
1. Timeliness \u2014 business knowledge has a short shelf life
2. Actionability \u2014 insights should drive decisions
3. Competitive awareness \u2014 track what competitors are doing
4. Strategic coherence \u2014 connect tactical details to strategy
`,
    schema: `# Schema

## Page Types

### entity
Pages about companies, products, people, or markets.
- Directory: \`wiki/entities/\`
- Required: overview, key metrics, recent developments

### concept
Pages about business models, strategies, frameworks, or methodologies.
- Directory: \`wiki/concepts/\`
- Required: definition, examples, applicability

### topic
Broad pages covering market segments, trends, or strategic themes.
- Directory: \`wiki/topics/\`
- Required: overview, key players, trends, outlook

### insight
Strategic observations, competitive analysis, or market intelligence.
- Directory: \`wiki/insights/\`
- Required: the insight, evidence, strategic implications, recommended actions

## Naming Convention
- Use kebab-case: \`market-opportunity-ai-agents.md\`
- For companies: \`company-name.md\`
- For products: \`product-name.md\`

## Tags
Use domain tags: \`[ai, saas, enterprise, competitive-analysis]\`
`
  },
  general: {
    purpose: `# Purpose

This wiki serves as a **general knowledge base** \u2014 organizing information on any topic of interest.

## Goals
- Build a comprehensive, interconnected knowledge repository
- Capture and organize information from diverse sources
- Enable rapid retrieval and synthesis of knowledge
- Grow the knowledge base continuously through exploration and research

## Priorities
1. Organization and discoverability
2. Cross-referencing and connection building
3. Accuracy and source attribution
4. Continuous growth and maintenance
`,
    schema: `# Schema

## Page Types

### entity
Pages about specific named things: people, organizations, tools, places.
- Directory: \`wiki/entities/\`
- Required: description, key attributes, relationships

### concept
Pages about abstract ideas, principles, methods, or patterns.
- Directory: \`wiki/concepts/\`
- Required: definition, context, key properties, examples

### topic
Broad survey pages covering an area or theme.
- Directory: \`wiki/topics/\`
- Required: overview, key points, related concepts

### insight
Synthesized observations or novel connections between existing knowledge.
- Directory: \`wiki/insights/\`
- Required: the insight, supporting evidence, implications

## Naming Convention
- Use kebab-case: \`topic-name.md\`
- Be specific and descriptive
- Avoid abbreviations unless widely known

## Tags
Use descriptive tags from broad to specific: \`[domain, sub-domain, specific-topic]\`
`
  }
};
function getTemplate(name) {
  return templates[name] || templates.general;
}

// src/db.ts
var SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS wiki_index (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  page_type TEXT,
  content_hash TEXT NOT NULL,
  content_vec VECTOR(1024),
  tags TEXT[],
  source_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wiki_vec_idx ON wiki_index
  USING hnsw (content_vec vector_cosine_ops);

CREATE TABLE IF NOT EXISTS wiki_page_sources (
  page_slug TEXT REFERENCES wiki_index(slug) ON DELETE CASCADE,
  source_path TEXT NOT NULL,
  PRIMARY KEY (page_slug, source_path)
);

CREATE TABLE IF NOT EXISTS wiki_graph_edges (
  source_slug TEXT,
  target_slug TEXT,
  signal_type TEXT NOT NULL,
  weight REAL NOT NULL,
  PRIMARY KEY (source_slug, target_slug, signal_type)
);
`;
async function createDb9Client(projectDir) {
  const config = loadConfig(projectDir);
  if (!config.db9.enabled) return null;
  try {
    const { createDb9Client: create } = await import("get-db9");
    const client = create();
    let dbId;
    const dbName = config.db9.database || "llm-wiki";
    try {
      const dbs = await client.databases.list();
      const existing = dbs.find(
        (db) => db.name === dbName
      );
      if (existing) {
        dbId = existing.id;
      } else {
        const created = await client.databases.create({ name: dbName });
        dbId = created.id;
      }
    } catch (err) {
      console.error("Failed to connect to DB9:", err);
      return null;
    }
    return {
      async sql(query) {
        return client.databases.sql(dbId, query);
      },
      async close() {
      }
    };
  } catch (err) {
    console.error("DB9 SDK not available:", err);
    return null;
  }
}
async function initDb9Schema(client) {
  const statements = SCHEMA_SQL.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  for (const stmt of statements) {
    await client.sql(stmt + ";");
  }
}
async function upsertWikiPage(client, slug, title, description, pageType, contentHash2, tags, sourceCount, content) {
  const escapedSlug = slug.replace(/'/g, "''");
  const escapedTitle = title.replace(/'/g, "''");
  const escapedDesc = description.replace(/'/g, "''");
  const escapedType = pageType.replace(/'/g, "''");
  const escapedContent = content.replace(/'/g, "''");
  const tagsArray = tags.map((t) => `'${t.replace(/'/g, "''")}'`).join(",");
  await client.sql(`
    INSERT INTO wiki_index (slug, title, description, page_type, content_hash, content_vec, tags, source_count, updated_at)
    VALUES (
      '${escapedSlug}',
      '${escapedTitle}',
      '${escapedDesc}',
      '${escapedType}',
      '${contentHash2}',
      embedding('${escapedTitle} ${escapedDesc} ${escapedContent}'),
      ARRAY[${tagsArray}]::TEXT[],
      ${sourceCount},
      NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      page_type = EXCLUDED.page_type,
      content_hash = EXCLUDED.content_hash,
      content_vec = EXCLUDED.content_vec,
      tags = EXCLUDED.tags,
      source_count = EXCLUDED.source_count,
      updated_at = NOW();
  `);
}
async function vectorSearch(client, query, limit = 10) {
  const escapedQuery = query.replace(/'/g, "''");
  const result = await client.sql(`
    SELECT slug, 1 - (content_vec <=> embedding('${escapedQuery}')) AS similarity
    FROM wiki_index
    WHERE content_vec IS NOT NULL
    ORDER BY content_vec <=> embedding('${escapedQuery}')
    LIMIT ${limit};
  `);
  const scores = /* @__PURE__ */ new Map();
  for (const row of result.rows) {
    scores.set(row[0], row[1]);
  }
  return scores;
}
async function deleteWikiPage(client, slug) {
  const escapedSlug = slug.replace(/'/g, "''");
  await client.sql(
    `DELETE FROM wiki_index WHERE slug = '${escapedSlug}';`
  );
}
async function updatePageSources(client, slug, sources) {
  const escapedSlug = slug.replace(/'/g, "''");
  await client.sql(
    `DELETE FROM wiki_page_sources WHERE page_slug = '${escapedSlug}';`
  );
  for (const src of sources) {
    const escapedSrc = src.replace(/'/g, "''");
    await client.sql(`
      INSERT INTO wiki_page_sources (page_slug, source_path)
      VALUES ('${escapedSlug}', '${escapedSrc}')
      ON CONFLICT DO NOTHING;
    `);
  }
}

// src/commands/init.ts
async function initCommand(options) {
  const projectDir = process.cwd();
  if (existsSync2(join2(projectDir, "llm-wiki.toml"))) {
    console.error("Error: This directory is already an LLM Wiki project.");
    process.exit(1);
  }
  console.log(`Initializing LLM Wiki: "${options.name}" (${options.template} template)`);
  const dirs = [
    "wiki/concepts",
    "wiki/entities",
    "wiki/topics",
    "wiki/insights",
    "sources",
    ".agents/skills",
    ".llm-wiki"
  ];
  for (const dir of dirs) {
    mkdirSync(join2(projectDir, dir), { recursive: true });
  }
  const config = {
    wiki: {
      name: options.name,
      language: options.language,
      template: options.template
    },
    db9: {
      enabled: !!options.db9
    },
    search: {
      bm25_weight: 1,
      vector_weight: 1,
      graph_weight: 0.5
    },
    graph: {
      direct_link_weight: 3,
      source_overlap_weight: 4,
      adamic_adar_weight: 1.5,
      type_affinity_weight: 1,
      community_cohesion_threshold: 0.15
    }
  };
  writeFileSync(
    join2(projectDir, "llm-wiki.toml"),
    generateToml(config),
    "utf-8"
  );
  console.log("  Created llm-wiki.toml");
  const template = getTemplate(options.template);
  writeFileSync(join2(projectDir, "purpose.md"), template.purpose, "utf-8");
  console.log("  Created purpose.md");
  writeFileSync(join2(projectDir, "schema.md"), template.schema, "utf-8");
  console.log("  Created schema.md");
  const indexContent = `# ${options.name} \u2014 Index

## Concepts

<!-- Add concept pages here -->

## Entities

<!-- Add entity pages here -->

## Topics

<!-- Add topic pages here -->

## Insights

<!-- Add insight pages here -->
`;
  writeFileSync(join2(projectDir, "index.md"), indexContent, "utf-8");
  console.log("  Created index.md");
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " ");
  const logContent = `# ${options.name} \u2014 Operation Log

${now} \u2014 Wiki initialized with "${options.template}" template.
`;
  writeFileSync(join2(projectDir, "log.md"), logContent, "utf-8");
  console.log("  Created log.md");
  writeFileSync(
    join2(projectDir, ".agents", "AGENTS.md"),
    generateAgentsMd(options.name, options.language),
    "utf-8"
  );
  console.log("  Created .agents/AGENTS.md");
  const skills = [
    { name: "ingest.md", content: generateIngestSkill() },
    { name: "query.md", content: generateQuerySkill() },
    { name: "lint.md", content: generateLintSkill() },
    { name: "deep-research.md", content: generateDeepResearchSkill() }
  ];
  for (const skill of skills) {
    writeFileSync(
      join2(projectDir, ".agents", "skills", skill.name),
      skill.content,
      "utf-8"
    );
    console.log(`  Created .agents/skills/${skill.name}`);
  }
  const claudeSkillsDir = join2(projectDir, ".claude");
  mkdirSync(claudeSkillsDir, { recursive: true });
  const symlinkTarget = join2("..", ".agents", "skills");
  const symlinkPath = join2(claudeSkillsDir, "skills");
  if (!existsSync2(symlinkPath)) {
    try {
      symlinkSync(symlinkTarget, symlinkPath);
      console.log("  Created .claude/skills -> .agents/skills");
    } catch {
      console.log("  Note: Could not create .claude/skills symlink");
    }
  }
  const gitignore = `.llm-wiki/
node_modules/
`;
  writeFileSync(join2(projectDir, ".gitignore"), gitignore, "utf-8");
  console.log("  Created .gitignore");
  if (options.db9) {
    console.log("\nInitializing DB9...");
    const client = await createDb9Client(projectDir);
    if (client) {
      await initDb9Schema(client);
      await client.close();
      console.log("  DB9 schema initialized");
    } else {
      console.log("  Warning: Could not connect to DB9. Skipping DB9 setup.");
      console.log("  You can run 'llm-wiki sync' later to initialize.");
    }
  }
  console.log("\n\u2713 LLM Wiki initialized successfully!");
  console.log("\nNext steps:");
  console.log("  1. Review purpose.md and schema.md");
  console.log("  2. Add source documents to sources/");
  console.log("  3. Use the ingest skill to process them into wiki pages");
  console.log(`  4. Run 'llm-wiki status' to check wiki health`);
}

// src/lib/wiki.ts
import { readFileSync as readFileSync2, readdirSync, statSync, existsSync as existsSync3 } from "fs";
import { join as join3, relative, basename, extname } from "path";

// src/utils/frontmatter.ts
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
var FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
function parseFrontmatter(raw) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return {
      frontmatter: { title: "" },
      content: raw,
      raw
    };
  }
  const yamlStr = match[1];
  const content = match[2];
  let frontmatter;
  try {
    frontmatter = parseYaml(yamlStr);
    if (!frontmatter || typeof frontmatter !== "object") {
      frontmatter = { title: "" };
    }
  } catch {
    frontmatter = { title: "" };
  }
  return { frontmatter, content, raw };
}

// src/utils/hash.ts
import { createHash } from "crypto";
function contentHash(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// src/lib/wiki.ts
var WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
function extractWikilinks(content) {
  const links = [];
  let match;
  const re = new RegExp(WIKILINK_RE.source, "g");
  while ((match = re.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return [...new Set(links)];
}
function pathToSlug(relativePath) {
  return relativePath.replace(/\.md$/, "").replace(/\\/g, "/").replace(/\s+/g, "-").toLowerCase();
}
function collectMarkdownFiles(dir) {
  const files = [];
  if (!existsSync3(dir)) return files;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join3(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      files.push(fullPath);
    }
  }
  return files;
}
function collectAllFiles(dir) {
  const files = [];
  if (!existsSync3(dir)) return files;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join3(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectAllFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}
function loadWikiPages(projectDir) {
  const wikiDir = join3(projectDir, "wiki");
  const files = collectMarkdownFiles(wikiDir);
  return files.map((filePath) => {
    const raw = readFileSync2(filePath, "utf-8");
    const parsed = parseFrontmatter(raw);
    const relPath = relative(wikiDir, filePath);
    const stat = statSync(filePath);
    return {
      slug: pathToSlug(relPath),
      path: filePath,
      relativePath: relPath,
      frontmatter: parsed.frontmatter,
      content: parsed.content,
      raw,
      hash: contentHash(raw),
      wikilinks: extractWikilinks(parsed.content),
      mtime: stat.mtimeMs
    };
  });
}
function loadSourceFiles(projectDir) {
  const sourcesDir = join3(projectDir, "sources");
  const files = collectAllFiles(sourcesDir);
  return files.map((filePath) => {
    const stat = statSync(filePath);
    return {
      path: filePath,
      relativePath: relative(sourcesDir, filePath),
      mtime: stat.mtimeMs,
      size: stat.size
    };
  });
}
function resolveWikilink(link, pages) {
  const normalizedLink = link.toLowerCase().replace(/\s+/g, "-");
  const exact = pages.find((p) => p.slug === normalizedLink);
  if (exact) return exact;
  const baseLink = basename(normalizedLink);
  const matches = pages.filter(
    (p) => basename(p.slug) === baseLink
  );
  if (matches.length === 1) return matches[0];
  const partialMatches = pages.filter((p) => p.slug.endsWith(normalizedLink));
  if (partialMatches.length === 1) return partialMatches[0];
  return void 0;
}
function findDuplicateFilenames(pages) {
  const nameMap = /* @__PURE__ */ new Map();
  for (const page of pages) {
    const name = basename(page.slug);
    const arr = nameMap.get(name) || [];
    arr.push(page);
    nameMap.set(name, arr);
  }
  const duplicates = /* @__PURE__ */ new Map();
  for (const [name, group] of nameMap) {
    if (group.length > 1) {
      duplicates.set(name, group);
    }
  }
  return duplicates;
}
function findBrokenLinks(pages) {
  const broken = [];
  for (const page of pages) {
    for (const link of page.wikilinks) {
      if (!resolveWikilink(link, pages)) {
        broken.push({ page, link });
      }
    }
  }
  return broken;
}
function findAmbiguousLinks(pages) {
  const ambiguous = [];
  for (const page of pages) {
    for (const link of page.wikilinks) {
      const normalizedLink = link.toLowerCase().replace(/\s+/g, "-");
      const baseLink = basename(normalizedLink);
      const matches = pages.filter((p) => basename(p.slug) === baseLink);
      if (matches.length > 1) {
        ambiguous.push({ page, link, matches });
      }
    }
  }
  return ambiguous;
}
function findOrphanPages(pages) {
  const linkedSlugs = /* @__PURE__ */ new Set();
  for (const page of pages) {
    for (const link of page.wikilinks) {
      const target = resolveWikilink(link, pages);
      if (target) {
        linkedSlugs.add(target.slug);
      }
    }
  }
  return pages.filter(
    (p) => !linkedSlugs.has(p.slug) && // index and log are special pages, not orphans
    p.slug !== "index" && p.slug !== "log"
  );
}
function findMissingFrontmatter(pages) {
  const results = [];
  const requiredFields = ["title", "description", "tags"];
  for (const page of pages) {
    const missing = [];
    for (const field of requiredFields) {
      const value = page.frontmatter[field];
      if (value === void 0 || value === null || value === "") {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      results.push({ page, missing });
    }
  }
  return results;
}

// src/lib/sync-state.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync2, existsSync as existsSync4, mkdirSync as mkdirSync2 } from "fs";
import { join as join4, dirname } from "path";
var EMPTY_STATE = {
  lastSyncAt: null,
  wikiFiles: {},
  sourceFiles: {}
};
function getSyncStatePath(projectDir) {
  return join4(projectDir, ".llm-wiki", "sync-state.json");
}
function loadSyncState(projectDir) {
  const path = getSyncStatePath(projectDir);
  if (!existsSync4(path)) return { ...EMPTY_STATE };
  try {
    const raw = readFileSync3(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { ...EMPTY_STATE };
  }
}
function saveSyncState(projectDir, state) {
  const path = getSyncStatePath(projectDir);
  const dir = dirname(path);
  if (!existsSync4(dir)) {
    mkdirSync2(dir, { recursive: true });
  }
  writeFileSync2(path, JSON.stringify(state, null, 2), "utf-8");
}

// src/commands/sync.ts
async function syncCommand(options) {
  const projectDir = process.cwd();
  const config = loadConfig(projectDir);
  if (!config.db9.enabled) {
    console.log(
      "DB9 is not enabled. Set db9.enabled = true in llm-wiki.toml to use sync."
    );
    return;
  }
  const client = await createDb9Client(projectDir);
  if (!client) {
    console.error("Failed to connect to DB9.");
    process.exit(1);
  }
  try {
    await initDb9Schema(client);
    const pages = loadWikiPages(projectDir);
    const sources = loadSourceFiles(projectDir);
    const prevState = loadSyncState(projectDir);
    const isFullSync = options.full || !prevState.lastSyncAt;
    console.log(
      `
\u{1F504} ${isFullSync ? "Full" : "Incremental"} sync to DB9...
`
    );
    let upserted = 0;
    let deleted = 0;
    let skipped = 0;
    const currentSlugs = new Set(pages.map((p) => p.slug));
    for (const page of pages) {
      const prev = prevState.wikiFiles[page.relativePath];
      if (!isFullSync && prev && prev.hash === page.hash && prev.mtime === page.mtime) {
        skipped++;
        continue;
      }
      await upsertWikiPage(
        client,
        page.slug,
        page.frontmatter.title || page.slug,
        page.frontmatter.description || "",
        page.frontmatter.page_type || "",
        page.hash,
        page.frontmatter.tags || [],
        (page.frontmatter.sources || []).length,
        page.content
      );
      if (page.frontmatter.sources) {
        await updatePageSources(client, page.slug, page.frontmatter.sources);
      }
      upserted++;
    }
    const prevSlugs = new Set(
      Object.keys(prevState.wikiFiles).map(
        (p) => p.replace(/\.md$/, "").replace(/\\/g, "/").replace(/\s+/g, "-").toLowerCase()
      )
    );
    for (const slug of prevSlugs) {
      if (!currentSlugs.has(slug)) {
        await deleteWikiPage(client, slug);
        deleted++;
      }
    }
    const newState = {
      lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
      wikiFiles: {},
      sourceFiles: {}
    };
    for (const page of pages) {
      newState.wikiFiles[page.relativePath] = {
        hash: page.hash,
        mtime: page.mtime
      };
    }
    for (const source of sources) {
      newState.sourceFiles[source.relativePath] = {
        mtime: source.mtime
      };
    }
    saveSyncState(projectDir, newState);
    console.log(`  Upserted: ${upserted}`);
    console.log(`  Deleted:  ${deleted}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`
\u2713 Sync complete.`);
  } finally {
    await client.close();
  }
}

// src/lib/search.ts
var k1 = 1.2;
var b = 0.75;
function tokenize(text) {
  const tokens = [];
  const normalized = text.toLowerCase();
  const latinTokens = normalized.match(/[a-z0-9_]+/g) || [];
  tokens.push(...latinTokens);
  const cjkChars = normalized.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g);
  if (cjkChars && cjkChars.length >= 2) {
    tokens.push(...cjkChars);
    const cjkStr = cjkChars.join("");
    for (let i = 0; i < cjkStr.length - 1; i++) {
      tokens.push(cjkStr.slice(i, i + 2));
    }
  } else if (cjkChars) {
    tokens.push(...cjkChars);
  }
  return tokens;
}
function buildBM25Index(pages) {
  const invertedIndex = /* @__PURE__ */ new Map();
  const docLengths = /* @__PURE__ */ new Map();
  let totalLength = 0;
  for (const page of pages) {
    const text = `${page.frontmatter.title || ""} ${page.frontmatter.description || ""} ${(page.frontmatter.tags || []).join(" ")} ${page.content}`;
    const tokens = tokenize(text);
    docLengths.set(page.slug, tokens.length);
    totalLength += tokens.length;
    const termFreq = /* @__PURE__ */ new Map();
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }
    for (const [term, freq] of termFreq) {
      if (!invertedIndex.has(term)) {
        invertedIndex.set(term, /* @__PURE__ */ new Map());
      }
      invertedIndex.get(term).set(page.slug, freq);
    }
  }
  return {
    invertedIndex,
    docLengths,
    avgDocLength: pages.length > 0 ? totalLength / pages.length : 0,
    docCount: pages.length
  };
}
function searchBM25(query, index) {
  const queryTokens = tokenize(query);
  const scores = /* @__PURE__ */ new Map();
  for (const term of queryTokens) {
    const postings = index.invertedIndex.get(term);
    if (!postings) continue;
    const df = postings.size;
    const idf = Math.log(1 + (index.docCount - df + 0.5) / (df + 0.5));
    for (const [slug, tf] of postings) {
      const dl = index.docLengths.get(slug) || 0;
      const normalizedTf = tf * (k1 + 1) / (tf + k1 * (1 - b + b * (dl / index.avgDocLength)));
      const score = idf * normalizedTf;
      scores.set(slug, (scores.get(slug) || 0) + score);
    }
  }
  return scores;
}
function graphExpand(hitSlugs, graph, hops = 1) {
  const scores = /* @__PURE__ */ new Map();
  let frontier = hitSlugs;
  for (let hop = 0; hop < hops; hop++) {
    const nextFrontier = /* @__PURE__ */ new Set();
    const decay = 1 / (hop + 2);
    for (const slug of frontier) {
      const neighbors = graph.adjacency.get(slug);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (hitSlugs.has(neighbor)) continue;
        const key = slug < neighbor ? `${slug}::${neighbor}` : `${neighbor}::${slug}`;
        const edge = graph.edges.get(key);
        const edgeWeight = edge ? edge.weight : 1;
        const score = edgeWeight * decay;
        scores.set(neighbor, Math.max(scores.get(neighbor) || 0, score));
        nextFrontier.add(neighbor);
      }
    }
    frontier = nextFrontier;
  }
  return scores;
}
var RRF_K = 60;
function reciprocalRankFusion(rankedLists) {
  const fusedScores = /* @__PURE__ */ new Map();
  for (const { scores, weight } of rankedLists) {
    const sorted = [...scores.entries()].sort((a, b2) => b2[1] - a[1]);
    for (let rank = 0; rank < sorted.length; rank++) {
      const [slug] = sorted[rank];
      const rrfScore = weight / (RRF_K + rank + 1);
      fusedScores.set(slug, (fusedScores.get(slug) || 0) + rrfScore);
    }
  }
  return fusedScores;
}
function hybridSearch(query, pages, bm25Index, graph, config, vectorScores) {
  const bm25Scores = searchBM25(query, bm25Index);
  const vecScores = vectorScores || /* @__PURE__ */ new Map();
  let graphScores = /* @__PURE__ */ new Map();
  if (graph) {
    const hitSlugs = /* @__PURE__ */ new Set([...bm25Scores.keys(), ...vecScores.keys()]);
    graphScores = graphExpand(hitSlugs, graph, 2);
  }
  const rankedLists = [
    { scores: bm25Scores, weight: config.search.bm25_weight }
  ];
  if (vecScores.size > 0) {
    rankedLists.push({ scores: vecScores, weight: config.search.vector_weight });
  }
  if (graphScores.size > 0) {
    rankedLists.push({
      scores: graphScores,
      weight: config.search.graph_weight
    });
  }
  const fusedScores = reciprocalRankFusion(rankedLists);
  const pageMap = new Map(pages.map((p) => [p.slug, p]));
  const results = [];
  for (const [slug, score] of fusedScores) {
    const page = pageMap.get(slug);
    if (!page) continue;
    const snippet = page.content.replace(/^#+\s+.*$/m, "").replace(/\n+/g, " ").trim().slice(0, 200);
    results.push({
      slug,
      title: page.frontmatter.title || slug,
      score,
      scores: {
        bm25: bm25Scores.get(slug) || 0,
        vector: vecScores.get(slug) || 0,
        graph: graphScores.get(slug) || 0
      },
      snippet
    });
  }
  return results.sort((a, b2) => b2.score - a.score);
}

// src/lib/graph.ts
function edgeKey(a, b2) {
  return a < b2 ? `${a}::${b2}` : `${b2}::${a}`;
}
function buildGraph(pages, config) {
  const nodes = /* @__PURE__ */ new Map();
  const edges = /* @__PURE__ */ new Map();
  const adjacency = /* @__PURE__ */ new Map();
  for (const page of pages) {
    nodes.set(page.slug, {
      slug: page.slug,
      title: page.frontmatter.title || page.slug,
      pageType: page.frontmatter.page_type,
      tags: page.frontmatter.tags || [],
      degree: 0
    });
    adjacency.set(page.slug, /* @__PURE__ */ new Set());
  }
  const weights = config.graph;
  for (const page of pages) {
    for (const link of page.wikilinks) {
      const target = resolveWikilink(link, pages);
      if (target && target.slug !== page.slug) {
        const key = edgeKey(page.slug, target.slug);
        const edge = edges.get(key) || createEdge(page.slug, target.slug);
        edge.signals.directLink += weights.direct_link_weight;
        edges.set(key, edge);
        adjacency.get(page.slug).add(target.slug);
        adjacency.get(target.slug).add(page.slug);
      }
    }
  }
  const sourceToPages = /* @__PURE__ */ new Map();
  for (const page of pages) {
    const sources = page.frontmatter.sources || [];
    for (const src of sources) {
      const arr = sourceToPages.get(src) || [];
      arr.push(page.slug);
      sourceToPages.set(src, arr);
    }
  }
  for (const [, pageSlugs] of sourceToPages) {
    if (pageSlugs.length < 2) continue;
    for (let i = 0; i < pageSlugs.length; i++) {
      for (let j = i + 1; j < pageSlugs.length; j++) {
        const key = edgeKey(pageSlugs[i], pageSlugs[j]);
        const edge = edges.get(key) || createEdge(pageSlugs[i], pageSlugs[j]);
        edge.signals.sourceOverlap += weights.source_overlap_weight;
        edges.set(key, edge);
        adjacency.get(pageSlugs[i]).add(pageSlugs[j]);
        adjacency.get(pageSlugs[j]).add(pageSlugs[i]);
      }
    }
  }
  const slugs = [...nodes.keys()];
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const a = slugs[i];
      const b2 = slugs[j];
      const neighborsA = adjacency.get(a);
      const neighborsB = adjacency.get(b2);
      let adamicAdar = 0;
      for (const common of neighborsA) {
        if (neighborsB.has(common)) {
          const degree = adjacency.get(common).size;
          if (degree > 1) {
            adamicAdar += 1 / Math.log2(degree);
          }
        }
      }
      if (adamicAdar > 0) {
        const key = edgeKey(a, b2);
        const edge = edges.get(key) || createEdge(a, b2);
        edge.signals.adamicAdar += adamicAdar * weights.adamic_adar_weight;
        edges.set(key, edge);
        adjacency.get(a).add(b2);
        adjacency.get(b2).add(a);
      }
    }
  }
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const a = nodes.get(slugs[i]);
      const b2 = nodes.get(slugs[j]);
      if (a.pageType && b2.pageType && a.pageType === b2.pageType) {
        const key = edgeKey(slugs[i], slugs[j]);
        const edge = edges.get(key) || createEdge(slugs[i], slugs[j]);
        edge.signals.typeAffinity += weights.type_affinity_weight;
        edges.set(key, edge);
      }
    }
  }
  for (const edge of edges.values()) {
    edge.weight = edge.signals.directLink + edge.signals.sourceOverlap + edge.signals.adamicAdar + edge.signals.typeAffinity;
  }
  for (const [slug] of nodes) {
    const neighbors = adjacency.get(slug);
    nodes.get(slug).degree = neighbors.size;
  }
  return { nodes, edges, adjacency };
}
function createEdge(source, target) {
  return {
    source: source < target ? source : target,
    target: source < target ? target : source,
    weight: 0,
    signals: {
      directLink: 0,
      sourceOverlap: 0,
      adamicAdar: 0,
      typeAffinity: 0
    }
  };
}
function findHubs(graph, topN = 10) {
  return [...graph.nodes.values()].sort((a, b2) => b2.degree - a.degree).slice(0, topN);
}
function findStrongestEdges(graph, topN = 10) {
  return [...graph.edges.values()].sort((a, b2) => b2.weight - a.weight).slice(0, topN);
}
function graphToJSON(graph) {
  return {
    nodes: [...graph.nodes.values()],
    edges: [...graph.edges.values()]
  };
}

// src/commands/search.ts
async function searchCommand(query, options) {
  const projectDir = process.cwd();
  const config = loadConfig(projectDir);
  const limit = parseInt(options.limit, 10) || 10;
  const pages = loadWikiPages(projectDir);
  if (pages.length === 0) {
    console.log("No wiki pages found. Run ingest to add content.");
    return;
  }
  const bm25Index = buildBM25Index(pages);
  const graph = buildGraph(pages, config);
  let vecScores;
  if (config.db9.enabled) {
    const client = await createDb9Client(projectDir);
    if (client) {
      try {
        vecScores = await vectorSearch(client, query, limit * 2);
      } catch {
      }
      await client.close();
    }
  }
  const results = hybridSearch(
    query,
    pages,
    bm25Index,
    graph,
    config,
    vecScores
  ).slice(0, limit);
  if (results.length === 0) {
    console.log(`No results found for: "${query}"`);
    return;
  }
  if (options.format === "json") {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  console.log(`
\u{1F50D} Search results for: "${query}" (${results.length} results)
`);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(
      `  ${i + 1}. ${r.title} (${r.slug})`
    );
    console.log(
      `     Score: ${r.score.toFixed(4)} [BM25: ${r.scores.bm25.toFixed(3)}, Vec: ${r.scores.vector.toFixed(3)}, Graph: ${r.scores.graph.toFixed(3)}]`
    );
    if (r.snippet) {
      console.log(`     ${r.snippet.slice(0, 100)}...`);
    }
    console.log("");
  }
}

// src/commands/index.ts
async function indexCommand(options) {
  const projectDir = process.cwd();
  let pages = loadWikiPages(projectDir);
  if (pages.length === 0) {
    console.log("No wiki pages found.");
    return;
  }
  if (options.tag) {
    pages = pages.filter(
      (p) => (p.frontmatter.tags || []).includes(options.tag)
    );
  }
  if (options.type) {
    pages = pages.filter((p) => p.frontmatter.page_type === options.type);
  }
  pages.sort(
    (a, b2) => (a.frontmatter.title || a.slug).localeCompare(
      b2.frontmatter.title || b2.slug
    )
  );
  if (options.format === "json") {
    const data = pages.map((p) => ({
      slug: p.slug,
      title: p.frontmatter.title || p.slug,
      description: p.frontmatter.description || "",
      tags: p.frontmatter.tags || [],
      page_type: p.frontmatter.page_type || "",
      sources: p.frontmatter.sources || [],
      wikilinks: p.wikilinks.length,
      updated: p.frontmatter.updated || ""
    }));
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(`
\u{1F4DA} Wiki Index (${pages.length} pages)
`);
  const groups = /* @__PURE__ */ new Map();
  for (const page of pages) {
    const type = page.frontmatter.page_type || "untyped";
    const arr = groups.get(type) || [];
    arr.push(page);
    groups.set(type, arr);
  }
  for (const [type, groupPages] of groups) {
    console.log(`\u2500\u2500\u2500 ${type} (${groupPages.length}) \u2500\u2500\u2500`);
    for (const page of groupPages) {
      const title = page.frontmatter.title || page.slug;
      const tags = (page.frontmatter.tags || []).join(", ");
      const desc = page.frontmatter.description || "";
      console.log(`  ${title}`);
      console.log(`    slug: ${page.slug}`);
      if (desc) console.log(`    desc: ${desc}`);
      if (tags) console.log(`    tags: ${tags}`);
      console.log(`    links: ${page.wikilinks.length} | sources: ${(page.frontmatter.sources || []).length}`);
      console.log("");
    }
  }
}

// src/commands/status.ts
async function statusCommand(options) {
  const projectDir = process.cwd();
  const config = loadConfig(projectDir);
  const pages = loadWikiPages(projectDir);
  const sources = loadSourceFiles(projectDir);
  const brokenLinks = findBrokenLinks(pages);
  const ambiguousLinks = findAmbiguousLinks(pages);
  const orphanPages = findOrphanPages(pages);
  const missingFrontmatter = findMissingFrontmatter(pages);
  const duplicateFilenames = findDuplicateFilenames(pages);
  const allTags = /* @__PURE__ */ new Map();
  for (const page of pages) {
    for (const tag of page.frontmatter.tags || []) {
      allTags.set(tag, (allTags.get(tag) || 0) + 1);
    }
  }
  const pageTypes = /* @__PURE__ */ new Map();
  for (const page of pages) {
    const type = page.frontmatter.page_type || "untyped";
    pageTypes.set(type, (pageTypes.get(type) || 0) + 1);
  }
  let totalLinks = 0;
  for (const page of pages) {
    totalLinks += page.wikilinks.length;
  }
  const status = {
    wiki: {
      name: config.wiki.name,
      template: config.wiki.template,
      language: config.wiki.language
    },
    statistics: {
      pages: pages.length,
      sources: sources.length,
      wikilinks: totalLinks,
      tags: allTags.size,
      pageTypes: Object.fromEntries(pageTypes),
      tagDistribution: Object.fromEntries(
        [...allTags.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 20)
      )
    },
    issues: {
      brokenLinks: brokenLinks.map((bl) => ({
        page: bl.page.slug,
        link: bl.link
      })),
      ambiguousLinks: ambiguousLinks.map((al) => ({
        page: al.page.slug,
        link: al.link,
        matches: al.matches.map((m) => m.slug)
      })),
      orphanPages: orphanPages.map((p) => p.slug),
      missingFrontmatter: missingFrontmatter.map((mf) => ({
        page: mf.page.slug,
        missing: mf.missing
      })),
      duplicateFilenames: Object.fromEntries(
        [...duplicateFilenames.entries()].map(([name, group]) => [
          name,
          group.map((p) => p.slug)
        ])
      )
    },
    health: {
      brokenLinksCount: brokenLinks.length,
      ambiguousLinksCount: ambiguousLinks.length,
      orphanPagesCount: orphanPages.length,
      missingFrontmatterCount: missingFrontmatter.length,
      duplicateFilenamesCount: duplicateFilenames.size,
      totalIssues: brokenLinks.length + ambiguousLinks.length + orphanPages.length + missingFrontmatter.length + duplicateFilenames.size
    }
  };
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  console.log(`
\u{1F4CA} ${config.wiki.name} \u2014 Status
`);
  console.log("\u2500\u2500\u2500 Statistics \u2500\u2500\u2500");
  console.log(`  Pages:     ${pages.length}`);
  console.log(`  Sources:   ${sources.length}`);
  console.log(`  Wikilinks: ${totalLinks}`);
  console.log(`  Tags:      ${allTags.size}`);
  if (pageTypes.size > 0) {
    console.log("\n  Page types:");
    for (const [type, count] of pageTypes) {
      console.log(`    ${type}: ${count}`);
    }
  }
  if (allTags.size > 0) {
    console.log("\n  Top tags:");
    const topTags = [...allTags.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 10);
    for (const [tag, count] of topTags) {
      console.log(`    ${tag}: ${count}`);
    }
  }
  console.log("\n\u2500\u2500\u2500 Health \u2500\u2500\u2500");
  const totalIssues = status.health.totalIssues;
  if (totalIssues === 0) {
    console.log("  \u2713 No issues found!");
  } else {
    console.log(`  \u26A0 ${totalIssues} issue(s) found:
`);
    if (brokenLinks.length > 0) {
      console.log(`  \u{1F517} Broken links (${brokenLinks.length}):`);
      for (const bl of brokenLinks) {
        console.log(`    ${bl.page.slug} \u2192 [[${bl.link}]]`);
      }
    }
    if (ambiguousLinks.length > 0) {
      console.log(`
  \u{1F500} Ambiguous links (${ambiguousLinks.length}):`);
      for (const al of ambiguousLinks) {
        console.log(
          `    ${al.page.slug} \u2192 [[${al.link}]] matches: ${al.matches.map((m) => m.slug).join(", ")}`
        );
      }
    }
    if (orphanPages.length > 0) {
      console.log(`
  \u{1F3DD} Orphan pages (${orphanPages.length}):`);
      for (const p of orphanPages) {
        console.log(`    ${p.slug}`);
      }
    }
    if (missingFrontmatter.length > 0) {
      console.log(
        `
  \u{1F4DD} Missing frontmatter (${missingFrontmatter.length}):`
      );
      for (const mf of missingFrontmatter) {
        console.log(`    ${mf.page.slug}: missing ${mf.missing.join(", ")}`);
      }
    }
    if (duplicateFilenames.size > 0) {
      console.log(`
  \u{1F4CB} Duplicate filenames (${duplicateFilenames.size}):`);
      for (const [name, group] of duplicateFilenames) {
        console.log(`    ${name}: ${group.map((p) => p.slug).join(", ")}`);
      }
    }
  }
  console.log("");
}

// src/lib/community.ts
function detectCommunities(graph) {
  const nodes = [...graph.nodes.keys()];
  const n = nodes.length;
  if (n === 0) {
    return { communities: [], assignments: /* @__PURE__ */ new Map(), modularity: 0 };
  }
  let totalWeight = 0;
  for (const edge of graph.edges.values()) {
    totalWeight += edge.weight;
  }
  if (totalWeight === 0) {
    const assignments2 = /* @__PURE__ */ new Map();
    const communities2 = [];
    nodes.forEach((slug, i) => {
      assignments2.set(slug, i);
      communities2.push({
        id: i,
        members: [slug],
        cohesion: 0,
        internalEdges: 0,
        totalPossibleEdges: 0
      });
    });
    return { communities: communities2, assignments: assignments2, modularity: 0 };
  }
  const weightedAdj = /* @__PURE__ */ new Map();
  for (const slug of nodes) {
    weightedAdj.set(slug, /* @__PURE__ */ new Map());
  }
  for (const edge of graph.edges.values()) {
    const w = edge.weight;
    weightedAdj.get(edge.source).set(edge.target, w);
    weightedAdj.get(edge.target).set(edge.source, w);
  }
  const strength = /* @__PURE__ */ new Map();
  for (const slug of nodes) {
    let s = 0;
    for (const w of weightedAdj.get(slug).values()) {
      s += w;
    }
    strength.set(slug, s);
  }
  const community = /* @__PURE__ */ new Map();
  nodes.forEach((slug, i) => community.set(slug, i));
  const m2 = 2 * totalWeight;
  let improved = true;
  let iterations = 0;
  const maxIterations = 100;
  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    for (const node of nodes) {
      const currentComm = community.get(node);
      const ki = strength.get(node);
      const commWeights = /* @__PURE__ */ new Map();
      const neighbors = weightedAdj.get(node);
      for (const [neighbor, w] of neighbors) {
        const nComm = community.get(neighbor);
        commWeights.set(nComm, (commWeights.get(nComm) || 0) + w);
      }
      const commStrength = /* @__PURE__ */ new Map();
      for (const [slug, comm] of community) {
        commStrength.set(comm, (commStrength.get(comm) || 0) + strength.get(slug));
      }
      const sigmaIn = commWeights.get(currentComm) || 0;
      const sigmaTot = commStrength.get(currentComm) - ki;
      let bestComm = currentComm;
      let bestGain = 0;
      for (const [targetComm, kiin] of commWeights) {
        if (targetComm === currentComm) continue;
        const sigmaTotTarget = commStrength.get(targetComm);
        const gain = (kiin - sigmaIn) / m2 - ki * (sigmaTotTarget - sigmaTot) / (m2 * m2) * 2;
        if (gain > bestGain) {
          bestGain = gain;
          bestComm = targetComm;
        }
      }
      if (bestComm !== currentComm) {
        community.set(node, bestComm);
        improved = true;
      }
    }
  }
  const commIds = [...new Set(community.values())];
  const remap = /* @__PURE__ */ new Map();
  commIds.forEach((id, i) => remap.set(id, i));
  const assignments = /* @__PURE__ */ new Map();
  for (const [slug, comm] of community) {
    assignments.set(slug, remap.get(comm));
  }
  const commMembers = /* @__PURE__ */ new Map();
  for (const [slug, comm] of assignments) {
    const arr = commMembers.get(comm) || [];
    arr.push(slug);
    commMembers.set(comm, arr);
  }
  const communities = [];
  for (const [id, members] of commMembers) {
    let internalEdges = 0;
    let internalWeight = 0;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const w = weightedAdj.get(members[i])?.get(members[j]);
        if (w !== void 0) {
          internalEdges++;
          internalWeight += w;
        }
      }
    }
    const totalPossible = members.length * (members.length - 1) / 2;
    const cohesion = totalPossible > 0 ? internalEdges / totalPossible : 0;
    communities.push({
      id,
      members,
      cohesion,
      internalEdges,
      totalPossibleEdges: totalPossible
    });
  }
  let modularity = 0;
  for (const edge of graph.edges.values()) {
    const ci = assignments.get(edge.source);
    const cj = assignments.get(edge.target);
    if (ci === cj) {
      const ki = strength.get(edge.source);
      const kj = strength.get(edge.target);
      modularity += edge.weight - ki * kj / m2;
    }
  }
  modularity /= totalWeight;
  return { communities, assignments, modularity };
}

// src/lib/insights.ts
function generateInsights(graph, communityResult, config) {
  const insights = [];
  insights.push(...findUnexpectedConnections(graph, communityResult));
  insights.push(...findKnowledgeGaps(graph, communityResult));
  insights.push(...findHubNodes(graph));
  insights.push(
    ...findLowCohesionCommunities(
      communityResult,
      config.graph.community_cohesion_threshold
    )
  );
  return insights;
}
function findUnexpectedConnections(graph, communityResult) {
  const insights = [];
  const { assignments } = communityResult;
  for (const edge of graph.edges.values()) {
    const commA = assignments.get(edge.source);
    const commB = assignments.get(edge.target);
    const nodeA = graph.nodes.get(edge.source);
    const nodeB = graph.nodes.get(edge.target);
    const crossCommunity = commA !== commB;
    const crossType = nodeA.pageType && nodeB.pageType && nodeA.pageType !== nodeB.pageType;
    if (crossCommunity && edge.weight > 3) {
      insights.push({
        type: "unexpected_connection",
        severity: "info",
        title: `Unexpected cross-community connection`,
        description: `"${nodeA.title}" (community ${commA}) and "${nodeB.title}" (community ${commB}) have a strong connection (weight: ${edge.weight.toFixed(1)})${crossType ? ` across different types (${nodeA.pageType} \u2194 ${nodeB.pageType})` : ""}. This may reveal a hidden relationship worth exploring.`,
        relatedNodes: [edge.source, edge.target]
      });
    }
  }
  return insights;
}
function findKnowledgeGaps(graph, communityResult) {
  const insights = [];
  const orphans = [...graph.nodes.values()].filter(
    (n) => n.degree === 0 && n.slug !== "index" && n.slug !== "log"
  );
  if (orphans.length > 0) {
    insights.push({
      type: "knowledge_gap",
      severity: "warning",
      title: `${orphans.length} orphan page(s) with no connections`,
      description: `These pages have no links to or from other pages: ${orphans.map((n) => `"${n.title}"`).join(", ")}. Consider linking them to related pages or investigating if they're still relevant.`,
      relatedNodes: orphans.map((n) => n.slug)
    });
  }
  const bridges = [...graph.nodes.values()].filter((n) => n.degree === 1);
  for (const bridge of bridges) {
    const neighbor = [...graph.adjacency.get(bridge.slug) || []][0];
    if (neighbor) {
      const bridgeComm = communityResult.assignments.get(bridge.slug);
      const neighborComm = communityResult.assignments.get(neighbor);
      if (bridgeComm !== neighborComm) {
        insights.push({
          type: "knowledge_gap",
          severity: "info",
          title: `Bridge node between communities`,
          description: `"${bridge.title}" is the only connection between community ${bridgeComm} and community ${neighborComm}. Adding more cross-references would strengthen this link.`,
          relatedNodes: [bridge.slug, neighbor]
        });
      }
    }
  }
  for (const comm of communityResult.communities) {
    if (comm.members.length === 1) {
      const node = graph.nodes.get(comm.members[0]);
      if (node.slug !== "index" && node.slug !== "log") {
        insights.push({
          type: "knowledge_gap",
          severity: "info",
          title: `Isolated topic: "${node.title}"`,
          description: `This page forms its own community with no strong connections. Consider expanding coverage of this topic or linking it to related pages.`,
          relatedNodes: [node.slug]
        });
      }
    }
  }
  return insights;
}
function findHubNodes(graph) {
  const insights = [];
  const nodes = [...graph.nodes.values()];
  if (nodes.length < 5) return insights;
  const degrees = nodes.map((n) => n.degree);
  const mean = degrees.reduce((a, b2) => a + b2, 0) / degrees.length;
  const variance = degrees.reduce((a, b2) => a + (b2 - mean) ** 2, 0) / degrees.length;
  const std = Math.sqrt(variance);
  const threshold = mean + 2 * std;
  for (const node of nodes) {
    if (node.degree > threshold && node.degree > 5) {
      insights.push({
        type: "hub_node",
        severity: "info",
        title: `Hub node: "${node.title}" (degree: ${node.degree})`,
        description: `This page has significantly more connections than average (${mean.toFixed(1)} \xB1 ${std.toFixed(1)}). It may be too broad and could benefit from being split into more specific pages.`,
        relatedNodes: [node.slug]
      });
    }
  }
  return insights;
}
function findLowCohesionCommunities(communityResult, threshold) {
  const insights = [];
  for (const comm of communityResult.communities) {
    if (comm.members.length >= 3 && comm.cohesion < threshold) {
      insights.push({
        type: "low_cohesion",
        severity: "warning",
        title: `Low cohesion community #${comm.id} (${comm.cohesion.toFixed(2)})`,
        description: `Community #${comm.id} has ${comm.members.length} members but low internal density (${comm.cohesion.toFixed(2)} < ${threshold}). Members: ${comm.members.join(", ")}. These pages may not be strongly related.`,
        relatedNodes: comm.members
      });
    }
  }
  return insights;
}

// src/commands/graph.ts
async function graphCommand(options) {
  const projectDir = process.cwd();
  const config = loadConfig(projectDir);
  const pages = loadWikiPages(projectDir);
  if (pages.length === 0) {
    console.log("No wiki pages found.");
    return;
  }
  console.log(`
Building knowledge graph from ${pages.length} pages...`);
  const graph = buildGraph(pages, config);
  const communityResult = detectCommunities(graph);
  for (const [slug, commId] of communityResult.assignments) {
    const node = graph.nodes.get(slug);
    if (node) node.community = commId;
  }
  if (options.json) {
    const data = {
      ...graphToJSON(graph),
      communities: communityResult.communities,
      modularity: communityResult.modularity,
      insights: options.insights ? generateInsights(graph, communityResult, config) : []
    };
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(`
\u{1F578} Knowledge Graph
`);
  console.log("\u2500\u2500\u2500 Overview \u2500\u2500\u2500");
  console.log(`  Nodes:       ${graph.nodes.size}`);
  console.log(`  Edges:       ${graph.edges.size}`);
  console.log(`  Communities: ${communityResult.communities.length}`);
  console.log(`  Modularity:  ${communityResult.modularity.toFixed(4)}`);
  const hubs = findHubs(graph, 5);
  if (hubs.length > 0 && hubs[0].degree > 0) {
    console.log("\n\u2500\u2500\u2500 Top Hubs \u2500\u2500\u2500");
    for (const hub of hubs) {
      if (hub.degree === 0) break;
      console.log(`  ${hub.title} \u2014 degree: ${hub.degree}, community: ${hub.community}`);
    }
  }
  const strongEdges = findStrongestEdges(graph, 5);
  if (strongEdges.length > 0) {
    console.log("\n\u2500\u2500\u2500 Strongest Connections \u2500\u2500\u2500");
    for (const edge of strongEdges) {
      const srcTitle = graph.nodes.get(edge.source)?.title || edge.source;
      const tgtTitle = graph.nodes.get(edge.target)?.title || edge.target;
      console.log(
        `  ${srcTitle} \u2194 ${tgtTitle} (weight: ${edge.weight.toFixed(1)})`
      );
    }
  }
  if (options.communities || true) {
    console.log("\n\u2500\u2500\u2500 Communities \u2500\u2500\u2500");
    const sortedComms = [...communityResult.communities].sort(
      (a, b2) => b2.members.length - a.members.length
    );
    for (const comm of sortedComms) {
      const cohesionIndicator = comm.cohesion < config.graph.community_cohesion_threshold ? " \u26A0 low cohesion" : "";
      console.log(
        `  Community #${comm.id} (${comm.members.length} members, cohesion: ${comm.cohesion.toFixed(2)})${cohesionIndicator}`
      );
      for (const member of comm.members.slice(0, 10)) {
        const node = graph.nodes.get(member);
        console.log(`    - ${node?.title || member}`);
      }
      if (comm.members.length > 10) {
        console.log(`    ... and ${comm.members.length - 10} more`);
      }
    }
  }
  if (options.insights) {
    const insights = generateInsights(graph, communityResult, config);
    if (insights.length > 0) {
      console.log("\n\u2500\u2500\u2500 Insights \u2500\u2500\u2500");
      for (const insight of insights) {
        const icon = insight.severity === "critical" ? "\u{1F534}" : insight.severity === "warning" ? "\u{1F7E1}" : "\u{1F535}";
        console.log(`  ${icon} ${insight.title}`);
        console.log(`     ${insight.description}`);
        console.log("");
      }
    } else {
      console.log("\n  No notable insights found.");
    }
  }
  console.log("");
}

// src/cli.ts
var program = new Command();
program.name("llm-wiki").description(
  "Agent-native LLM Wiki \u2014 persistent knowledge management powered by AI agents"
).version("0.1.0");
program.command("init").description("Initialize a new LLM Wiki project").option(
  "-t, --template <template>",
  "Scene template (research, reading, business, general)",
  "general"
).option("-n, --name <name>", "Wiki name", "My Wiki").option("-l, --language <lang>", "Default language (en, zh)", "en").option("--db9", "Enable DB9 integration").action(initCommand);
program.command("sync").description("Sync local wiki to DB9").option("--full", "Force full sync instead of incremental").action(syncCommand);
program.command("search <query>").description("Search the wiki using hybrid search").option("-l, --limit <n>", "Maximum results", "10").option("-f, --format <format>", "Output format (text, json)", "text").action(searchCommand);
program.command("index").description("List all wiki pages").option("-t, --tag <tag>", "Filter by tag").option("--type <type>", "Filter by page type").option("-f, --format <format>", "Output format (text, json)", "text").action(indexCommand);
program.command("status").description("Show wiki statistics and health checks").option("--json", "Output as JSON").action(statusCommand);
program.command("graph").description("Build and analyze the knowledge graph").option("--insights", "Show graph insights", true).option("--json", "Output graph data as JSON").option("--communities", "Show community detection results").action(graphCommand);
program.parse();
//# sourceMappingURL=cli.js.map