import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

const persona = {
  name: "accessibility-auditor",
  filePrefix: "08",
  description:
    "Use proactively before marking UI features done. WCAG AA compliance, keyboard navigation, focus management. Read-only validator.",
  claude: {
    tools: ["Read", "Grep", "Glob", "Bash"],
    model: "sonnet",
  },
  ownedGlobs: [],
  systemPrompt: readFileSync(join(dir, "prompts", "accessibility-auditor.md"), "utf8").trimEnd() + "\n",
};

export default persona;
