import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { IVA_BUGGY, IVA_FIXED, IVA_SRC, IVA_TEST, IVA_TEST_PATH, git, makeRepo, write } from "./test-repo.mjs";

const RED = new URL("./tdd-red.mjs", import.meta.url).pathname;

const red = (cwd, args = [], env = {}) =>
  spawnSync(process.execPath, [RED, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...env } });

const markerPath = (cwd) => path.join(git(cwd, "rev-parse", "--absolute-git-dir"), "tdd-red.json");

// ---------------------------------------------------------------- error cases

test("error: no changed tests on the branch exits 1 and writes no marker", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  const res = red(repo.root);
  assert.equal(res.status, 1);
  assert.equal(existsSync(markerPath(repo.root)), false);
});

test("error: a missing base exits 2", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  assert.equal(red(repo.root, [], { TDD_RED_BASE: "origin/does-not-exist" }).status, 2);
});

test("error: when the new tests already pass there is no RED and no marker", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_FIXED });
  t.after(() => repo.cleanup());
  write(repo.root, IVA_TEST_PATH, IVA_TEST);
  const res = red(repo.root);
  assert.equal(res.status, 1);
  assert.match(res.stdout + res.stderr, /RED/);
  assert.equal(existsSync(markerPath(repo.root)), false);
});

// ----------------------------------------------------------------- edge cases

test("edge: an untracked (not yet committed) test file counts", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  write(repo.root, IVA_TEST_PATH, IVA_TEST);
  const res = red(repo.root);
  assert.equal(res.status, 0, res.stdout + res.stderr);
});

test("edge: --waiver with a reason writes a waiver marker", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  const res = red(repo.root, ["--waiver", "only renames a constant"]);
  assert.equal(res.status, 0);
  const marker = JSON.parse(readFileSync(markerPath(repo.root), "utf8"));
  assert.equal(marker.branch, "feature");
  assert.equal(marker.waiver, "only renames a constant");
});

test("edge: --waiver without a reason is rejected", (t) => {
  const repo = makeRepo();
  t.after(() => repo.cleanup());
  assert.equal(red(repo.root, ["--waiver"]).status, 2);
  assert.equal(red(repo.root, ["--waiver", "  "]).status, 2);
});

test("edge: the marker is per worktree, never shared", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  write(repo.root, IVA_TEST_PATH, IVA_TEST);
  assert.equal(red(repo.root).status, 0);
  const other = `${repo.root}-wt`;
  git(repo.root, "worktree", "add", "-q", "-b", "other", other, "main");
  t.after(() => rmSync(other, { recursive: true, force: true }));
  assert.equal(existsSync(markerPath(other)), false);
});

test("edge: an api spec failing in apps/api is found and run in its workspace", (t) => {
  const src = "apps/api/src/tax/iva.ts";
  const spec = "apps/api/src/tax/iva.spec.ts";
  const repo = makeRepo({ [src]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  write(repo.root, spec, IVA_TEST);
  const res = red(repo.root);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const marker = JSON.parse(readFileSync(markerPath(repo.root), "utf8"));
  assert.deepEqual(marker.testFiles, [spec]);
});

// ----------------------------------------------------------- regression cases

test("regression: when only happy tests fail there is no valid RED", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  write(
    repo.root,
    IVA_TEST_PATH,
    'import { expect, it } from "vitest";\nimport { iva } from "./iva";\nit("edge: zero", () => { expect(iva(0)).toBe(0); });\nit("happy: 13", () => { expect(iva(100)).toBe(13); });\n',
  );
  assert.equal(red(repo.root).status, 1);
});

test("regression: a failing test under a Next dynamic folder [businessId] counts as RED", (t) => {
  const repo = makeRepo({ "apps/web/src/app/intake/[businessId]/iva.ts": IVA_BUGGY });
  t.after(() => repo.cleanup());
  write(repo.root, "apps/web/src/app/intake/[businessId]/iva.test.ts", IVA_TEST);
  const res = red(repo.root);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /error: rejects negative amounts/);
  assert.equal(existsSync(markerPath(repo.root)), true);
});

// ---------------------------------------------------------------- happy paths

test("happy: failing error/edge tests write the marker with branch and titles", (t) => {
  const repo = makeRepo({ [IVA_SRC]: IVA_BUGGY });
  t.after(() => repo.cleanup());
  repo.commit({ [IVA_TEST_PATH]: IVA_TEST }, "test(iva): RED");
  const res = red(repo.root);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const marker = JSON.parse(readFileSync(markerPath(repo.root), "utf8"));
  assert.equal(marker.branch, "feature");
  assert.deepEqual(marker.testFiles, [IVA_TEST_PATH]);
  assert.ok(marker.failedTitles.includes("error: rejects negative amounts"));
  assert.match(marker.at, /^\d{4}-\d{2}-\d{2}T/);
});
