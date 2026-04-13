# LLM Wiki

Agent-native persistent knowledge management — compile knowledge once, query forever.

Based on [Andrej Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), combining the best of [nashsu/llm_wiki](https://github.com/nashsu/llm_wiki) and [disksing/db9-wiki](https://github.com/disksing/db9-wiki).

## What is this?

LLM Wiki is a CLI tool + AI Agent skill system that maintains an evolving, interconnected Markdown knowledge base. Instead of traditional RAG (re-deriving answers from raw documents each time), LLM Wiki **compiles** knowledge into structured wiki pages that AI agents maintain and grow over time.

**Key principle:** The tool itself doesn't call LLMs. It generates `AGENTS.md` and skill files that let any AI agent (Claude Code, Codex, Cursor, etc.) operate the wiki.

## Features

- **Agent-native design** — AGENTS.md + skill files let any AI agent operate the wiki
- **Two-step chain-of-thought ingestion** — Analyze first, then generate wiki pages
- **Knowledge compounding** — Query results get written back as new wiki pages
- **Four-signal knowledge graph** — Direct links, source overlap, Adamic-Adar, type affinity
- **Louvain community detection** — Automatically discover knowledge clusters
- **Graph insights** — Detect unexpected connections, knowledge gaps, hub nodes
- **Hybrid search** — BM25 + vector (DB9) + graph traversal with Reciprocal Rank Fusion
- **CJK support** — Bigram tokenization for Chinese/Japanese/Korean text
- **DB9 integration** — Vector search, cloud sync, and team collaboration
- **Obsidian compatible** — Wiki is a folder of Markdown files with `[[wikilinks]]`
- **Chrome Web Clipper** — Browser extension to clip web pages to your wiki
- **Self-healing lint** — Automated health checks and repairs

## Quick Start

```bash
# Install
npm install -g llm-wiki

# Initialize a new wiki
mkdir my-wiki && cd my-wiki
llm-wiki init --name "My Wiki" --template research --language zh

# Check wiki health
llm-wiki status

# Search
llm-wiki search "machine learning"

# Analyze knowledge graph
llm-wiki graph --insights

# List all pages
llm-wiki index
```

## Project Structure (after init)

```
my-wiki/
├── llm-wiki.toml          # Configuration
├── purpose.md              # Wiki direction and intent
├── schema.md               # Structure rules and page types
├── index.md                # Content catalog
├── log.md                  # Operation log
├── wiki/                   # Wiki pages (Obsidian-compatible)
│   ├── concepts/
│   ├── entities/
│   ├── topics/
│   └── insights/
├── sources/                # Raw, immutable source documents
├── .agents/
│   ├── AGENTS.md           # Agent instructions
│   └── skills/
│       ├── ingest.md       # Two-step ingestion skill
│       ├── query.md        # Search + knowledge compounding
│       ├── lint.md         # Health check + self-repair
│       └── deep-research.md
└── .claude/
    └── skills -> ../.agents/skills
```

## Agent Skills

### Ingest

Two-step chain-of-thought process:
1. **Analyze**: Extract entities, concepts, relationships, contradictions
2. **Generate**: Create/update wiki pages with frontmatter, wikilinks, and cross-references

### Query

Search + knowledge compounding:
1. Run `llm-wiki search` for relevant pages
2. Follow graph links for related context
3. Synthesize answer with citations
4. Write valuable answers back as new wiki pages

### Lint

Self-healing health check:
1. Run `llm-wiki status` for structural issues
2. Run `llm-wiki graph --insights` for knowledge gaps
3. Auto-fix: broken links, missing frontmatter, orphan pages
4. Flag contradictions and stale content for human review

### Deep Research

Web research to fill knowledge gaps:
1. Identify gaps from graph insights
2. Research with web search tools
3. Save sources and ingest into wiki

## CLI Commands

| Command | Description |
|---------|-------------|
| `llm-wiki init` | Initialize a new wiki project |
| `llm-wiki status` | Show statistics and health checks |
| `llm-wiki search <query>` | Hybrid search (BM25 + vector + graph) |
| `llm-wiki graph` | Build and analyze knowledge graph |
| `llm-wiki index` | List all wiki pages |
| `llm-wiki sync` | Sync to DB9 (vector index + backup) |

## Knowledge Graph

The four-signal relevance model builds a weighted graph:

| Signal | Weight | Description |
|--------|--------|-------------|
| Direct link | ×3.0 | `[[wikilink]]` connections |
| Source overlap | ×4.0 | Pages sharing the same source files |
| Adamic-Adar | ×1.5 | Shared neighbors (weighted by inverse log degree) |
| Type affinity | ×1.0 | Same page type bonus |

Louvain community detection finds knowledge clusters. Low-cohesion communities (<0.15) are flagged.

## Hybrid Search

Three search streams merged with Reciprocal Rank Fusion (RRF):

1. **BM25** — Keyword matching with stemming and CJK bigrams
2. **Vector** — Semantic similarity via DB9 `embedding()` (when enabled)
3. **Graph traversal** — Expand from search hits through 1-2 hops

## Configuration

`llm-wiki.toml`:

```toml
[wiki]
name = "My Wiki"
language = "zh"
template = "research"

[db9]
enabled = true

[search]
bm25_weight = 1.0
vector_weight = 1.0
graph_weight = 0.5

[graph]
direct_link_weight = 3.0
source_overlap_weight = 4.0
adamic_adar_weight = 1.5
type_affinity_weight = 1.0
community_cohesion_threshold = 0.15
```

## Templates

| Template | Description |
|----------|-------------|
| `research` | Academic papers, technical reports, research landscape |
| `reading` | Books, articles, personal intellectual framework |
| `business` | Market intelligence, competitive analysis, strategy |
| `general` | General-purpose knowledge base |

## Chrome Web Clipper

The `extension/` directory contains a Manifest V3 Chrome extension that clips web pages to your wiki's `sources/` directory.

## Obsidian Compatibility

The wiki directory is fully Obsidian-compatible:
- Standard YAML frontmatter
- `[[wikilink]]` syntax (shortest unique filename)
- Can be opened directly as an Obsidian vault

## DB9 Integration

[DB9](https://db9.ai) provides serverless PostgreSQL with built-in vector search:
- `embedding()` function for automatic vector generation
- HNSW index for fast similarity search
- fs9 file system for cloud backup
- Team collaboration via shared database

## Tech Stack

- TypeScript (ESM, ES2022)
- [tsup](https://tsup.egoist.dev/) for bundling
- [commander](https://github.com/tj/commander.js/) for CLI
- [vitest](https://vitest.dev/) for testing
- [get-db9](https://www.npmjs.com/package/get-db9) for DB9 integration
- [yaml](https://github.com/eemeli/yaml) for frontmatter parsing

## License

Apache-2.0
