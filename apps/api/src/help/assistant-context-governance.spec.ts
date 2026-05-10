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
    });

    expect(result.ok).toBe(false);
    expect(result.missing.some((item) => item.includes("docs/assistant-context"))).toBe(true);
    expect(result.missing.some((item) => item.includes(".ai/file-index"))).toBe(true);
  });

  it("passes when behavior change includes context docs and index updates", () => {
    const result = evaluateAssistantContextGovernance({
      changedFiles: ["apps/api/src/help/assistant.service.ts"],
      assistantContextFiles: ["docs/assistant-context/en/customers.md"],
      aiIndexFiles: [".ai/file-index/services-index.md"],
    });

    expect(result.ok).toBe(true);
  });
});
