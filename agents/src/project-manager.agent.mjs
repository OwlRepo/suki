import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

const persona = {
  name: "project-manager",
  filePrefix: "01",
  description:
    "Use proactively when planning features, defining specs, prioritizing work, or coordinating multi-agent dispatch. Routes the task, locks the API contract, and runs the RED round and QA fan-out.",
  claude: {
    tools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash", "TodoWrite"],
    model: "sonnet",
  },
  ownedGlobs: [],
  systemPrompt: readFileSync(join(dir, "prompts", "project-manager.md"), "utf8").trimEnd() + "\n",
};

export default persona;
