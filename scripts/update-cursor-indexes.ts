#!/usr/bin/env bun
/**
 * Cursor Index Updater
 * Updates .cursor/file-index/*.md based on staged or specified file changes.
 * Supports monorepo: apps/web, apps/api, packages/*
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const CURSOR_DIR = join(ROOT, ".cursor");
const DRY_RUN = process.argv.includes("--dry-run");

type ChangeType = "added" | "modified" | "deleted" | "renamed";

interface FileChange {
  path: string;
  type: ChangeType;
  oldPath?: string;
}

const INDEX_MAPPING: Array<{
  pattern: RegExp;
  indexFile: string;
}> = [
  { pattern: /^apps\/web\/src\/.*\.tsx$/, indexFile: "components-index.md" },
  { pattern: /^apps\/web\/src\/app\/([^/]+\/)?page\.tsx$/, indexFile: "routes-index.md" },
  { pattern: /^apps\/web\/src\/app\/layout\.tsx$/, indexFile: "routes-index.md" },
  { pattern: /^packages\/ui\/src\/.*\.tsx$/, indexFile: "components-index.md" },
  { pattern: /^apps\/api\/src\/.*\.controller\.ts$/, indexFile: "controllers-index.md" },
  { pattern: /^apps\/api\/src\/.*\.service\.ts$/, indexFile: "services-index.md" },
  { pattern: /^packages\/database\/src\/schema\/.*\.ts$/, indexFile: "models-index.md" },
  { pattern: /^packages\/types\/src\/.*\.ts$/, indexFile: "utils-index.md" },
  { pattern: /^packages\/database\/.*\.ts$/, indexFile: "utils-index.md" },
  { pattern: /^apps\/web\/src\/.*\.tsx$/, indexFile: "hooks-index.md" }, // hooks can live alongside components
  { pattern: /^apps\/web\/src\/.*$/, indexFile: "src-index.md" },
  { pattern: /^apps\/api\/src\/.*$/, indexFile: "src-index.md" },
  { pattern: /^packages\/[^/]+\/src\/.*$/, indexFile: "src-index.md" },
];

function getStagedChanges(): FileChange[] {
  try {
    const out = execSync("git diff --cached --name-status", {
      cwd: ROOT,
      encoding: "utf-8",
    });
    const changes: FileChange[] = [];
    for (const line of out.trim().split("\n").filter(Boolean)) {
      const parts = line.split("\t");
      const status = parts[0];
      const path = parts[1]?.trim();
      const oldPath = parts[2]?.trim();
      if (!path) continue;
      if (path.includes("node_modules") || path.includes(".next") || path.includes("/dist/"))
        continue;
      if (status === "A") changes.push({ path, type: "added" });
      else if (status === "M") changes.push({ path, type: "modified" });
      else if (status === "D") changes.push({ path, type: "deleted" });
      else if (status.startsWith("R") && oldPath) changes.push({ path, type: "renamed", oldPath });
    }
    return changes;
  } catch {
    return [];
  }
}

function getAffectedIndexFiles(changes: FileChange[]): Set<string> {
  const indexes = new Set<string>();
  for (const c of changes) {
    for (const { pattern, indexFile } of INDEX_MAPPING) {
      if (pattern.test(c.path) || (c.oldPath && pattern.test(c.oldPath))) {
        indexes.add(indexFile);
      }
    }
  }
  return indexes;
}

function updateIndexFile(indexName: string) {
  const indexPath = join(CURSOR_DIR, "file-index", indexName);
  if (!existsSync(indexPath)) return;
  let content = readFileSync(indexPath, "utf-8");
  const tsMatch = content.match(/Last updated: (.+)/);
  const newTs = `Last updated: ${new Date().toISOString()}`;
  if (tsMatch) {
    content = content.replace(tsMatch[0], newTs);
  } else {
    content = newTs + "\n\n" + content;
  }
  if (!DRY_RUN) {
    writeFileSync(indexPath, content, "utf-8");
  }
  console.log(DRY_RUN ? `[dry-run] would update ${indexName}` : `Updated ${indexName}`);
}

function main() {
  const explicitFiles = process.argv.filter(
    (a) => !a.startsWith("-") && (a.endsWith(".ts") || a.endsWith(".tsx"))
  );
  const changes: FileChange[] = explicitFiles.length
    ? explicitFiles.map((p) => ({ path: p, type: "modified" as ChangeType }))
    : getStagedChanges();

  if (changes.length === 0 && !explicitFiles.length) {
    console.log("No staged changes. Use --dry-run with no staging to test, or pass files.");
    return;
  }

  const indexes = getAffectedIndexFiles(changes);
  if (indexes.size === 0) {
    console.log("No file-index files affected by these changes.");
    return;
  }

  for (const idx of indexes) {
    updateIndexFile(idx);
  }

  if (!DRY_RUN && indexes.size > 0) {
    try {
      for (const idx of indexes) {
        execSync(`git add ${join(CURSOR_DIR, "file-index", idx)}`, { cwd: ROOT });
      }
    } catch {
      // Ignore if not in git
    }
  }
}

main();
