#!/usr/bin/env node
// CI TDD gate for feature PRs. Rules: docs/ai/testing-strategy.md "Strict TDD".
// Exit 0 = pass, 1 = TDD violation, 2 = could not evaluate (git/timeout/usage).
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { RUNNABLE_KINDS, checkTitles, classifyChanges, extractTestTitles, judgeRed, parseWaivers } from "./tdd-lib.mjs";
import { TestRunTimeout, runTestGroups } from "./tdd-runner.mjs";

const WORKSPACE_DIRS = ["apps/web", "apps/api", "packages/types", "packages/database", "packages/ui", "packages/config"];

class GateError extends Error {}

const git = (...args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    throw new GateError(`git ${args.join(" ")} failed: ${String(err.stderr || err.message).trim()}`);
  }
};

function changedEntries(mergeBase, head) {
  return git("diff", "--name-status", "-M", mergeBase, head)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      return { status: parts[0], path: parts[parts.length - 1] };
    });
}

function collectTitles(mergeBase, head, entries, testPaths) {
  const statusOf = new Map(entries.map((e) => [e.path, e.status]));
  const added = [];
  const newFiles = [];
  for (const file of testPaths) {
    if (statusOf.get(file) === "A") {
      const titles = extractTestTitles(git("show", `${head}:${file}`));
      newFiles.push({ path: file, titles });
      added.push(...titles.map((t) => ({ ...t, file })));
    } else {
      const addedLines = git("diff", "-U0", mergeBase, head, "--", file)
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .map((l) => l.slice(1))
        .join("\n");
      added.push(...extractTestTitles(addedLines).map((t) => ({ ...t, file })));
    }
  }
  return { added, newFiles };
}

// Runs the PR's test files against the merge-base source in a throwaway worktree.
function runAgainstBase(mergeBase, head, groups, timeoutMs) {
  const repoRoot = git("rev-parse", "--show-toplevel").trim();
  const dir = mkdtempSync(path.join(tmpdir(), "tdd-gate-base-"));
  try {
    git("worktree", "add", "--detach", "--quiet", dir, mergeBase);
    // Root and per-workspace node_modules, so a spec that loads fine at HEAD cannot
    // fail to load at the base merely because a non-hoisted dependency is missing.
    for (const rel of ["", ...WORKSPACE_DIRS]) {
      const nodeModules = path.join(repoRoot, rel, "node_modules");
      if (existsSync(nodeModules) && existsSync(path.join(dir, rel))) symlinkSync(nodeModules, path.join(dir, rel, "node_modules"));
    }
    for (const file of RUNNABLE_KINDS.flatMap((k) => groups[k])) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      writeFileSync(path.join(dir, file), git("show", `${head}:${file}`));
    }
    try {
      return runTestGroups(dir, groups, timeoutMs);
    } catch (err) {
      if (err instanceof TestRunTimeout) throw new GateError(`${err.message} against the base`);
      throw err;
    }
  } finally {
    try {
      execFileSync("git", ["worktree", "remove", "--force", dir], { stdio: "ignore" });
    } catch {
      // Already gone; prune below covers a half-created worktree.
    }
    rmSync(dir, { recursive: true, force: true });
    execFileSync("git", ["worktree", "prune"], { stdio: "ignore" });
  }
}

function main() {
  const base = process.env.TDD_GATE_BASE;
  if (!base) throw new GateError("TDD_GATE_BASE is missing (e.g. origin/main)");
  const head = process.env.TDD_GATE_HEAD || "HEAD";
  const timeoutMs = Number(process.env.TDD_GATE_TIMEOUT_MS) || 5 * 60 * 1000;

  const mergeBase = git("merge-base", base, head).trim();
  const entries = changedEntries(mergeBase, head);
  const groups = classifyChanges(entries);
  const waivers = parseWaivers(process.env.PR_BODY);
  const violations = [];
  const notes = [];

  const runnableTests = RUNNABLE_KINDS.flatMap((k) => groups[k]);
  const behaviourChanged = groups.logic.length > 0;

  if (behaviourChanged && runnableTests.length === 0) {
    if (waivers.tdd) notes.push(`TDD-Waiver: ${waivers.tdd}`);
    else violations.push(`logic changed without any test: ${groups.logic.join(", ")}`);
  }
  if (groups.migrations.length > 0 && groups.migrationTests.length === 0) {
    if (waivers.migration) notes.push(`Migration-Waiver: ${waivers.migration}`);
    else violations.push(`migration without a migration test or Migration-Waiver: ${groups.migrations.join(", ")}`);
  }

  violations.push(...checkTitles(collectTitles(mergeBase, head, entries, runnableTests)));

  const refactor = waivers.tdd ? /^refactor\b/i.test(waivers.tdd) : false;
  if (behaviourChanged && runnableTests.length > 0) {
    if (waivers.tdd && !refactor) {
      if (!notes.some((n) => n.startsWith("TDD-Waiver"))) notes.push(`TDD-Waiver: ${waivers.tdd} (RED proof skipped)`);
    } else {
      const run = runAgainstBase(mergeBase, head, groups, timeoutMs);
      if (refactor) {
        notes.push(`TDD-Waiver: ${waivers.tdd} (tests must pass against the base)`);
        if (run.anyFailure) {
          violations.push(`refactor: tests fail against the old code, so behaviour changed: ${[...run.testLevel, ...run.fileLevel].join(", ")}`);
        }
      } else {
        const verdict = judgeRed(run);
        if (verdict.red) notes.push(`RED against the base: ${verdict.reason}`);
        else violations.push(`RED: ${verdict.reason}`);
      }
    }
  }

  report(violations, notes);
  return violations.length > 0 ? 1 : 0;
}

function report(violations, notes) {
  for (const n of notes) console.log(`note: ${n}`);
  for (const v of violations) console.log(`TDD: ${v}`);
  if (violations.length === 0) console.log("ok: TDD gate passed");
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;
  const lines = ["## TDD gate", ""];
  if (violations.length === 0) lines.push("Passed.");
  for (const v of violations) lines.push(`- FAIL: ${v}`);
  for (const n of notes) lines.push(`- ${n}`);
  appendFileSync(summaryFile, `${lines.join("\n")}\n`);
}

try {
  process.exitCode = main();
} catch (err) {
  console.error(`tdd-gate: ${err instanceof GateError ? err.message : err.stack}`);
  process.exitCode = 2;
}
