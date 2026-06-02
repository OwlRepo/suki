import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("imports mobile example", () => {
  it("shows the required +63 mobile format in paste CSV guidance", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/imports/page.tsx"),
      "utf8",
    );

    expect(source).toContain("Alice,+639171234567");
    expect(source).not.toContain("Alice,555-1234");
  });
});
