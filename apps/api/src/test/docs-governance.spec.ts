import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../../../");

function readRootFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), "utf8");
}

const REQUIRED_AI_DOCS = [
  "agent-orchestration.md",
  "architecture-manifest.md",
  "autonomous-engineering.md",
  "context-refresh.md",
  "contracts/api-contracts.md",
  "contracts/db-contracts.md",
  "dev-environment.md",
  "entry-point.md",
  "execution.md",
  "file-index/repository-map.md",
  "handoff.md",
  "module-ownership-map.md",
  "operating-contract.md",
  "plan-template.md",
  "planning.md",
  "pr-evidence.md",
  "prompts/bugfix-plan.md",
  "prompts/bugfix-rca.md",
  "prompts/feature-plan.md",
  "prompts/refactor-plan.md",
  "risk-register.md",
  "task-router.md",
  "testing-strategy.md",
];

describe("AI workflow governance", () => {
  it("error: .claude/settings.json is valid JSON and wires the TDD guard, not the retired scratchpad-only guard", () => {
    const settings = JSON.parse(readRootFile(".claude/settings.json")) as {
      permissions?: { deny?: string[] };
      hooks?: { PreToolUse?: { matcher: string; hooks: { command: string }[] }[] };
    };
    const commands = (settings.hooks?.PreToolUse ?? []).flatMap((entry) => entry.hooks.map((h) => h.command));
    expect(commands.some((c) => c.includes("scripts/hooks/tdd-red-guard.mjs"))).toBe(true);
    expect(commands.some((c) => c.includes(".ai-scratchpad.md"))).toBe(false);
    expect(settings.permissions?.deny ?? []).not.toContain("Bash");
  });

  it("error: the retired Codex handoff file .ai-scratchpad.md is gone", () => {
    expect(fs.existsSync(path.resolve(repoRoot, ".ai-scratchpad.md"))).toBe(false);
  });

  it("edge: CLAUDE.md imports AGENTS.md on its first line", () => {
    expect(readRootFile("CLAUDE.md").split("\n")[0]).toBe("@AGENTS.md");
  });

  it("edge: .codex/instructions.md is kept as a pointer to AGENTS.md", () => {
    expect(readRootFile(".codex/instructions.md")).toMatch(/AGENTS\.md/);
  });

  it("happy: AGENTS.md carries the canonical task flow and routes through the task router", () => {
    const agents = readRootFile("AGENTS.md");
    expect(agents).toMatch(/# Canonical Task Flow/);
    expect(agents).toMatch(/flowchart TD/);
    expect(agents).toMatch(/docs\/ai\/task-router\.md/);
    expect(agents).toMatch(/docs\/ai\/planning\.md/);
    expect(agents).toMatch(/docs\/ai\/execution\.md/);
    expect(agents).toMatch(/docs\/ai\/handoff\.md/);
  });

  it("happy: every phase-loaded docs/ai file exists", () => {
    for (const doc of REQUIRED_AI_DOCS) {
      expect(fs.existsSync(path.resolve(repoRoot, "docs/ai", doc)), doc).toBe(true);
    }
    expect(readRootFile("docs/ai/architecture-manifest.md")).toMatch(/# Architecture Manifest/);
    expect(readRootFile("docs/ai/file-index/repository-map.md")).toMatch(/# Repository Map/);
    expect(readRootFile("docs/ai/entry-point.md")).toMatch(/docs\/ai\/architecture-manifest\.md/);
  });

  it("happy: the workflow scripts are wired in the root package.json", () => {
    const scripts = (JSON.parse(readRootFile("package.json")) as { scripts: Record<string, string> }).scripts;
    for (const name of ["agents:generate", "agents:lint", "tdd:red", "tdd:gate", "test:scripts"]) {
      expect(scripts[name], name).toBeTruthy();
    }
  });

  it("happy: requires the assistant markdown context governance script", () => {
    const pkg = readRootFile("package.json");
    expect(pkg).toMatch(/check:assistant-context-governance/);
    const script = readRootFile("scripts/check-assistant-context-governance.ts");
    expect(script).toMatch(/evaluateAssistantContextGovernance/);
    expect(script).toMatch(/docs\/assistant-context/);
  });
});
