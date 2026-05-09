#!/usr/bin/env bun
/**
 * AI docs freshness stamper (markdown-only).
 * Updates metadata headers for docs/ai markdown files.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";

const root = join(import.meta.dir, "..");
const docsRoot = join(root, "docs", "ai");
const stamp = new Date().toISOString();

const defaultValidatedAgainst = [
  "package.json",
  "apps/web/package.json",
  "apps/api/package.json",
  "packages/database/package.json",
  "turbo.json",
  ".github/workflows/deploy.yml",
].join(", ");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (st.isFile() && p.endsWith(".md")) out.push(p);
  }
  return out;
}

function upsertMeta(content: string): string {
  const lines = content.split("\n");
  const hasLast = lines.some((l) => l.startsWith("Last updated:"));
  const hasValidated = lines.some((l) => l.startsWith("Validated against:"));
  const hasSource = lines.some((l) => l.startsWith("Source-of-truth inputs:"));

  let body = content;
  body = hasLast
    ? body.replace(/^Last updated:.*$/m, `Last updated: ${stamp}`)
    : `Last updated: ${stamp}\n${body}`;
  body = hasValidated
    ? body.replace(/^Validated against:.*$/m, `Validated against: ${defaultValidatedAgainst}`)
    : `Validated against: ${defaultValidatedAgainst}\n${body}`;
  body = hasSource
    ? body.replace(/^Source-of-truth inputs:.*$/m, "Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs")
    : `Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs\n${body}`;

  return body;
}

for (const file of walk(docsRoot)) {
  const prev = readFileSync(file, "utf8");
  const next = upsertMeta(prev);
  writeFileSync(file, next, "utf8");
  console.log(`Stamped ${file.replace(root + "/", "")}`);
}
