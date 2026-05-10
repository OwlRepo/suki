import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  loadAssistantContextEntries,
  parseAssistantContextMarkdown,
  type AssistantMarkdownFrontmatter,
} from "./assistant-context-loader";

describe("assistant markdown context loader", () => {
  it("parses markdown frontmatter and steps", () => {
    const markdown = `---\nid: en-customers-add\nlocale: en\ncategory: customers\nintents: [\"add customer\", \"new customer\"]\nrelatedRoutes: [\"/customers\"]\ntoolBindings: [\"route_guidance\"]\npriority: high\nlastUpdated: 2026-05-10\nquickAnswer: Go to Customers and tap Add customer.\n---\n- Go to Customers\n- Tap Add customer\n- Save customer\n`;

    const parsed = parseAssistantContextMarkdown(markdown);
    expect((parsed.frontmatter as AssistantMarkdownFrontmatter).id).toBe("en-customers-add");
    expect(parsed.steps).toEqual([
      "Go to Customers",
      "Tap Add customer",
      "Save customer",
    ]);
  });

  it("loads EN and TL markdown entries from docs/assistant-context", () => {
    const rootDir = path.resolve(__dirname, "../../../../");
    const entries = loadAssistantContextEntries(rootDir);
    const locales = new Set(entries.map((entry) => entry.locale));
    expect(locales.has("en")).toBe(true);
    expect(locales.has("tl")).toBe(true);
    expect(entries.length).toBeGreaterThanOrEqual(10);
  });

  it("fails on malformed frontmatter", () => {
    const bad = `---\nlocale: en\n---\n- Step one`;
    expect(() => parseAssistantContextMarkdown(bad)).toThrow(/missing required frontmatter/i);
  });
});
