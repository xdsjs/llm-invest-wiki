import {
  mkdirSync,
  writeFileSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { generateToml, type WikiConfig } from "../config.js";
import { generateAgentsMd } from "../templates/agents-md.js";
import { generateIngestSkill } from "../templates/skill-ingest.js";
import { generateQuerySkill } from "../templates/skill-query.js";
import { generateLintSkill } from "../templates/skill-lint.js";
import { generateDeepResearchSkill } from "../templates/skill-deep-research.js";
import { getTemplate } from "../templates/schema-templates.js";
import { createDb9Client, initDb9Schema } from "../db.js";

interface InitOptions {
  template: string;
  name: string;
  language: string;
  db9?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const projectDir = process.cwd();

  // Check if already initialized
  if (existsSync(join(projectDir, "llm-wiki.toml"))) {
    console.error("Error: This directory is already an LLM Wiki project.");
    process.exit(1);
  }

  console.log(`Initializing LLM Wiki: "${options.name}" (${options.template} template)`);

  // Create directory structure
  const dirs = [
    "wiki/concepts",
    "wiki/entities",
    "wiki/topics",
    "wiki/insights",
    "sources",
    ".agents/skills",
    ".llm-wiki",
  ];

  for (const dir of dirs) {
    mkdirSync(join(projectDir, dir), { recursive: true });
  }

  // Generate config
  const config: WikiConfig = {
    wiki: {
      name: options.name,
      language: options.language,
      template: options.template,
    },
    db9: {
      enabled: !!options.db9,
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

  writeFileSync(
    join(projectDir, "llm-wiki.toml"),
    generateToml(config),
    "utf-8"
  );
  console.log("  Created llm-wiki.toml");

  // Generate purpose.md and schema.md from template
  const template = getTemplate(options.template);
  writeFileSync(join(projectDir, "purpose.md"), template.purpose, "utf-8");
  console.log("  Created purpose.md");

  writeFileSync(join(projectDir, "schema.md"), template.schema, "utf-8");
  console.log("  Created schema.md");

  // Generate index.md
  const indexContent = `# ${options.name} — Index

## Concepts

<!-- Add concept pages here -->

## Entities

<!-- Add entity pages here -->

## Topics

<!-- Add topic pages here -->

## Insights

<!-- Add insight pages here -->
`;
  writeFileSync(join(projectDir, "index.md"), indexContent, "utf-8");
  console.log("  Created index.md");

  // Generate log.md
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const logContent = `# ${options.name} — Operation Log

${now} — Wiki initialized with "${options.template}" template.
`;
  writeFileSync(join(projectDir, "log.md"), logContent, "utf-8");
  console.log("  Created log.md");

  // Generate AGENTS.md
  writeFileSync(
    join(projectDir, ".agents", "AGENTS.md"),
    generateAgentsMd(options.name, options.language),
    "utf-8"
  );
  console.log("  Created .agents/AGENTS.md");

  // Generate skill files
  const skills = [
    { name: "ingest.md", content: generateIngestSkill() },
    { name: "query.md", content: generateQuerySkill() },
    { name: "lint.md", content: generateLintSkill() },
    { name: "deep-research.md", content: generateDeepResearchSkill() },
  ];

  for (const skill of skills) {
    writeFileSync(
      join(projectDir, ".agents", "skills", skill.name),
      skill.content,
      "utf-8"
    );
    console.log(`  Created .agents/skills/${skill.name}`);
  }

  // Create .claude/skills symlink for Claude Code compatibility
  const claudeSkillsDir = join(projectDir, ".claude");
  mkdirSync(claudeSkillsDir, { recursive: true });

  const symlinkTarget = join("..", ".agents", "skills");
  const symlinkPath = join(claudeSkillsDir, "skills");
  if (!existsSync(symlinkPath)) {
    try {
      symlinkSync(symlinkTarget, symlinkPath);
      console.log("  Created .claude/skills -> .agents/skills");
    } catch {
      console.log("  Note: Could not create .claude/skills symlink");
    }
  }

  // Generate .gitignore
  const gitignore = `.llm-wiki/
node_modules/
`;
  writeFileSync(join(projectDir, ".gitignore"), gitignore, "utf-8");
  console.log("  Created .gitignore");

  // Initialize DB9 if enabled
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

  console.log("\n✓ LLM Wiki initialized successfully!");
  console.log("\nNext steps:");
  console.log("  1. Review purpose.md and schema.md");
  console.log("  2. Add source documents to sources/");
  console.log("  3. Use the ingest skill to process them into wiki pages");
  console.log(`  4. Run 'llm-wiki status' to check wiki health`);
}
