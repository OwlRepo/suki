import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

const persona = {
  name: "code-reviewer",
  filePrefix: "05",
  description:
    "Use proactively before marking any feature as done. Read-only validator that checks spec compliance, backwards compatibility, code quality, and conventions.",
  claude: {
    tools: ["Read", "Grep", "Glob", "Bash"],
    model: "sonnet",
  },
  ownedGlobs: [],
  systemPrompt: readFileSync(join(dir, "prompts", "code-reviewer.md"), "utf8").trimEnd() + "\n",
};

export default persona;
