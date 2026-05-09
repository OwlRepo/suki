import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("global theme", () => {
  it("is white-only and has no dark mode selectors", () => {
    const cssPath = path.resolve(__dirname, "./globals.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).not.toContain("@custom-variant dark");
    expect(css).not.toContain(".dark {");
  });
});
