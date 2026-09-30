import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

const persona = {
  name: "nextjs-frontend-dev",
  filePrefix: "03",
  description:
    "Use proactively when implementing Next.js 16 App Router pages, components, hooks, or shared UI in apps/web and packages/ui. Calls API endpoints implemented by nestjs-api-dev; never edits apps/api or packages/types.",
  claude: {
    tools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
    model: "sonnet",
  },
  ownedGlobs: ["apps/web/src/app/**", "apps/web/src/components/**", "apps/web/src/hooks/**", "apps/web/src/contexts/**", "apps/web/src/lib/**", "packages/ui/src/**"],
  systemPrompt: readFileSync(join(dir, "prompts", "nextjs-frontend-dev.md"), "utf8").trimEnd() + "\n",
};

export default persona;
