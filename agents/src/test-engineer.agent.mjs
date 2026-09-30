import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

const persona = {
  name: "test-engineer",
  filePrefix: "07",
  description:
    "Use proactively to write the RED tests (vitest specs per workspace, node:test for scripts) before implementation, ordered error > edge > regression > happy, and to extend coverage for new features.",
  claude: {
    tools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
    model: "sonnet",
  },
  ownedGlobs: [],
  systemPrompt: readFileSync(join(dir, "prompts", "test-engineer.md"), "utf8").trimEnd() + "\n",
};

export default persona;
