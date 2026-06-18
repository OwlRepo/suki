import { describe, expect, it } from "vitest";
import {
  evaluateAssistantContextGovernance,
  needsAssistantContextUpdate,
} from "./assistant-context-governance";

describe("assistant context governance", () => {
  it("detects behavior-impacting FE/BE paths", () => {
    expect(needsAssistantContextUpdate(["apps/web/src/app/(dashboard)/appointments/page.tsx"])).toBe(true);
    expect(needsAssistantContextUpdate(["apps/api/src/help/assistant.service.ts"])).toBe(true);
    expect(needsAssistantContextUpdate(["README.md"])).toBe(false);
  });

  it("fails when required markdown context or index files are missing", () => {
    const result = evaluateAssistantContextGovernance({
      changedFiles: ["apps/api/src/help/assistant.service.ts"],
      assistantContextFiles: [],
      aiIndexFiles: [],
      aiArchitectureManifestFiles: [],
    });

    expect(result.ok).toBe(false);
    expect(result.missing.some((item) => item.includes("docs/assistant-context"))).toBe(true);
    expect(result.missing.some((item) => item.includes("docs/ai/file-index/repository-map.md"))).toBe(true);
    expect(
      result.missing.some((item) =>
        item.includes("docs/ai/architecture-manifest.md"),
      ),
    ).toBe(true);
  });

  it("passes when behavior change includes context docs and index updates", () => {
    const result = evaluateAssistantContextGovernance({
      changedFiles: ["apps/api/src/help/assistant.service.ts"],
      assistantContextFiles: ["docs/assistant-context/en/customers.md"],
      aiIndexFiles: ["docs/ai/file-index/repository-map.md"],
      aiArchitectureManifestFiles: ["docs/ai/architecture-manifest.md"],
    });

    expect(result.ok).toBe(true);
  });

  it("does not require doc updates for non-behavioral file changes", () => {
    const result = evaluateAssistantContextGovernance({
      changedFiles: ["apps/web/src/app/globals.css"],
      assistantContextFiles: [],
      aiIndexFiles: [],
      aiArchitectureManifestFiles: [],
    });
    expect(result.ok).toBe(true);
    expect(result.needsContextUpdate).toBe(false);
  });
});
