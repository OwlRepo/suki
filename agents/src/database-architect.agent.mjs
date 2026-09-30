import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

const persona = {
  name: "database-architect",
  filePrefix: "02",
  description:
    "Use proactively when designing the Drizzle/PostgreSQL schema or generating migrations in packages/database. Owns schema, drizzle migrations, and database scripts; never touches apps/api or apps/web.",
  claude: {
    tools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
    model: "sonnet",
  },
  ownedGlobs: ["packages/database/src/schema/**", "packages/database/drizzle/**", "packages/database/scripts/**", "packages/database/drizzle.config.ts"],
  systemPrompt: readFileSync(join(dir, "prompts", "database-architect.md"), "utf8").trimEnd() + "\n",
};

export default persona;
