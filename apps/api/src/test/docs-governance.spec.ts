import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readRootFile(relativePath: string): string {
  const file = path.resolve(__dirname, "../../../../", relativePath);
  return fs.readFileSync(file, "utf8");
}

describe("Codex governance docs", () => {
  it("routes agents through the compact AI entry point", () => {
    const agents = readRootFile("AGENTS.md");
    expect(agents.trim()).toBe(
      "Read and follow `docs/ai/entry-point.md` before any repository task.",
    );
    expect(readRootFile("docs/ai/entry-point.md")).toMatch(
      /docs\/ai\/architecture-manifest\.md/,
    );
  });

  it("separates Claude planning from Codex execution", () => {
    const claude = readRootFile("CLAUDE.md");
    const codex = readRootFile(".codex/instructions.md");
    const scratchpad = readRootFile(".ai-scratchpad.md");
    const settings = JSON.parse(readRootFile(".claude/settings.json")) as {
      permissions?: { defaultMode?: string; deny?: string[] };
    };

    expect(claude).toMatch(/Claude Code.*Planner/i);
    expect(claude).toMatch(/do not write or edit source code/i);
    expect(claude).toMatch(/\.ai-scratchpad\.md/);
    expect(codex).toMatch(/OpenAI Codex.*Executor/i);
    expect(codex).toMatch(/read `\.ai-scratchpad\.md`/i);
    expect(codex).toMatch(/do not rethink, optimize, or alter architecture/i);
    expect(scratchpad).toMatch(/^# CAVE PLAN/m);
    expect(scratchpad).toMatch(/## DIRECTIVES/);
    expect(scratchpad).toMatch(/## VERIFICATION/);
    expect(settings.permissions?.defaultMode).toBe("plan");
    expect(settings.permissions?.deny).toContain("Bash");
  });

  it("keeps one architecture manifest and one repository ledger", () => {
    const aiRoot = path.resolve(__dirname, "../../../../docs/ai");
    const files = fs
      .readdirSync(aiRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        path
          .relative(aiRoot, path.resolve(entry.parentPath, entry.name))
          .replaceAll("\\", "/"),
      )
      .sort();

    expect(files).toEqual([
      "architecture-manifest.md",
      "entry-point.md",
      "file-index/repository-map.md",
    ]);
    expect(readRootFile("docs/ai/architecture-manifest.md")).toMatch(
      /# Architecture Manifest/,
    );
    expect(readRootFile("docs/ai/file-index/repository-map.md")).toMatch(
      /# Repository Map/,
    );
  });

  it("requires assistant markdown context governance script", () => {
    const pkg = readRootFile("package.json");
    expect(pkg).toMatch(/check:assistant-context-governance/);
    const script = readRootFile("scripts/check-assistant-context-governance.ts");
    expect(script).toMatch(/evaluateAssistantContextGovernance/);
    expect(script).toMatch(/docs\/assistant-context/);
  });
});
