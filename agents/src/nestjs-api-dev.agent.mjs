import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

const persona = {
  name: "nestjs-api-dev",
  filePrefix: "09",
  description:
    "Use proactively to implement NestJS controllers, services, guards, and DTOs in apps/api for a locked HTTP contract, working in the same worktree as nextjs-frontend-dev. Owns apps/api and packages/types; never touches packages/database schema/migrations or apps/web.",
  claude: {
    tools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
    model: "sonnet",
  },
  ownedGlobs: ["apps/api/src/**", "packages/types/src/**"],
  systemPrompt: readFileSync(join(dir, "prompts", "nestjs-api-dev.md"), "utf8").trimEnd() + "\n",
};

export default persona;
