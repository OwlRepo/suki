import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

const legacyLower = String.fromCharCode(115, 117, 107, 105);
const forbiddenTerms = [
  legacyLower[0].toUpperCase() + legacyLower.slice(1),
  legacyLower,
  legacyLower.toUpperCase(),
  `@${legacyLower}`,
];

const textExtensions = new Set([
  "",
  ".css",
  ".env",
  ".html",
  ".json",
  ".md",
  ".mjs",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
]);

describe("rebrand governance", () => {
  it("does not leave legacy brand references in tracked paths or text files", () => {
    const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    const trackedFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
      encoding: "utf8",
      cwd: repoRoot,
    })
      .split("\n")
      .filter((file) => file && existsSync(`${repoRoot}/${file}`));

    const violations: string[] = [];

    for (const file of trackedFiles) {
      for (const term of forbiddenTerms) {
        if (file.includes(term)) {
          violations.push(`${file}: path contains ${term}`);
        }
      }

      if (!textExtensions.has(extname(file))) continue;

      const content = readFileSync(`${repoRoot}/${file}`, "utf8");
      for (const term of forbiddenTerms) {
        if (content.includes(term)) {
          violations.push(`${file}: content contains ${term}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
