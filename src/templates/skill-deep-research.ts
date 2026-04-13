export function generateDeepResearchSkill(): string {
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
   YYYY-MM-DD HH:MM — Deep Research: "[topic]". Collected N sources, created M pages. Remaining gaps: [list].
   \`\`\`
3. Run \`llm-wiki sync\`

## Research Quality Standards

- **Verify claims across multiple sources** — don't trust single sources
- **Note conflicting information** — flag disagreements for human review
- **Distinguish fact from opinion** — mark opinions clearly
- **Include retrieval dates** — web content changes over time
- **Prefer depth over breadth** — thorough coverage of focused topics > shallow coverage of many

## Important Rules

- **Always save sources** — never create wiki pages from ephemeral web results without saving
- **Attribute everything** — every claim should trace back to a source
- **Don't over-research** — set a scope before starting and stick to it
- **Knowledge compounding** — connect new research to existing wiki knowledge
`;
}
