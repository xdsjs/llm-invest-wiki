export interface SceneTemplate {
  purpose: string;
  schema: string;
}

const templates: Record<string, SceneTemplate> = {
  research: {
    purpose: `# Purpose

This wiki serves as a **research knowledge base** — collecting, organizing, and synthesizing information from academic papers, technical reports, and other research sources.

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
`,
  },

  reading: {
    purpose: `# Purpose

This wiki serves as a **reading knowledge base** — capturing and connecting ideas from books, articles, essays, and other reading material.

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
`,
  },

  business: {
    purpose: `# Purpose

This wiki serves as a **business knowledge base** — organizing market intelligence, competitive analysis, strategic insights, and operational knowledge.

## Goals
- Maintain up-to-date competitive landscape analysis
- Track industry trends and market dynamics
- Capture strategic decisions and their rationale
- Build institutional knowledge that compounds over time

## Priorities
1. Timeliness — business knowledge has a short shelf life
2. Actionability — insights should drive decisions
3. Competitive awareness — track what competitors are doing
4. Strategic coherence — connect tactical details to strategy
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
`,
  },

  general: {
    purpose: `# Purpose

This wiki serves as a **general knowledge base** — organizing information on any topic of interest.

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
`,
  },
};

export function getTemplate(name: string): SceneTemplate {
  return templates[name] || templates.general;
}

export function getTemplateNames(): string[] {
  return Object.keys(templates);
}
