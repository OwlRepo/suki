export type AssistantDocCoverageReport = {
  ok: boolean;
  needsContextUpdate: boolean;
  missing: string[];
};

export function needsAssistantContextUpdate(changedFiles: string[]): boolean {
  return changedFiles.some((file) =>
    file.startsWith("apps/web/src/") ||
    file.startsWith("apps/api/src/help/") ||
    file.startsWith("apps/api/src/ai/")
  );
}

export function evaluateAssistantContextGovernance(input: {
  changedFiles: string[];
  assistantContextFiles: string[];
  aiIndexFiles: string[];
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
    missing.push(".ai/file-index/* updates");
  }

  return {
    ok: missing.length === 0,
    needsContextUpdate: true,
    missing,
  };
}
