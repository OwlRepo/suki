import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readRootFile(relativePath: string): string {
  const file = path.resolve(__dirname, "../../../../", relativePath);
  return fs.readFileSync(file, "utf8");
}

describe("Codex governance docs", () => {
  it("requires post-implementation index/integration sync gate", () => {
    const workflow = readRootFile("docs/ai/workflows/update-file-indexes.md");
    expect(workflow).toMatch(/fail task completion if drift remains/i);
    expect(workflow).toMatch(/verify stale integration docs are updated/i);
  });

  it("requires AGENTS guidance for updating index and architecture docs after code changes", () => {
    const agents = readRootFile("AGENTS.md");
    expect(agents).toMatch(/after any code change/i);
    expect(agents).toMatch(/docs\/ai\/file-index\/repository-map\.md/i);
    expect(agents).toMatch(/docs\/ai\/architecture/i);
  });

  it("requires assistant markdown context governance script", () => {
    const pkg = readRootFile("package.json");
    expect(pkg).toMatch(/check:assistant-context-governance/);
    const script = readRootFile("scripts/check-assistant-context-governance.ts");
    expect(script).toMatch(/evaluateAssistantContextGovernance/);
    expect(script).toMatch(/docs\/assistant-context/);
  });
});
