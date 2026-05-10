import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Settings page free-default copy", () => {
  const file = readFileSync(
    join(process.cwd(), "apps/web/src/app/(dashboard)/settings/page.tsx"),
    "utf8",
  );

  it("uses free-default messaging", () => {
    expect(file.toLowerCase()).toContain("free by default");
    expect(file).toContain("usage caps");
  });

  it("does not render plan simulation UI", () => {
    expect(file).not.toContain("Plan simulation (UI only)");
    expect(file).not.toContain("Clear simulation");
  });
});
