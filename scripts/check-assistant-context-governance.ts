import { execSync } from "node:child_process";
import path from "node:path";
import {
  evaluateAssistantContextGovernance,
} from "../apps/api/src/help/assistant-context-governance";

function getChangedFiles(): string[] {
  const out = execSync("git diff --name-only && git diff --name-only --cached && git ls-files --others --exclude-standard", {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return Array.from(new Set(out.split("\n").map((line) => line.trim()).filter(Boolean)));
}

function main() {
  const changed = getChangedFiles();
  const assistantContextFiles = changed.filter((file) => file.startsWith("docs/assistant-context/"));
  const aiIndexFiles = changed.filter((file) => file.startsWith(".ai/file-index/"));
  const aiArchitectureFiles = changed.filter((file) => file.startsWith(".ai/architecture/"));

  const result = evaluateAssistantContextGovernance({
    changedFiles: changed,
    assistantContextFiles,
    aiIndexFiles,
    aiArchitectureFiles,
  });

  if (!result.ok) {
    console.error("Assistant context governance failed.");
    for (const item of result.missing) {
      console.error(`- Missing: ${item}`);
    }
    process.exit(1);
  }

  const root = path.resolve(process.cwd());
  console.log(`Assistant context governance passed at ${root}`);
}

main();
