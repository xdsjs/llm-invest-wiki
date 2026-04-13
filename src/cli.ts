import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { syncCommand } from "./commands/sync.js";
import { searchCommand } from "./commands/search.js";
import { indexCommand } from "./commands/index.js";
import { statusCommand } from "./commands/status.js";
import { graphCommand } from "./commands/graph.js";

const program = new Command();

program
  .name("llm-wiki")
  .description(
    "Agent-native LLM Wiki — persistent knowledge management powered by AI agents"
  )
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a new LLM Wiki project")
  .option(
    "-t, --template <template>",
    "Scene template (research, reading, business, general)",
    "general"
  )
  .option("-n, --name <name>", "Wiki name", "My Wiki")
  .option("-l, --language <lang>", "Default language (en, zh)", "en")
  .option("--db9", "Enable DB9 integration")
  .action(initCommand);

program
  .command("sync")
  .description("Sync local wiki to DB9")
  .option("--full", "Force full sync instead of incremental")
  .action(syncCommand);

program
  .command("search <query>")
  .description("Search the wiki using hybrid search")
  .option("-l, --limit <n>", "Maximum results", "10")
  .option("-f, --format <format>", "Output format (text, json)", "text")
  .action(searchCommand);

program
  .command("index")
  .description("List all wiki pages")
  .option("-t, --tag <tag>", "Filter by tag")
  .option("--type <type>", "Filter by page type")
  .option("-f, --format <format>", "Output format (text, json)", "text")
  .action(indexCommand);

program
  .command("status")
  .description("Show wiki statistics and health checks")
  .option("--json", "Output as JSON")
  .action(statusCommand);

program
  .command("graph")
  .description("Build and analyze the knowledge graph")
  .option("--insights", "Show graph insights", true)
  .option("--json", "Output graph data as JSON")
  .option("--communities", "Show community detection results")
  .action(graphCommand);

program.parse();
