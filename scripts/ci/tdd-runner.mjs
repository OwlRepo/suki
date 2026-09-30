// Runs changed test files per kind and collects failures. vitest kinds run inside
// their workspace (apps/web, apps/api, packages/types) with the JSON reporter;
// script tests run under node:test with TAP. Shared by tdd-gate (against the base)
// and tdd-red (now).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { RUNNABLE_KINDS, WORKSPACE_OF, globSafe, parseTapFailures, parseVitestJson } from "./tdd-lib.mjs";

export class TestRunTimeout extends Error {}

// A parent node:test run leaks NODE_TEST_CONTEXT, which switches the child to the
// parent's internal protocol and suppresses the TAP output parsed below.
function childEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.VITEST;
  delete env.VITEST_WORKER_ID;
  return env;
}

function spawnChecked(cmd, args, cwd, timeoutMs, kind) {
  const res = spawnSync(cmd, args, {
    cwd,
    env: childEnv(),
    encoding: "utf8",
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error?.code === "ETIMEDOUT" || (res.status === null && res.signal)) {
    throw new TestRunTimeout(`timeout: the ${kind} tests did not finish within ${timeoutMs} ms`);
  }
  return res;
}

function runVitest(root, kind, files, timeoutMs) {
  const workspace = WORKSPACE_OF[kind];
  const cwd = path.join(root, workspace);
  const outDir = mkdtempSync(path.join(tmpdir(), "tdd-vitest-"));
  const outFile = path.join(outDir, "report.json");
  try {
    const rel = files.map((f) => path.relative(workspace, f));
    const res = spawnChecked(
      path.join(root, "node_modules", ".bin", "vitest"),
      ["run", "--reporter=json", `--outputFile=${outFile}`, ...rel],
      cwd,
      timeoutMs,
      kind,
    );
    let report = "";
    try {
      report = readFileSync(outFile, "utf8");
    } catch {
      report = "";
    }
    return { status: res.status, parsed: parseVitestJson(report, root, workspace) };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

function runNodeTest(root, files, timeoutMs) {
  const res = spawnChecked(process.execPath, ["--test", "--test-reporter=tap", ...files.map(globSafe)], root, timeoutMs, "script");
  return { status: res.status, parsed: parseTapFailures(res.stdout, files) };
}

export function runTestGroups(root, groups, timeoutMs) {
  const results = { testLevel: [], fileLevel: [], anyFailure: false };
  for (const kind of RUNNABLE_KINDS) {
    const files = groups[kind];
    if (files.length === 0) continue;
    const { status, parsed } =
      kind === "scriptTests" ? runNodeTest(root, files, timeoutMs) : runVitest(root, kind, files, timeoutMs);
    if (status !== 0) results.anyFailure = true;
    results.testLevel.push(...parsed.testLevel);
    results.fileLevel.push(...parsed.fileLevel);
  }
  return results;
}
