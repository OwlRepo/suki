export type AssistantDocCoverageReport = {
  ok: boolean;
  needsContextUpdate: boolean;
  missing: string[];
};

function isBehaviorImpactingWebFile(file: string): boolean {
  if (!file.startsWith("apps/web/src/")) return false;
  if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) return false;
  if (file.endsWith(".spec.ts") || file.endsWith(".spec.tsx")) return false;
  if (file.endsWith(".css") || file.endsWith(".md")) return false;
  return (
    file.startsWith("apps/web/src/app/(dashboard)/") ||
    file.startsWith("apps/web/src/components/") ||
    file.startsWith("apps/web/src/lib/help-content")
  );
}

function isBehaviorImpactingApiFile(file: string): boolean {
  if (!file.startsWith("apps/api/src/")) return false;
  if (file.endsWith(".test.ts") || file.endsWith(".spec.ts")) return false;
  return file.startsWith("apps/api/src/help/") || file.startsWith("apps/api/src/ai/");
}

export function needsAssistantContextUpdate(changedFiles: string[]): boolean {
  return changedFiles.some((file) =>
    isBehaviorImpactingWebFile(file) || isBehaviorImpactingApiFile(file),
  );
}

export function evaluateAssistantContextGovernance(input: {
  changedFiles: string[];
  assistantContextFiles: string[];
  aiIndexFiles: string[];
  aiArchitectureFiles: string[];
}): AssistantDocCoverageReport {
  const needs = needsAssistantContextUpdate(input.changedFiles);
  if (!needs) {
    return { ok: true, needsContextUpdate: false, missing: [] };
  }

  const missing: string[] = [];
  if (input.assistantContextFiles.length === 0) {
    missing.push("docs/assistant-context/* markdown updates");
  }
  if (input.aiIndexFiles.length === 0) {
    missing.push("docs/ai/file-index/repository-map.md update");
  }
  if (input.aiArchitectureFiles.length === 0) {
    missing.push("docs/ai/architecture/* updates");
  }

  return {
    ok: missing.length === 0,
    needsContextUpdate: true,
    missing,
  };
}
