// Shared rules for the TDD gate (CI), `bun run tdd:red` (local) and the Claude
// PreToolUse guard. Pure functions only; the CLIs own git and process I/O.
// Rules: docs/ai/testing-strategy.md "Strict TDD".
import path from "node:path";

export const PREFIXES = ["error", "edge", "regression", "happy"];
const RED_PREFIXES = new Set(["error", "edge", "regression"]);

const TEST_SUFFIX = /\.(test|spec)\.tsx?$/;

// Workspace source logic, limited to the workspaces that have a vitest runner
// (apps/web, apps/api, packages/types). packages/database and packages/ui have no
// runner yet, so guarding them would block edits no test can unblock; add them
// here together with a WORKSPACE_OF entry once they get one.
// Test files, type declarations and test setup folders (src/test/) are not logic.
export function isGuardedSource(rel) {
  if (!/^(apps\/(web|api)|packages\/types)\/src\/.+\.tsx?$/.test(rel)) return false;
  if (TEST_SUFFIX.test(rel) || rel.endsWith(".d.ts")) return false;
  return !/^[^/]+\/[^/]+\/src\/test\//.test(rel);
}

// vitest kinds run inside their own workspace so each picks up its vitest.config.
export const WORKSPACE_OF = { webTests: "apps/web", apiTests: "apps/api", typesTests: "packages/types" };

export const RUNNABLE_KINDS = ["webTests", "apiTests", "typesTests", "scriptTests"];

function kindOf(rel) {
  if (/^apps\/web\/src\/.+\.(test|spec)\.tsx?$/.test(rel)) return "webTests";
  if (/^apps\/api\/src\/.+\.(test|spec)\.ts$/.test(rel)) return "apiTests";
  if (/^packages\/types\/src\/.+\.(test|spec)\.ts$/.test(rel)) return "typesTests";
  if (/^scripts\/.+\.test\.mjs$/.test(rel)) return "scriptTests";
  if (/^packages\/database\/drizzle\/.+\.sql$/.test(rel)) return "migrations";
  if (/^packages\/database\/tests\//.test(rel)) return "migrationTests";
  if (isGuardedSource(rel)) return "logic";
  return null;
}

// entries: [{ status: "A"|"M"|"D"|"R087"..., path }] as from `git diff --name-status`.
// Deleted files and pure renames (R100) carry no new behaviour to test.
export function classifyChanges(entries) {
  const groups = {
    logic: [],
    webTests: [],
    apiTests: [],
    typesTests: [],
    scriptTests: [],
    migrations: [],
    migrationTests: [],
  };
  for (const { status, path: rel } of entries) {
    if (status.startsWith("D") || status === "R100") continue;
    const kind = kindOf(rel);
    if (kind) groups[kind].push(rel);
  }
  return groups;
}

export function parseWaivers(body) {
  const out = { tdd: null, migration: null };
  if (!body) return out;
  const re = /^[ \t]*(tdd|migration)-waiver:[ \t]*(.*)$/gim;
  for (const m of body.matchAll(re)) {
    const reason = m[2].trim();
    if (reason) out[m[1].toLowerCase()] = reason;
  }
  return out;
}

// Blanks string, template and comment contents (newlines kept) so a `test(` inside
// a fixture string is not read as a real case. Quote strings end at a newline, which
// bounds the damage of a regex literal containing a quote to its own line.
function codeMask(source) {
  const out = source.split("");
  let state = "code";
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];
    if (state === "code") {
      if (c === "/" && next === "/") state = "line";
      else if (c === "/" && next === "*") state = "block";
      else if (c === '"' || c === "'" || c === "`") state = c;
      continue;
    }
    if (c === "\n") {
      if (state === "line" || state === '"' || state === "'") state = "code";
      continue;
    }
    out[i] = " ";
    if (state === "block" && c === "*" && next === "/") {
      out[i + 1] = " ";
      i++;
      state = "code";
    } else if ((state === '"' || state === "'" || state === "`") && c === "\\") {
      if (next !== "\n") out[i + 1] = " ";
      i++;
    } else if (state === c) {
      out[i] = c;
      state = "code";
    }
  }
  return out.join("");
}

