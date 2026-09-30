import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { git, makeRepo } from "../ci/test-repo.mjs";

const GUARD = new URL("./tdd-red-guard.mjs", import.meta.url).pathname;
const SRC = "apps/web/src/lib/iva.ts";

const guard = (input, cwd = process.cwd()) =>
  spawnSync(process.execPath, [GUARD], {
    cwd,
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
  });

const edit = (root, rel) => ({ tool_name: "Edit", cwd: root, tool_input: { file_path: path.join(root, rel) } });
const bash = (root, command) => ({ tool_name: "Bash", cwd: root, tool_input: { command } });

function writeMarker(root, marker) {
  const gitDir = git(root, "rev-parse", "--absolute-git-dir");
  writeFileSync(path.join(gitDir, "tdd-red.json"), typeof marker === "string" ? marker : JSON.stringify(marker));
}

const VALID = (branch = "feature") => ({
  branch,
  testFiles: ["apps/web/src/lib/iva.test.ts"],
  failedTitles: ["error: rejects negatives"],
  at: "2026-10-01T00:00:00.000Z",
});

// ---------------------------------------------------------------- error cases

test("error: stdin that is not JSON does not block (fail-open) but warns", () => {
  const res = guard("this is not json");
  assert.equal(res.status, 0);
  assert.match(res.stderr, /tdd-red-guard/);
});

test("error: an edit without file_path does not block", () => {
  assert.equal(guard({ tool_name: "Edit", tool_input: {} }).status, 0);
});

test("error: a corrupt marker blocks with a clear message", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  writeMarker(repo.root, "{broken");
  const res = guard(edit(repo.root, SRC));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /tdd:red/);
});

test("error: editing workspace src logic without a marker blocks", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  const res = guard(edit(repo.root, SRC));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /RED/);
});

// ----------------------------------------------------------------- edge cases

test("edge: a marker from another branch is not valid", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  writeMarker(repo.root, VALID("other-branch"));
  assert.equal(guard(edit(repo.root, SRC)).status, 2);
});

test("edge: tests, docs, scripts, migrations and test setup are never blocked", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  for (const rel of [
    "apps/web/src/lib/iva.test.ts",
    "apps/api/src/billing/billing.service.spec.ts",
    "apps/web/src/test/setup.ts",
    "docs/a.md",
    "scripts/ci/x.mjs",
    "packages/database/drizzle/0037_x.sql",
    "packages/database/scripts/migrate.ts",
  ]) {
    assert.equal(guard(edit(repo.root, rel)).status, 0, rel);
  }
});

test("edge: a file outside any git repo is not blocked", () => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "no-git-")));
  assert.equal(guard({ tool_name: "Write", cwd: dir, tool_input: { file_path: path.join(dir, SRC) } }).status, 0);
});

test("edge: read-only Bash that mentions src/ is not blocked", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  assert.equal(guard(bash(repo.root, `grep -n iva ${SRC} > /tmp/x.txt`)).status, 0);
  assert.equal(guard(bash(repo.root, `sed -n 1,5p ${SRC}`)).status, 0);
});

test("edge: Bash sed -i on a test is allowed; on logic it blocks", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  assert.equal(guard(bash(repo.root, "sed -i '' 's/a/b/' apps/web/src/lib/iva.test.ts")).status, 0);
  assert.equal(guard(bash(repo.root, `sed -i '' 's/a/b/' ${SRC}`)).status, 2);
});

test("edge: relative Bash paths resolve against the tool cwd", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  const cmd = { tool_name: "Bash", cwd: path.join(repo.root, "apps/web"), tool_input: { command: "echo x > src/lib/iva.ts" } };
  assert.equal(guard(cmd).status, 2);
});

test("edge: on main without a marker it also blocks", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  git(repo.root, "checkout", "-q", "main");
  assert.equal(guard(edit(repo.root, SRC)).status, 2);
});

test("edge: a waiver marker with a reason allows the edit", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  writeMarker(repo.root, { branch: "feature", waiver: "copy only", at: "2026-10-01T00:00:00.000Z" });
  assert.equal(guard(edit(repo.root, SRC)).status, 0);
});

test("edge: on a detached HEAD a marker recorded at another commit is not valid", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  const first = git(repo.root, "rev-parse", "HEAD");
  repo.commit({ "docs/a.md": "x\n" });
  git(repo.root, "checkout", "-q", "--detach", "HEAD");
  writeMarker(repo.root, { ...VALID("HEAD"), head: first });
  assert.equal(guard(edit(repo.root, SRC)).status, 2);
  writeMarker(repo.root, { ...VALID("HEAD"), head: git(repo.root, "rev-parse", "HEAD") });
  assert.equal(guard(edit(repo.root, SRC)).status, 0);
});

// ----------------------------------------------------------- regression cases

test("regression: a marker where only happy cases failed does not allow editing", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  writeMarker(repo.root, { ...VALID(), failedTitles: ["happy: saves"] });
  assert.equal(guard(edit(repo.root, SRC)).status, 2);
});

// ---------------------------------------------------------------- happy paths

test("happy: with a valid RED marker the edit passes", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  writeMarker(repo.root, VALID());
  assert.equal(guard(edit(repo.root, SRC)).status, 0);
  assert.equal(guard(edit(repo.root, "apps/api/src/billing/billing.service.ts")).status, 0);
  assert.equal(guard(bash(repo.root, `sed -i '' 's/a/b/' ${SRC}`)).status, 0);
});
