import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

const textExtensions = new Set(["", ".css", ".env", ".html", ".json", ".md", ".mjs", ".sh", ".sql", ".ts", ".tsx", ".txt", ".yml", ".lock"]);
// These tokens keep existing sessions, preferences, records, and infrastructure usable.
const compatibilityTerms = /suki\.tyvera\.app|tyvera_session|tyvera-sidebar-collapsed-v1|tyvera-onboarding-events|tyvera_dev_|tyvera:intake:|tyvera-assistant(?:-coachmark-dismissed-v1|-header-collapsed-v1)?|TyveraAssistant|auto_tyvera| Sent automatically by Tyvera|legacy Tyvera|tyveraacr\.azurecr\.io|tyvera-api|tyvera-base|tyvera-backups|tyvera-\*\.sql/g;

function unexplainedLegacyText(file: string, content: string): boolean {
  let remaining = content.replace(compatibilityTerms, "").replaceAll("suki\\.tyvera\\.app", "");
  // Existing database and server names are intentionally not migrated by an app rename.
  if (file.startsWith("packages/database/") || file.startsWith("docker-compose") || file === ".env.example" || file === ".github/workflows/deploy.yml") {
    remaining = remaining.replace(/\btyvera\b/g, "");
  }
  remaining = remaining.replace(/~\/apps\/tyvera\b|database `tyvera`/g, "");
  return /tyvera/i.test(remaining);
}

describe("rebrand governance", () => {
  it("regression: permits documented compatibility references but rejects legacy app branding", () => {
    expect(unexplainedLegacyText("page.tsx", "Welcome to Tyvera")).toBe(true);
    expect(unexplainedLegacyText("page.tsx", "https://tyvera.app")).toBe(true);
    expect(unexplainedLegacyText("page.tsx", "https://suki.tyvera.app")).toBe(false);
    expect(unexplainedLegacyText("guard.ts", 'const legacy = "tyvera_session"')).toBe(false);
  });

  it("regression: keeps tracked application text and paths branded Suki", () => {
    const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", cwd: repoRoot }).split("\n");
    const violations: string[] = [];
    for (const file of new Set(files)) {
      if (!file || !existsSync(`${repoRoot}/${file}`)) continue;
      // Historical plans/migrations and their derived graph retain their original evidence.
      if (file === "apps/api/src/test/rebrand-governance.spec.ts" || file === "docs/ai/suki-rename-compatibility.md" || file.startsWith("docs/plans/") || file.startsWith("packages/database/drizzle/") || file.startsWith("graphify-out/")) continue;
      if (unexplainedLegacyText(file, file)) violations.push(`${file}: legacy path`);
      if (!textExtensions.has(extname(file))) continue;
      if (unexplainedLegacyText(file, readFileSync(`${repoRoot}/${file}`, "utf8"))) violations.push(`${file}: unexplained legacy text`);
    }
    expect(violations).toEqual([]);
  });
});
