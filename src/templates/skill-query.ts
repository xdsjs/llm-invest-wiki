export function generateQuerySkill(): string {
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
4. Identify gaps — what the wiki doesn't cover that would be helpful

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
   YYYY-MM-DD HH:MM — Query: "[question]". Synthesized from N pages. Created insight: [page-name].
   \`\`\`
6. Run \`llm-wiki sync\`

**If the answer is straightforward and doesn't add new knowledge:**

Just answer the question with citations. Append to \`log.md\`:
\`\`\`
YYYY-MM-DD HH:MM — Query: "[question]". Answered from N pages. No new pages created.
\`\`\`

## Quality Standards

- Every claim must reference a wiki page or source
- Contradictions between sources must be explicitly noted
- Gaps in knowledge should be flagged as potential research topics
- New insight pages must add value beyond what individual pages contain

## Important Rules

- **Always search before answering** — don't rely on memory alone
- **Cite wiki pages, not raw sources** — the wiki is the compiled knowledge
- **Knowledge compounding is the goal** — every valuable exploration should leave the wiki richer
- **Don't create redundant pages** — check if an existing page covers the topic
`;
}
