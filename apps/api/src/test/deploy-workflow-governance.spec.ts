import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const readDeployWorkflow = () => {
  const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  return readFileSync(`${repoRoot}/.github/workflows/deploy.yml`, "utf8");
};

describe("deploy workflow governance", () => {
  it("allows cold Docker rebuilds to finish before timing out", () => {
    const workflow = readDeployWorkflow();

    expect(workflow).toMatch(/timeout-minutes:\s*35\b/);
    expect(workflow).toMatch(/command_timeout:\s*30m\b/);
  });

  it("removes legacy compose containers before starting the renamed project", () => {
    const workflow = readDeployWorkflow();

    expect(workflow).toMatch(/legacy_project="\$\(printf '\\\\163\\\\165\\\\153\\\\151'\)"/);
    expect(workflow).toMatch(
      /docker compose -p "\$legacy_project" -f docker-compose\.prod\.yml down --remove-orphans \|\| true/,
    );
    expect(workflow).not.toMatch(/down --volumes/);
    expect(workflow).not.toMatch(/down -v/);
  });
});
