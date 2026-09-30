import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { IVA_BUGGY, IVA_FIXED, IVA_SRC, IVA_TEST, IVA_TEST_PATH, git, makeRepo } from "./test-repo.mjs";

const GATE = new URL("./tdd-gate.mjs", import.meta.url).pathname;

function gate(root, env = {}) {
  const summary = path.join(mkdtempSync(path.join(tmpdir(), "tdd-summary-")), "summary.md");
  const fullEnv = {
    ...process.env,
    TDD_GATE_BASE: "origin/main",
    TDD_GATE_HEAD_REF: "infra/no-ticket-x",
    PR_BODY: "",
    GITHUB_STEP_SUMMARY: summary,
    ...env,
  };
  for (const [k, v] of Object.entries(fullEnv)) if (v === undefined) delete fullEnv[k];
  const res = spawnSync(process.execPath, [GATE], { cwd: root, encoding: "utf8", env: fullEnv });
  let summaryText = "";
  try {
    summaryText = readFileSync(summary, "utf8");
  } catch {
    summaryText = "";
  }
  return { ...res, summary: summaryText };
}

// ---------------------------------------------------------------- error cases

test("error: without TDD_GATE_BASE it exits 2 and says so", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  const res = gate(repo.root, { TDD_GATE_BASE: "" });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /TDD_GATE_BASE/);
});

test("error: a missing base is a git failure (2), not a pass", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  assert.equal(gate(repo.root, { TDD_GATE_BASE: "origin/does-not-exist" }).status, 2);
});

test("error: changed logic without any test blocks", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  repo.commit({ [IVA_SRC]: IVA_FIXED });
  const res = gate(repo.root);
  assert.equal(res.status, 1);
  assert.match(res.stdout + res.stderr, /apps\/web\/src\/lib\/iva\.ts/);
});

test("error: a test that hangs on the base times out, exits 2 and cleans the worktree", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  repo.commit({
    [IVA_SRC]: IVA_FIXED,
    [IVA_TEST_PATH]: 'import { it } from "vitest";\nit("error: hangs", () => new Promise(() => {}), 60_000);\n',
  });
  const res = gate(repo.root, { TDD_GATE_TIMEOUT_MS: "4000" });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /timeout/i);
  assert.equal(git(repo.root, "worktree", "list").split("\n").length, 1);
});

// ----------------------------------------------------------------- edge cases

test("edge: a docs-only PR passes", (t) => {
  const repo = makeRepo({ "docs/a.md": "a\n" });
  t.after(() => repo.cleanup());
  repo.commit({ "docs/a.md": "b\n" });
  assert.equal(gate(repo.root).status, 0);
});

test("edge: a tests-only PR needs no RED but does need prefixes", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_FIXED });
  t.after(() => repo.cleanup());
  repo.commit({ [IVA_TEST_PATH]: IVA_TEST });
  assert.equal(gate(repo.root).status, 0);

  repo.commit({ "apps/web/src/lib/other.test.ts": 'import { it } from "vitest";\nit("no prefix", () => {});\n' });
  assert.equal(gate(repo.root).status, 1);
});

test("edge: a PR whose head is main skips the gate", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  repo.commit({ [IVA_SRC]: IVA_FIXED });
  const res = gate(repo.root, { TDD_GATE_HEAD_REF: "main" });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /skip/i);
});

test("edge: a missing PR_BODY means no waiver", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  repo.commit({ [IVA_SRC]: IVA_FIXED });
  assert.equal(gate(repo.root, { PR_BODY: undefined }).status, 1);
});

test("edge: a TDD-Waiver with a reason passes and shows in the summary", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  repo.commit({ [IVA_SRC]: IVA_FIXED });
  const res = gate(repo.root, { PR_BODY: "TDD-Waiver: hotfix agreed with Romeo" });
  assert.equal(res.status, 0);
  assert.match(res.summary, /hotfix agreed with Romeo/);
});

test("edge: a .tsx component change without a test blocks", (t) => {
  const repo = makeRepo({ "apps/web/src/components/button.tsx": "export const B = () => null;\n" });
  t.after(() => repo.cleanup());
  repo.commit({ "apps/web/src/components/button.tsx": "export const B = () => 1;\n" });
  assert.equal(gate(repo.root).status, 1);
});

test("edge: a migration without a migration test blocks; Migration-Waiver passes", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  repo.commit({ "packages/database/drizzle/0037_x.sql": "select 1;\n" });
  assert.equal(gate(repo.root).status, 1);
  assert.equal(gate(repo.root, { PR_BODY: "Migration-Waiver: additive column, verified by db:migrate" }).status, 0);
});

test("edge: a new module that does not exist on the base counts as RED", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  repo.commit({ [IVA_SRC]: IVA_FIXED, [IVA_TEST_PATH]: IVA_TEST });
  const res = gate(repo.root);
  assert.equal(res.status, 0, res.stdout + res.stderr);
});

// ----------------------------------------------------------- regression cases

test("regression: tests that already pass on the old code prove nothing and block", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_FIXED });
  t.after(() => repo.cleanup());
  repo.commit({ [IVA_SRC]: IVA_FIXED + "// comment\n", [IVA_TEST_PATH]: IVA_TEST });
  const res = gate(repo.root);
  assert.equal(res.status, 1);
  assert.match(res.stdout + res.stderr, /RED/);
});

test("regression: TDD-Waiver refactor inverts the proof: tests must pass on the base", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_FIXED });
  t.after(() => repo.cleanup());
  repo.commit({ [IVA_SRC]: IVA_FIXED + "// refactor\n", [IVA_TEST_PATH]: IVA_TEST });
  assert.equal(gate(repo.root, { PR_BODY: "TDD-Waiver: refactor, no behaviour change" }).status, 0);

  const buggy = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => buggy.cleanup());
  buggy.commit({ [IVA_SRC]: IVA_FIXED, [IVA_TEST_PATH]: IVA_TEST });
  assert.equal(gate(buggy.root, { PR_BODY: "TDD-Waiver: refactor, no behaviour change" }).status, 1);
});

test("regression: a fix whose test lives under [businessId] and fails on the base passes", (t) => {
  const dir = "apps/web/src/app/intake/[businessId]";
  const repo = makeRepo({ [`${dir}/iva.ts`]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  repo.commit({ [`${dir}/iva.test.ts`]: IVA_TEST }, "test(iva): RED");
  repo.commit({ [`${dir}/iva.ts`]: IVA_FIXED }, "fix(iva): 13%");
  const res = gate(repo.root);
  assert.equal(res.status, 0, res.stdout + res.stderr);
});

// ---------------------------------------------------------------- happy paths

test("happy: a fix with tests failing on the base and passing now passes", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  repo.commit({ [IVA_TEST_PATH]: IVA_TEST }, "test(iva): RED");
  repo.commit({ [IVA_SRC]: IVA_FIXED }, "fix(iva): 13%");
  const res = gate(repo.root);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(git(repo.root, "worktree", "list").split("\n").length, 1);
});
