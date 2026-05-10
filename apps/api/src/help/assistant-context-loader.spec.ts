import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs";
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

  it("covers every dashboard route with EN and TL context entries", () => {
    const rootDir = path.resolve(__dirname, "../../../../");
    const entries = loadAssistantContextEntries(rootDir);
    const allRoutes = new Set(entries.flatMap((entry) => entry.relatedRoutes));

    const dashboardPages = fs
      .readdirSync(path.join(rootDir, "apps", "web", "src", "app", "(dashboard)"), { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
      .filter((name) => name !== "layout")
      .map((name) => `/${name}`);

    for (const route of dashboardPages) {
      expect(allRoutes.has(route), `missing route coverage for ${route}`).toBe(true);
      const en = entries.some((entry) => entry.locale === "en" && entry.relatedRoutes.includes(route));
      const tl = entries.some((entry) => entry.locale === "tl" && entry.relatedRoutes.includes(route));
      expect(en, `missing EN coverage for ${route}`).toBe(true);
      expect(tl, `missing TL coverage for ${route}`).toBe(true);
    }
  });

  it("keeps EN/TL parity for route coverage and doc id families", () => {
    const rootDir = path.resolve(__dirname, "../../../../");
    const entries = loadAssistantContextEntries(rootDir);
    const enEntries = entries.filter((entry) => entry.locale === "en");
    const tlEntries = entries.filter((entry) => entry.locale === "tl");

    const enRoutes = new Set(enEntries.flatMap((entry) => entry.relatedRoutes));
    const tlRoutes = new Set(tlEntries.flatMap((entry) => entry.relatedRoutes));
    for (const route of enRoutes) {
      expect(tlRoutes.has(route), `missing TL counterpart route ${route}`).toBe(true);
    }

    const enIds = new Set(enEntries.map((entry) => entry.id.replace(/^en-/, "")));
    const tlIds = new Set(tlEntries.map((entry) => entry.id.replace(/^tl-/, "")));
    for (const id of enIds) {
      expect(tlIds.has(id), `missing TL counterpart id for ${id}`).toBe(true);
    }
  });
});
