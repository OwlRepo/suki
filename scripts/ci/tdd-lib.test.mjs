import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_OF,
  checkTitles,
  classifyChanges,
  extractTestTitles,
  findBashWriteTargets,
  globSafe,
  isGuardedSource,
  judgeRed,
  parseTapFailures,
  parseVitestJson,
  parseWaivers,
} from "./tdd-lib.mjs";

// ---------------------------------------------------------------- error cases

test("error: a title without a prefix is a violation", () => {
  const violations = checkTitles({
    added: [{ file: "apps/web/src/lib/a.test.ts", title: "computes tax", prefix: null, dynamic: false }],
    newFiles: [],
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /apps\/web\/src\/lib\/a\.test\.ts/);
  assert.match(violations[0], /computes tax/);
});

test("error: a happy case with no error or edge case in the PR is a violation", () => {
  const violations = checkTitles({
    added: [{ file: "apps/web/src/lib/a.test.ts", title: "happy: ok", prefix: "happy", dynamic: false }],
    newFiles: [],
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /error:|edge:/);
});

test("error: in a new file, an edge declared after a happy is a violation", () => {
  const violations = checkTitles({
    added: [],
    newFiles: [
      {
        path: "apps/api/src/b.spec.ts",
        titles: [
          { title: "error: x", prefix: "error", dynamic: false },
          { title: "happy: y", prefix: "happy", dynamic: false },
          { title: "edge: z", prefix: "edge", dynamic: false },
        ],
      },
    ],
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /edge: z/);
});

test("error: a title starting with an interpolation cannot be classified", () => {
  const titles = extractTestTitles("it(`${kase} fails`, () => {});");
  assert.equal(titles.length, 1);
  assert.equal(titles[0].dynamic, true);
  const violations = checkTitles({ added: titles.map((t) => ({ ...t, file: "x.test.ts" })), newFiles: [] });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /interpolation/i);
});

test("error: only happy failures is not a valid RED", () => {
  const verdict = judgeRed({ testLevel: ["happy: saves"], fileLevel: [] });
  assert.equal(verdict.red, false);
  assert.match(verdict.reason, /error:|edge:|regression:/);
});

test("error: no failures is not RED", () => {
  assert.equal(judgeRed({ testLevel: [], fileLevel: [] }).red, false);
});

test("error: parseTapFailures and parseVitestJson survive empty output", () => {
  assert.deepEqual(parseTapFailures("", []), { testLevel: [], fileLevel: [] });
  assert.deepEqual(parseTapFailures(undefined, []), { testLevel: [], fileLevel: [] });
  assert.deepEqual(parseVitestJson("", "/r", "apps/web"), { testLevel: [], fileLevel: [] });
  assert.deepEqual(parseVitestJson("{not json", "/r", "apps/web"), { testLevel: [], fileLevel: [] });
});

test("error: a vitest file that fails to load is a file-level failure", () => {
  const json = JSON.stringify({
    testResults: [
      {
        name: "/r/apps/web/src/lib/nuevo.test.ts",
        status: "failed",
        message: "Failed to load url ./nuevo",
        assertionResults: [],
      },
    ],
  });
  assert.deepEqual(parseVitestJson(json, "/r", "apps/web"), {
    testLevel: [],
    fileLevel: ["apps/web/src/lib/nuevo.test.ts"],
  });
});

// ----------------------------------------------------------------- edge cases

test("edge: parseWaivers with a null or empty body grants nothing", () => {
  for (const body of [null, undefined, "", "   "]) {
    assert.deepEqual(parseWaivers(body), { tdd: null, migration: null });
  }
});

test("edge: parseWaivers accepts any case and position but requires a reason", () => {
  const body = "Summary\n\n  tdd-waiver: refactor with no behaviour change\nMigration-Waiver:\n";
  const w = parseWaivers(body);
  assert.equal(w.tdd, "refactor with no behaviour change");
  assert.equal(w.migration, null);
});

test("edge: classifyChanges ignores deletions and pure renames", () => {
  const groups = classifyChanges([
    { status: "D", path: "apps/api/src/old.ts" },
    { status: "R100", path: "apps/api/src/moved.ts" },
    { status: "R087", path: "apps/api/src/edited-move.ts" },
  ]);
  assert.deepEqual(groups.logic, ["apps/api/src/edited-move.ts"]);
});

test("edge: every test kind lands in its own group", () => {
  const groups = classifyChanges([
    { status: "A", path: "apps/web/src/lib/a.test.ts" },
    { status: "A", path: "apps/web/src/components/b.test.tsx" },
    { status: "A", path: "apps/api/src/billing/c.spec.ts" },
    { status: "A", path: "packages/types/src/d.spec.ts" },
    { status: "A", path: "scripts/ci/x.test.mjs" },
    { status: "A", path: "packages/database/drizzle/0037_x.sql" },
    { status: "A", path: "packages/database/tests/0037_x.test.ts" },
    { status: "M", path: "docs/ai/planning.md" },
  ]);
  assert.deepEqual(groups.webTests, ["apps/web/src/lib/a.test.ts", "apps/web/src/components/b.test.tsx"]);
  assert.deepEqual(groups.apiTests, ["apps/api/src/billing/c.spec.ts"]);
  assert.deepEqual(groups.typesTests, ["packages/types/src/d.spec.ts"]);
  assert.deepEqual(groups.scriptTests, ["scripts/ci/x.test.mjs"]);
  assert.deepEqual(groups.migrations, ["packages/database/drizzle/0037_x.sql"]);
  assert.deepEqual(groups.migrationTests, ["packages/database/tests/0037_x.test.ts"]);
  assert.deepEqual(groups.logic, []);
});

test("edge: a .tsx component counts as logic that needs a test (no e2e layer here)", () => {
  const groups = classifyChanges([{ status: "M", path: "apps/web/src/components/button.tsx" }]);
  assert.deepEqual(groups.logic, ["apps/web/src/components/button.tsx"]);
});

test("edge: WORKSPACE_OF maps each vitest kind to its workspace", () => {
  assert.deepEqual(WORKSPACE_OF, { webTests: "apps/web", apiTests: "apps/api", typesTests: "packages/types" });
});

test("edge: extractTestTitles reads multi-line titles, it, only/skip and single quotes", () => {
  const src = [
    "it(",
    '  "error: multi-line",',
    "  () => {},",
    ");",
    "test('edge: with test', () => {});",
    'it.skip("happy: skipped", () => {});',
    'describe("group without prefix", () => {});',
  ].join("\n");
  assert.deepEqual(
    extractTestTitles(src).map((t) => [t.title, t.prefix]),
    [
      ["error: multi-line", "error"],
      ["edge: with test", "edge"],
      ["happy: skipped", "happy"],
    ],
  );
});

test("edge: a template literal with a literal prefix is classified", () => {
  const [t] = extractTestTitles("it(`edge: ${n} rows`, () => {});");
  assert.equal(t.prefix, "edge");
  assert.equal(t.dynamic, false);
});

test("edge: parseTapFailures splits file load failures and skips suites", () => {
  const tap = [
    "TAP version 13",
    "# Subtest: group",
    "    # Subtest: edge: inside",
    "    not ok 1 - edge: inside",
    "      ---",
    "      type: 'test'",
    "      ...",
    "not ok 1 - group",
    "  ---",
    "  type: 'suite'",
    "  ...",
    "# Subtest: scripts/ci/b.test.mjs",
    "not ok 2 - scripts/ci/b.test.mjs",
    "  ---",
    "  type: 'test'",
    "  ...",
  ].join("\n");
  assert.deepEqual(parseTapFailures(tap, ["scripts/ci/a.test.mjs", "scripts/ci/b.test.mjs"]), {
    testLevel: ["edge: inside"],
    fileLevel: ["scripts/ci/b.test.mjs"],
  });
});

test("edge: parseVitestJson collects failed assertion titles, not describe names", () => {
  const json = JSON.stringify({
    testResults: [
      {
        name: "/r/apps/api/src/x.spec.ts",
        status: "failed",
        assertionResults: [
          { title: "error: rejects", fullName: "Svc error: rejects", status: "failed" },
          { title: "happy: works", fullName: "Svc happy: works", status: "passed" },
        ],
      },
    ],
  });
  assert.deepEqual(parseVitestJson(json, "/r", "apps/api"), { testLevel: ["error: rejects"], fileLevel: [] });
});

test("edge: a load failure with no test failures counts as RED (module not written yet)", () => {
  assert.equal(judgeRed({ testLevel: [], fileLevel: ["apps/web/src/lib/new.test.ts"] }).red, true);
});

test("edge: isGuardedSource only guards workspace src logic", () => {
  for (const p of [
    "apps/web/src/lib/a.ts",
    "apps/web/src/components/b.tsx",
    "apps/api/src/billing/billing.service.ts",
    "packages/types/src/index.ts",
  ]) {
    assert.equal(isGuardedSource(p), true, p);
  }
  for (const p of [
    "packages/database/src/schema/index.ts",
    "packages/ui/src/Button.tsx",
    "apps/web/src/lib/a.test.ts",
    "apps/web/src/lib/a.test.tsx",
    "apps/api/src/billing/billing.service.spec.ts",
    "apps/web/src/test/setup.ts",
    "apps/api/src/test/setup.ts",
    "apps/web/src/types/x.d.ts",
    "packages/database/drizzle/0001_x.sql",
    "packages/database/scripts/migrate.ts",
    "scripts/ci/x.mjs",
    "docs/a.md",
    "src/lib/a.ts",
  ]) {
    assert.equal(isGuardedSource(p), false, p);
  }
});

test("edge: findBashWriteTargets ignores reads that only mention src/", () => {
  assert.deepEqual(findBashWriteTargets("grep -n foo apps/web/src/lib/a.ts > /tmp/out.txt"), ["/tmp/out.txt"]);
  assert.deepEqual(findBashWriteTargets("cat apps/web/src/lib/a.ts | head"), []);
  assert.deepEqual(findBashWriteTargets("sed -n 1,20p apps/web/src/lib/a.ts"), []);
});

test("edge: findBashWriteTargets detects sed -i, perl -i, tee, redirection and cp/mv", () => {
  assert.deepEqual(findBashWriteTargets("sed -i '' 's/a/b/' apps/web/src/lib/a.ts"), ["apps/web/src/lib/a.ts"]);
  assert.deepEqual(findBashWriteTargets("perl -pi -e 's/a/b/' src/a.ts src/b.ts"), ["src/a.ts", "src/b.ts"]);
  assert.deepEqual(findBashWriteTargets("echo x | tee -a src/a.ts"), ["src/a.ts"]);
  assert.deepEqual(findBashWriteTargets("cat > 'src/a.ts' <<'EOF'"), ["src/a.ts"]);
  assert.deepEqual(findBashWriteTargets("cp /tmp/x.ts src/a.ts && mv a b"), ["src/a.ts", "b"]);
});

test("edge: globSafe leaves a path without brackets untouched and escapes each bracket", () => {
  assert.equal(globSafe("scripts/ci/tdd-lib.test.mjs"), "scripts/ci/tdd-lib.test.mjs");
  assert.equal(globSafe("scripts/[id]/a.test.mjs"), "scripts/[[]id]/a.test.mjs");
});

// ----------------------------------------------------------- regression cases

test("regression: a test( inside a string or comment (fixture) is not a case", () => {
  const src = [
    'const fixture = "test(\\"happy: fake\\", () => {})";',
    "const tpl = `it('happy: also fake', () => {})`;",
    '// test("happy: commented")',
    "/* it('happy: block') */",
    'it("error: the only real one", () => {});',
  ].join("\n");
  assert.deepEqual(
    extractTestTitles(src).map((t) => t.title),
    ["error: the only real one"],
  );
});

test("regression: a > inside quotes or a comment is not a redirection", () => {
  assert.deepEqual(findBashWriteTargets('git commit -m "note: > src/foo.ts needs work"'), []);
  assert.deepEqual(findBashWriteTargets("echo hi # > src/foo.ts"), []);
  assert.deepEqual(findBashWriteTargets('echo "x" > "src/a.ts" # comment'), ["src/a.ts"]);
});

test("regression: 2>&1 is not a file write", () => {
  assert.deepEqual(findBashWriteTargets("bun run test 2>&1 | tail"), []);
});

test("regression: a Next dynamic route folder [businessId] is classified as a web test", () => {
  const groups = classifyChanges([{ status: "A", path: "apps/web/src/app/intake/[businessId]/x.test.ts" }]);
  assert.deepEqual(groups.webTests, ["apps/web/src/app/intake/[businessId]/x.test.ts"]);
});

// ---------------------------------------------------------------- happy paths

test("happy: a PR with error, edge and happy in order has no violations", () => {
  const src = 'it("error: a", () => {});\nit("edge: b", () => {});\nit("happy: c", () => {});';
  const titles = extractTestTitles(src);
  assert.deepEqual(
    checkTitles({
      added: titles.map((t) => ({ ...t, file: "apps/web/src/lib/n.test.ts" })),
      newFiles: [{ path: "apps/web/src/lib/n.test.ts", titles }],
    }),
    [],
  );
});

test("happy: a failing error or regression case is a valid RED", () => {
  assert.equal(judgeRed({ testLevel: ["error: rejects"], fileLevel: [] }).red, true);
  assert.equal(judgeRed({ testLevel: ["regression: bug 12"], fileLevel: [] }).red, true);
});
