import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface Frontmatter {
  title: string;
  description?: string;
  tags?: string[];
  sources?: string[];
  page_type?: string;
  created?: string;
  updated?: string;
  [key: string]: unknown;
}

export interface ParsedPage {
  frontmatter: Frontmatter;
  content: string;
  raw: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function parseFrontmatter(raw: string): ParsedPage {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return {
      frontmatter: { title: "" },
      content: raw,
      raw,
    };
  }

  const yamlStr = match[1];
  const content = match[2];

  let frontmatter: Frontmatter;
  try {
    frontmatter = parseYaml(yamlStr) as Frontmatter;
    if (!frontmatter || typeof frontmatter !== "object") {
      frontmatter = { title: "" };
    }
  } catch {
    frontmatter = { title: "" };
  }

  return { frontmatter, content, raw };
}

export function serializeFrontmatter(
  frontmatter: Frontmatter,
  content: string
): string {
  const yaml = stringifyYaml(frontmatter, { lineWidth: 0 }).trim();
  return `---\n${yaml}\n---\n${content}`;
}
