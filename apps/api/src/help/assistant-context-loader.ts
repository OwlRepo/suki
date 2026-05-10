import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type AssistantContextCategory =
  | "onboarding"
  | "customers"
  | "appointments"
  | "metrics"
  | "usage"
  | "troubleshooting"
  | "policies";

export type AssistantMarkdownFrontmatter = {
  id: string;
  locale: "en" | "tl";
  category: AssistantContextCategory;
  intents: string[];
  relatedRoutes: string[];
  toolBindings: string[];
  priority: "high" | "medium" | "low";
  lastUpdated: string;
  quickAnswer: string;
};

export type AssistantContextEntry = AssistantMarkdownFrontmatter & {
  steps: string[];
  sourceFile: string;
  hash: string;
};

export type ParsedAssistantMarkdown = {
  frontmatter: AssistantMarkdownFrontmatter;
  steps: string[];
};

const REQUIRED_KEYS: Array<keyof AssistantMarkdownFrontmatter> = [
  "id",
  "locale",
  "category",
  "intents",
  "relatedRoutes",
  "toolBindings",
  "priority",
  "lastUpdated",
  "quickAnswer",
];

let cache: { rootDir: string; mtimesKey: string; entries: AssistantContextEntry[] } | null = null;

export function parseAssistantContextMarkdown(markdown: string): ParsedAssistantMarkdown {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("missing required frontmatter delimiters");
  }
  const [, fmRaw, body] = match;
  const rawMap = parseFrontmatterMap(fmRaw);

  for (const key of REQUIRED_KEYS) {
    if (!(key in rawMap)) {
      throw new Error(`missing required frontmatter key: ${key}`);
    }
  }

  const frontmatter: AssistantMarkdownFrontmatter = {
    id: readString(rawMap.id),
    locale: readLocale(rawMap.locale),
    category: readCategory(rawMap.category),
    intents: readStringArray(rawMap.intents),
    relatedRoutes: readStringArray(rawMap.relatedRoutes),
    toolBindings: readStringArray(rawMap.toolBindings),
    priority: readPriority(rawMap.priority),
    lastUpdated: readString(rawMap.lastUpdated),
    quickAnswer: readString(rawMap.quickAnswer),
  };

  const steps = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);

  return { frontmatter, steps };
}

export function loadAssistantContextEntries(rootDir: string): AssistantContextEntry[] {
  const contextRoot = path.join(rootDir, "docs", "assistant-context");
  const files = collectMarkdownFiles(contextRoot);
  const mtimesKey = files
    .map((file) => `${file}:${fs.statSync(file).mtimeMs}`)
    .sort()
    .join("|");

  if (cache && cache.rootDir === rootDir && cache.mtimesKey === mtimesKey) {
    return cache.entries;
  }

  const entries = files.map((file) => {
    const source = fs.readFileSync(file, "utf8");
    const parsed = parseAssistantContextMarkdown(source);
    return {
      ...parsed.frontmatter,
      steps: parsed.steps,
      sourceFile: path.relative(rootDir, file),
      hash: crypto.createHash("sha1").update(source).digest("hex"),
    } satisfies AssistantContextEntry;
  });

  cache = { rootDir, mtimesKey, entries };
  return entries;
}

function collectMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      out.push(...collectMarkdownFiles(full));
      continue;
    }
    if (item.isFile() && full.endsWith(".md")) out.push(full);
  }
  return out;
}

function parseFrontmatterMap(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf(":");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    map[key] = value;
  }
  return map;
}

function readString(value: string): string {
  return String(value).trim();
}

function readStringArray(value: string): string[] {
  const raw = String(value).trim();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("not array");
    return parsed.map((item) => String(item));
  } catch {
    throw new Error(`invalid string array value: ${raw}`);
  }
}

function readLocale(value: string): "en" | "tl" {
  const v = readString(value) as "en" | "tl";
  if (v !== "en" && v !== "tl") throw new Error(`invalid locale: ${value}`);
  return v;
}

function readCategory(value: string): AssistantContextCategory {
  const v = readString(value) as AssistantContextCategory;
  const allowed: AssistantContextCategory[] = [
    "onboarding",
    "customers",
    "appointments",
    "metrics",
    "usage",
    "troubleshooting",
    "policies",
  ];
  if (!allowed.includes(v)) throw new Error(`invalid category: ${value}`);
  return v;
}

function readPriority(value: string): "high" | "medium" | "low" {
  const v = readString(value) as "high" | "medium" | "low";
  if (v !== "high" && v !== "medium" && v !== "low") {
    throw new Error(`invalid priority: ${value}`);
  }
  return v;
}
