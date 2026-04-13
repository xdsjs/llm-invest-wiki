export function generateLintSkill(): string {
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
YYYY-MM-DD HH:MM — Lint: Fixed N broken links, M missing frontmatter, K orphan pages. Flagged L items for review.
\`\`\`

Run \`llm-wiki sync\` after fixes.

## Severity Levels

| Level | Action |
|-------|--------|
| **Critical** | Broken links, missing required frontmatter — auto-fix immediately |
| **Warning** | Orphan pages, low cohesion communities — auto-fix if safe |
| **Info** | Hub nodes, unexpected connections, knowledge gaps — report only |

## Important Rules

- **Fix, don't just report** — the goal is self-healing, not just diagnostics
- **Be conservative with deletions** — prefer fixing over removing content
- **Always preserve attribution** — when merging or restructuring, keep source references
- **Run status after fixes** — verify that fixes didn't introduce new issues
`;
}
