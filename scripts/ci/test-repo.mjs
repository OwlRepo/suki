// Disposable git repos for the tdd-* integration tests. Not a test file itself.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(new URL("../..", import.meta.url).pathname);

export function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function write(root, rel, content) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

// Base commit on `main`, then a `feature` branch checked out. `origin/main` is faked
// as a local ref so the scripts' default base resolves without a network remote.
// The root node_modules is symlinked so the fixture's vitest workspaces resolve
// `vitest` and `node_modules/.bin/vitest` exactly like the real monorepo.
export function makeRepo(baseFiles = {}) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "tdd-repo-")));
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "t@t.test");
  git(root, "config", "user.name", "t");
  git(root, "config", "commit.gpgsign", "false");
  write(root, ".gitignore", "node_modules\n");
  for (const [rel, content] of Object.entries(baseFiles)) write(root, rel, content);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
  git(root, "update-ref", "refs/remotes/origin/main", "HEAD");
  git(root, "checkout", "-q", "-b", "feature");
  symlinkSync(path.join(REPO_ROOT, "node_modules"), path.join(root, "node_modules"));
  return {
    root,
    commit(files, message = "change") {
      for (const [rel, content] of Object.entries(files)) {
        if (content === null) git(root, "rm", "-q", rel);
        else write(root, rel, content);
      }
      git(root, "add", "-A");
      git(root, "commit", "-q", "-m", message);
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

// A vitest fixture in the `apps/web` workspace: the buggy version applies 10% and
// accepts negatives; the fixed one applies 13% and rejects negatives.
export const IVA_SRC = "apps/web/src/lib/iva.ts";
export const IVA_TEST_PATH = "apps/web/src/lib/iva.test.ts";
export const IVA_BUGGY = "export const iva = (n: number): number => n * 0.1;\n";
export const IVA_FIXED =
  'export const iva = (n: number): number => {\n  if (n < 0) throw new Error("negative");\n  return Math.round(n * 13) / 100;\n};\n';
export const IVA_TEST = [
  'import { expect, it } from "vitest";',
  'import { iva } from "./iva";',
  'it("error: rejects negative amounts", () => { expect(() => iva(-1)).toThrow(); });',
  'it("edge: zero gives zero", () => { expect(iva(0)).toBe(0); });',
  'it("happy: 13% of 100", () => { expect(iva(100)).toBe(13); });',
  "",
].join("\n");
