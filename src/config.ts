import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";

export interface WikiConfig {
  wiki: {
    name: string;
    language: string;
    template: string;
  };
  db9: {
    enabled: boolean;
    host?: string;
    database?: string;
  };
  search: {
    bm25_weight: number;
    vector_weight: number;
    graph_weight: number;
  };
  graph: {
    direct_link_weight: number;
    source_overlap_weight: number;
    adamic_adar_weight: number;
    type_affinity_weight: number;
    community_cohesion_threshold: number;
  };
}

const DEFAULT_CONFIG: WikiConfig = {
  wiki: {
    name: "My Wiki",
    language: "en",
    template: "general",
  },
  db9: {
    enabled: false,
  },
  search: {
    bm25_weight: 1.0,
    vector_weight: 1.0,
    graph_weight: 0.5,
  },
  graph: {
    direct_link_weight: 3.0,
    source_overlap_weight: 4.0,
    adamic_adar_weight: 1.5,
    type_affinity_weight: 1.0,
    community_cohesion_threshold: 0.15,
  },
};

export function loadConfig(dir: string = process.cwd()): WikiConfig {
  const configPath = join(dir, "llm-wiki.toml");
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(configPath, "utf-8");
  const parsed = parseToml(raw) as Record<string, unknown>;

  return {
    wiki: { ...DEFAULT_CONFIG.wiki, ...(parsed.wiki as object) },
    db9: { ...DEFAULT_CONFIG.db9, ...(parsed.db9 as object) },
    search: { ...DEFAULT_CONFIG.search, ...(parsed.search as object) },
    graph: { ...DEFAULT_CONFIG.graph, ...(parsed.graph as object) },
  };
}

export function generateToml(config: WikiConfig): string {
  const lines: string[] = [];

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
