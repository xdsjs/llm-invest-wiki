export function generateIngestSkill(): string {
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
   YYYY-MM-DD HH:MM — Ingested: [source filename]. Created N new pages, updated M existing pages.
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

- **Never modify source files** — they are immutable
- **Don't create stub pages** — every page should have substantive content
- **Prefer updating existing pages** over creating redundant new ones
- **Use the shortest unique wikilink form** (Obsidian convention)
- **One page per concept/entity** — avoid duplication
`;
}