// `test(` / `it(` with optional .only/.skip/.todo/.fails; describe is a grouping,
// not a case, so it carries no prefix requirement.
const CALL_RE = /\b(?:test|it)(?:\.(?:only|skip|todo|fixme|fails?|concurrent))?\s*\(\s*(?=["'`])/g;
const LITERAL_RE = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/y;

export function extractTestTitles(source) {
  const titles = [];
  if (!source) return titles;
  const masked = codeMask(source);
  for (const call of masked.matchAll(CALL_RE)) {
    LITERAL_RE.lastIndex = call.index + call[0].length;
    const m = LITERAL_RE.exec(source);
    if (!m) continue;
    const title = m[2];
    const dynamic = m[1] === "`" && title.startsWith("${");
    const pm = /^(error|edge|regression|happy):/.exec(title);
    titles.push({ title, prefix: pm ? pm[1] : null, dynamic });
  }
  return titles;
}

// added: titles introduced by the diff (any file). newFiles: full ordered titles of
// files created by the diff, where declaration order is also enforced.
export function checkTitles({ added, newFiles }) {
  const violations = [];
  for (const t of added) {
    if (t.dynamic) {
      violations.push(`${t.file}: "${t.title}" starts with an interpolation; the prefix (error:/edge:/regression:/happy:) must be literal`);
    } else if (!t.prefix) {
      violations.push(`${t.file}: "${t.title}" has no error:/edge:/regression:/happy: prefix`);
    }
  }
  const hasHappy = added.some((t) => t.prefix === "happy");
  const hasErrorOrEdge = added.some((t) => t.prefix === "error" || t.prefix === "edge");
  if (hasHappy && !hasErrorOrEdge) {
    violations.push("the PR adds happy: cases without any error: or edge: case");
  }
  for (const file of newFiles) {
    let seenHappy = false;
    for (const t of file.titles) {
      if (t.prefix === "happy") seenHappy = true;
      else if (seenHappy && (t.prefix === "error" || t.prefix === "edge")) {
        violations.push(`${file.path}: "${t.title}" is declared after a happy: case; error/edge cases go first`);
      }
    }
  }
  return violations;
}

// Reads node:test TAP. A top-level failure named after one of the run files is a
// file-level failure (usually a module that does not exist yet); suites are skipped.
export function parseTapFailures(tap, files) {
  const out = { testLevel: [], fileLevel: [] };
  if (!tap) return out;
  const lines = tap.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)not ok \d+ - (.*)$/.exec(lines[i]);
    if (!m) continue;
    const title = m[2].replace(/\\#/g, "#").trim();
    let type = "test";
    for (let j = i + 1; j < lines.length && j < i + 40; j++) {
      const tm = /^\s*type: '(\w+)'/.exec(lines[j]);
      if (tm) {
        type = tm[1];
        break;
      }
      if (/^\s*\.\.\.\s*$/.test(lines[j])) break;
    }
    if (type === "suite") continue;
    const isFile = m[1] === "" && files.some((f) => title === f || title.endsWith(`/${f}`) || f.endsWith(`/${title}`));
    (isFile ? out.fileLevel : out.testLevel).push(title);
  }
  return out;
}

// Reads vitest's JSON reporter. A failed file with no assertion results never
// loaded (usually a module that does not exist yet): that is a file-level failure.
export function parseVitestJson(text, root, workspace) {
  const out = { testLevel: [], fileLevel: [] };
  if (!text) return out;
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    return out;
  }
  for (const file of report.testResults ?? []) {
    const assertions = file.assertionResults ?? [];
    const failed = assertions.filter((a) => a.status === "failed").map((a) => a.title);
    if (file.status === "failed" && assertions.length === 0) {
      const abs = path.isAbsolute(file.name) ? file.name : path.join(root, workspace, file.name);
      out.fileLevel.push(path.relative(root, abs).split(path.sep).join("/"));
    }
    out.testLevel.push(...failed);
  }
  return out;
}

export function judgeRed({ testLevel, fileLevel }) {
  const redTitles = testLevel.filter((t) => RED_PREFIXES.has(/^(\w+):/.exec(t)?.[1]));
  if (redTitles.length > 0) return { red: true, reason: `failing: ${redTitles.join(", ")}` };
  if (testLevel.length === 0 && fileLevel.length > 0) {
    return { red: true, reason: `do not load (module not written yet): ${fileLevel.join(", ")}` };
  }
  if (testLevel.length > 0) {
    return {
      red: false,
      reason: `only cases without an error:/edge:/regression: prefix fail (${testLevel.join(", ")}); RED must start with errors and edges`,
    };
  }
  return { red: false, reason: "no test fails: the tests do not pin the new behaviour" };
}

// Shell text with quoted contents blanked (quote chars kept) and `#` comments
// dropped, so `-m "a > src/x.ts"` or `# > src/x.ts` never read as redirections.
function shellMask(command) {
  const mask = command.split("");
  const comment = new Array(command.length).fill(false);
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === "\\" && quote === '"') {
        mask[i] = " ";
        if (i + 1 < command.length) mask[++i] = " ";
      } else if (c === quote) quote = null;
      else mask[i] = " ";
    } else if (c === "'" || c === '"') {
      quote = c;
    } else if (c === "#" && (i === 0 || /\s/.test(command[i - 1]))) {
      for (; i < command.length && command[i] !== "\n"; i++) {
        mask[i] = " ";
        comment[i] = true;
      }
      i--;
    }
  }
  return { mask: mask.join(""), comment };
}

function segments(command) {
  const { mask, comment } = shellMask(command);
  const out = [];
  let from = 0;
  for (const m of mask.matchAll(/\|\||&&|;|\||\n/g)) {
    out.push([from, m.index]);
    from = m.index + m[0].length;
  }
  out.push([from, command.length]);
  return out.map(([a, b]) => {
    let clean = "";
    for (let i = a; i < b; i++) if (!comment[i]) clean += command[i];
    return { text: command.slice(a, b), mask: mask.slice(a, b), clean };
  });
}

function tokenize(segment) {
  const tokens = [];
  for (const m of segment.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)) tokens.push(m[1] ?? m[2] ?? m[3]);
  return tokens;
}

const isPathArg = (t) => !t.startsWith("-") && !/^\d*>/.test(t) && !t.startsWith("<") && !t.startsWith(">");
const REDIRECT_RE = /(?<![0-9&<>])>{1,2}(?!&)[ \t]*/g;
const TARGET_RE = /'([^']+)'|"([^"]+)"|([^\s'"<>&;|]+)/y;

// Best-effort: the file paths a shell command would write. Reads (grep, cat,
// sed -n) yield nothing. A heuristic, not a shell parser.
export function findBashWriteTargets(command) {
  const targets = [];
  if (!command) return targets;
  for (const seg of segments(command)) {
    if (!seg.mask.trim()) continue;
    let stripped = "";
    let last = 0;
    for (const m of seg.mask.matchAll(REDIRECT_RE)) {
      TARGET_RE.lastIndex = m.index + m[0].length;
      const t = TARGET_RE.exec(seg.text);
      if (!t || seg.mask[m.index + m[0].length] === undefined) continue;
      targets.push(t[1] ?? t[2] ?? t[3]);
      stripped += seg.text.slice(last, m.index);
      last = TARGET_RE.lastIndex;
    }
    stripped += seg.text.slice(last);
    const withoutComment = segments(stripped)[0]?.clean ?? stripped;
    const tokens = tokenize(withoutComment.replace(/<<-?\s*['"]?\w+['"]?/g, "").trim());
    const [cmd, ...rest] = tokens;
    if (cmd === "tee") {
      targets.push(...rest.filter(isPathArg));
    } else if ((cmd === "sed" || cmd === "perl") && rest.some((t) => /^-[a-z]*i/.test(t))) {
      let skipNext = false;
      const args = [];
      for (const t of rest) {
        if (skipNext) {
          skipNext = false;
          continue;
        }
        if (t === "-e") {
          skipNext = true;
          continue;
        }
        if (t.startsWith("-") || t === "") continue;
        args.push(t);
      }
      // sed: first non-flag arg is the script unless -e was used.
      const files = cmd === "sed" && !rest.includes("-e") ? args.slice(1) : args;
      targets.push(...files.filter((t) => /[./]/.test(t)));
    } else if (["cp", "mv", "install", "rsync"].includes(cmd)) {
      const args = rest.filter(isPathArg);
      if (args.length >= 2) targets.push(args[args.length - 1]);
    }
  }
  return targets.filter((t) => t && !t.startsWith("/dev/"));
}

// `node --test` reads each positional argument as a glob: a literal `[` must be
// escaped as `[[]` or a bracketed folder silently matches nothing.
export function globSafe(file) {
  return file.replaceAll("[", "[[]");
}
