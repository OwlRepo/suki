#!/usr/bin/env bun
/**
 * Cursor AI Integration Setup Script
 * Detects project type, tech stack, and file structure.
 * Generates/updates all .cursor/ files per CURSOR_INTEGRATION.mdc specifications.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const CURSOR_DIR = join(ROOT, ".cursor");

interface DetectionResult {
  projectType: "frontend" | "backend" | "full-stack" | "monorepo";
  monorepo: boolean;
  workspaces: string[];
  frontend: {
    framework: string;
    buildTool: string;
    stateManagement: string[];
    routing: string;
    uiLibrary: string[];
    dataFetching: string[];
    language: string;
    srcPath: string;
    hasAppRouter?: boolean;
  } | null;
  backend: {
    runtime: string;
    framework: string;
    database: string[];
    orm: string[];
    apiStyle: string;
    srcPath: string;
  } | null;
  packages: Record<string, { path: string; type: string }>;
}

function detectProject(): DetectionResult {
  const rootPkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  const workspaces: string[] = rootPkg.workspaces ?? [];
  const hasApps = workspaces.some((w: string) => w.startsWith("apps/"));
  const hasPackages = workspaces.some((w: string) => w.startsWith("packages/"));
  const turboExists = existsSync(join(ROOT, "turbo.json"));

  let frontend: DetectionResult["frontend"] = null;
  let backend: DetectionResult["backend"] = null;
  const packages: Record<string, { path: string; type: string }> = {};

  // Detect apps
  if (existsSync(join(ROOT, "apps"))) {
    for (const name of readdirSync(join(ROOT, "apps"))) {
      const appPath = join(ROOT, "apps", name);
      if (!statSync(appPath).isDirectory()) continue;
      const pkgPath = join(appPath, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies } || {};
      if (deps.next || deps["react"]) {
        const hasAppDir = existsSync(join(appPath, "src", "app"));
        frontend = {
          framework: deps.next ? "Next.js" : "React",
          buildTool: deps.next ? "Next.js" : deps.vite ? "Vite" : "unknown",
          stateManagement: deps["@clerk/nextjs"] ? ["Clerk"] : [],
          routing: deps.next && hasAppDir ? "Next.js App Router" : "React Router",
          uiLibrary: deps.tailwindcss ? ["Tailwind CSS"] : [],
          dataFetching: [],
          language: pkg.devDependencies?.typescript ? "TypeScript" : "JavaScript",
          srcPath: `apps/${name}/src`,
          hasAppRouter: !!hasAppDir,
        };
      } else if (deps["@nestjs/core"] || deps.express) {
        backend = {
          runtime: "Node.js",
          framework: deps["@nestjs/core"] ? "NestJS" : "Express",
          database: deps["drizzle-orm"] ? ["PostgreSQL"] : [],
          orm: deps["drizzle-orm"] ? ["Drizzle ORM"] : [],
          apiStyle: "REST",
          srcPath: `apps/${name}/src`,
        };
      }
    }
  }

  // Detect packages
  if (existsSync(join(ROOT, "packages"))) {
    for (const name of readdirSync(join(ROOT, "packages"))) {
      const pkgPath = join(ROOT, "packages", name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies } || {};
      let type = "shared";
      if (deps["drizzle-orm"]) type = "database";
      else if (deps["react"] || pkg.peerDependencies?.react) type = "ui";
      else if (name === "types") type = "types";
      packages[name] = { path: `packages/${name}`, type };
    }
  }

  const projectType =
    frontend && backend ? "full-stack" : frontend ? "frontend" : backend ? "backend" : "monorepo";
  const monorepo = turboExists && (hasApps || hasPackages);

  return {
    projectType: monorepo ? "monorepo" : projectType,
    monorepo,
    workspaces,
    frontend,
    backend,
    packages,
  };
}

function walkDir(dir: string, base = ""): string[] {
  const fullPath = join(ROOT, dir);
  if (!existsSync(fullPath)) return [];
  const entries = readdirSync(fullPath, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".next" && e.name !== "dist") {
      files.push(...walkDir(join(dir, e.name), rel));
    } else if (e.isFile() && /\.(ts|tsx|js|jsx)$/.test(e.name)) {
      files.push(rel);
    }
  }
  return files;
}

function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function write(file: string, content: string) {
  ensureDir(join(CURSOR_DIR, join(file, "..")));
  writeFileSync(join(CURSOR_DIR, file), content.trim() + "\n", "utf-8");
}

function generateAll(det: DetectionResult) {
  const gen = new CursorFileGenerator(det);
  gen.generateArchitecture();
  gen.generateFileIndex();
  gen.generateDebugging();
  gen.generateRules();
  gen.generateCommands();
  gen.generateCore();
  gen.generateMaintenance();
}

class CursorFileGenerator {
  constructor(private det: DetectionResult) {}

  generateArchitecture() {
    ensureDir(join(CURSOR_DIR, "architecture"));

    write(
      "architecture/overview.mdc",
      `# System Architecture Overview

## Project Type

**Suki** is a full-stack monorepo built with Turborepo.

- **Frontend**: Next.js 16 (App Router), React 19
- **Backend**: NestJS 10, Express
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Clerk

## Application Flow

\`\`\`mermaid
flowchart LR
    subgraph frontend [Frontend - apps/web]
        Next[Next.js 16]
        React[React 19]
        Clerk[Clerk Auth]
        UI[suki/ui]
        Next --> React
        Next --> Clerk
        Next --> UI
    end

    subgraph backend [Backend - apps/api]
        Nest[NestJS]
        Controllers[Controllers]
        Nest --> Controllers
    end

    subgraph data [Data Layer]
        DB[(PostgreSQL)]
        Drizzle[Drizzle ORM]
        DB --> Drizzle
    end

    subgraph packages [Shared Packages]
        Types[suki/types]
        Database[suki/database]
        UI
    end

    frontend -->|REST API| backend
    backend --> Database
    Database --> DB
    frontend --> Types
\`\`\`

## Module Relationships

\`\`\`mermaid
flowchart TB
    subgraph apps [Apps]
        Web[apps/web]
        Api[apps/api]
    end

    subgraph packages [Packages]
        UI[packages/ui]
        DB[packages/database]
        Types[packages/types]
        Config[packages/config]
    end

    Web --> UI
    Web --> DB
    Web --> Types
    Api --> DB
    Api --> Types
    UI --> Types
    DB --> Types
\`\`\`

## Directory Structure

\`\`\`
suki/
├── apps/
│   ├── web/          # Next.js frontend
│   │   └── src/
│   │       └── app/   # App Router
│   └── api/          # NestJS backend
│       └── src/
├── packages/
│   ├── ui/           # Shared React components
│   ├── database/     # Drizzle schema, migrations
│   ├── types/        # Shared TypeScript types
│   └── config/       # Shared TS config
├── turbo.json
└── package.json
\`\`\`

## Key Architectural Decisions

1. **Monorepo**: Turborepo for build orchestration and shared packages
2. **Workspace packages**: @suki/ui, @suki/database, @suki/types used by both apps
3. **Database sharing**: Single @suki/database package with Drizzle schema
4. **Auth**: Clerk for frontend auth; backend validates tokens
5. **Type safety**: Shared @suki/types across frontend and backend
`
    );

    write(
      "architecture/tech-stack.mdc",
      `# Technology Stack

## Summary

| Layer | Technology |
|-------|------------|
| Package Manager | Bun |
| Language | TypeScript 5 |
| Frontend | Next.js 16, React 19 |
| Styling | Tailwind CSS 4 |
| Auth | Clerk |
| Backend | NestJS 10, Express |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Build | Turborepo |

## Frontend

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19
- **Styling**: Tailwind CSS 4, PostCSS
- **Auth**: @clerk/nextjs
- **Components**: @suki/ui
- **Data**: Server Components, native fetch (no TanStack Query yet)

## Backend

- **Runtime**: Node.js 18+
- **Framework**: NestJS 10
- **Platform**: Express
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Config**: @nestjs/config, dotenv

## Shared Packages

- **@suki/ui**: React components (Button, Card, Input, Modal, EmptyState, ConfirmDialog)
- **@suki/database**: Drizzle schema, migrations, getDb()
- **@suki/types**: Shared types (Plan, Organization, Business, User, Customer, etc.)
- **@suki/config**: Shared tsconfig

## Environment Variables

See \`.env.example\` for required variables (DATABASE_URL, Clerk keys, etc.).
`
    );

    if (this.det.frontend) {
      write(
        "architecture/routing.mdc",
        `# Routing

## Next.js App Router

The frontend uses Next.js 16 App Router (file-based routing).

## Structure

- \`apps/web/src/app/layout.tsx\` - Root layout
- \`apps/web/src/app/page.tsx\` - Home page (/\`)
- \`apps/web/src/app/providers.tsx\` - Client providers (Clerk)

## Conventions

- Routes are defined by \`page.tsx\` in \`app/\` directory
- \`layout.tsx\` wraps nested routes
- Client components use "use client" directive (e.g. providers.tsx)

## Auth Flow

ClerkProvider wraps the app in providers.tsx. Auth state is managed by Clerk.
`
      );

      write(
        "architecture/state-management.mdc",
        `# State Management

## Current State

- **Auth**: Clerk manages authentication state (ClerkProvider in providers.tsx)
- **No global state**: No Redux, Zustand, or Pinia yet

## Future Patterns

When adding global state:
- Prefer Zustand for simplicity
- Use React Context for feature-scoped state
- Keep server state in Server Components where possible
`
      );

      write(
        "architecture/data-fetching.mdc",
        `# Data Fetching

## Current Patterns

- **Server Components**: Default in Next.js App Router; fetch on server
- **Client Components**: Use native \`fetch\` or \`useEffect\` + fetch
- **No TanStack Query/SWR yet**: Add when needed for caching/mutations

## Conventions

- Fetch from NestJS API at \`/api/...\` (or configured API URL)
- Use Server Components for initial data when possible
- Client components: fetch in useEffect or event handlers
`
      );

      write(
        "architecture/component-patterns.mdc",
        `# Component Patterns

## Framework

- React 19
- TypeScript
- Tailwind CSS 4

## Shared Components (@suki/ui)

Use workspace package: \`@suki/ui\`

- **Button**: Primary UI button
- **Card**: Content container
- **Input**: Form input
- **Modal**: Dialog overlay
- **EmptyState**: Empty list placeholder
- **ConfirmDialog**: Confirmation dialog

## Import Pattern

\`\`\`tsx
import { Button, Card, Input } from "@suki/ui";
\`\`\`

## Conventions

- Use Tailwind for styling
- Keep components in @suki/ui for reuse; app-specific components in apps/web
- Client components need "use client" directive
`
      );
    }

    write(
      "architecture/api-integration.mdc",
      `# API Integration

## Frontend

- **Client**: Native fetch (or add Axios if preferred)
- **Base URL**: Configure via env (NEXT_PUBLIC_API_URL)
- **Auth**: Pass Clerk token in Authorization header when calling API

## Backend

- **NestJS REST controllers**: Use @Controller, @Get, @Post, etc.
- **Auth**: Validate Clerk JWT in guards (when implemented)
- **Database**: Inject or use getDb() from @suki/database

## Endpoints

- \`GET /health\` - Health check
- \`GET /health/db\` - Database connectivity check
`
    );

    write(
      "architecture/module-structure.mdc",
      `# Module Structure

## Workspaces

| Workspace | Purpose |
|-----------|---------|
| apps/web | Next.js frontend |
| apps/api | NestJS backend |
| packages/ui | Shared React components |
| packages/database | Drizzle schema, migrations |
| packages/types | Shared TypeScript types |
| packages/config | Shared tsconfig |

## Module Organization

- **Frontend**: app/ (layout, page, providers)
- **Backend**: NestJS modules (health, etc.)
- **Shared**: packages/* for cross-app code
`
    );

    if (this.det.backend) {
      write(
        "architecture/database.mdc",
        `# Database

## Stack

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Location**: packages/database

## Schema

Tables: organizations, businesses, users, customers, promos, appointments, subscriptions, ai_credits

## Migrations

\`\`\`bash
bun run db:generate   # Generate migrations
bun run db:migrate    # Apply migrations
bun run db:studio    # Drizzle Studio
\`\`\`

## Usage

\`\`\`ts
import { getDb } from "@suki/database";
const db = getDb();
\`\`\`
`
      );

      write(
        "architecture/service-patterns.mdc",
        `# Service Patterns

## NestJS Structure

- **Modules**: Group related controllers and services
- **Controllers**: Handle HTTP, delegate to services
- **Services**: Business logic

## Example

HealthController uses getDb() directly. For complex logic, create dedicated services.
`
      );
    }
  }

  generateFileIndex() {
    ensureDir(join(CURSOR_DIR, "file-index"));

    const webSrc = walkDir("apps/web/src");
    const apiSrc = walkDir("apps/api/src");
    const pkgUi = walkDir("packages/ui/src");
    const pkgDb = walkDir("packages/database/src");
    const pkgTypes = walkDir("packages/types/src");

    write(
      "file-index/src-index.mdc",
      `# Source Index

Last updated: ${new Date().toISOString()}

## apps/web/src

\`\`\`
app/
├── layout.tsx      # Root layout
├── page.tsx        # Home page
├── providers.tsx   # Client providers (Clerk)
└── globals.css
\`\`\`

## apps/api/src

\`\`\`
├── main.ts
├── app.module.ts
└── health/
    ├── health.module.ts
    └── health.controller.ts
\`\`\`

## packages/ui/src

\`\`\`
├── index.ts
├── Button.tsx
├── Card.tsx
├── Input.tsx
├── Modal.tsx
├── EmptyState.tsx
└── ConfirmDialog.tsx
\`\`\`

## packages/database/src

\`\`\`
├── index.ts
├── database.ts
└── schema/
    └── index.ts
\`\`\`

## packages/types/src

\`\`\`
└── index.ts
\`\`\`
`
    );

    if (this.det.frontend) {
      write(
        "file-index/components-index.mdc",
        `# Components Index

Last updated: ${new Date().toISOString()}

## @suki/ui (packages/ui/src)

| Component | Purpose |
|-----------|---------|
| Button | Primary button |
| Card | Content container |
| Input | Form input |
| Modal | Dialog overlay |
| EmptyState | Empty list placeholder |
| ConfirmDialog | Confirmation dialog |

## apps/web

| File | Purpose |
|------|---------|
| layout.tsx | Root layout, fonts, metadata |
| page.tsx | Home page |
| providers.tsx | ClerkProvider (client) |
`
      );

      write(
        "file-index/hooks-index.mdc",
        `# Hooks Index

Last updated: ${new Date().toISOString()}

No custom hooks yet. Add data-fetching or UI hooks as needed.
`
      );

      write(
        "file-index/routes-index.mdc",
        `# Routes Index

Last updated: ${new Date().toISOString()}

## Next.js App Router

| Path | File | Purpose |
|------|------|---------|
| / | app/page.tsx | Home |
| (layout) | app/layout.tsx | Root layout |
`
      );

      write(
        "file-index/stores-index.mdc",
        `# Stores Index

Last updated: ${new Date().toISOString()}

No state stores yet. Clerk handles auth. Add Zustand/Redux when needed.
`
      );
    }

    write(
      "file-index/utils-index.mdc",
      `# Utils Index

Last updated: ${new Date().toISOString()}

## packages/types

Shared types: PlanType, Plan, Organization, Business, User, Customer, Promo, Appointment, Subscription, AiCredits, DTOs, ApiError.

## packages/database

Scripts: setup.ts, migrate.ts, seed.ts, reset.ts
`
    );

    if (this.det.backend) {
      write(
        "file-index/controllers-index.mdc",
        `# Controllers Index

Last updated: ${new Date().toISOString()}

| Controller | Path | Purpose |
|------------|------|---------|
| HealthController | /health | Health check |
| HealthController | /health/db | DB connectivity |
`
      );

      write(
        "file-index/services-index.mdc",
        `# Services Index

Last updated: ${new Date().toISOString()}

No dedicated services yet. Controllers use getDb() directly.
`
      );

      write(
        "file-index/models-index.mdc",
        `# Models Index

Last updated: ${new Date().toISOString()}

## Drizzle Schema (packages/database/src/schema)

| Table | Purpose |
|-------|---------|
| organizations | Tenant for multi-business |
| businesses | Business profile |
| users | Clerk user, role, org |
| customers | Customer records |
| promos | Promo campaigns |
| appointments | Appointments |
| subscriptions | Subscription plans |
| ai_credits | AI credits per org |
`
      );
    }
  }

  generateDebugging() {
    ensureDir(join(CURSOR_DIR, "debugging"));
    write(
      "debugging/workflow.mdc",
      `# Debugging Workflow

1. **Reproduce** - Confirm the bug with minimal steps
2. **Identify** - Isolate the failing component or code path
3. **RCA** - Root cause analysis (see root-cause-analysis.mdc)
4. **Fix** - Implement fix following patterns
5. **Test** - Verify fix and add regression test if applicable
`
    );
    write(
      "debugging/root-cause-analysis.mdc",
      `# Root Cause Analysis Template

## Problem

[Brief description]

## Affected Areas

[Files, features, users]

## Root Cause

[What actually caused the issue]

## Impact

[Severity, scope]

## Solution

[Fix and prevention]
`
    );
    write(
      "debugging/common-issues.mdc",
      `# Common Issues

Add known issues and solutions here as they are discovered.
`
    );
    write(
      "debugging/fix-plan-template.mdc",
      `# Fix Plan Template

## Problem

## Root Cause

## Solution Steps

1.
2.

## Files to Update

## Expected Outcome

## Testing
`
    );
  }

  generateRules() {
    ensureDir(join(CURSOR_DIR, "rules"));
    write(
      "rules/entry-point.mdc",
      `---
alwaysApply: true
---

# Cursor Entry Point

**Primary entry point** for Cursor AI. **Hard Rule B**: This file MUST be loaded as the first prompt context for any workflow.

## Fully Automatic

- Detects intent (bug/feature/enhancement/refactor/review)
- Finds files via file-index
- Applies rules from rules/
- Includes architecture docs
- Creates implementation plans
- Enforces planning gate before edits

## Usage

Just describe what you need. No need to reference command files or rules.
`
    );
    const rules = [
      ["bug-fix.mdc", "Reproduce first, use RCA, test thoroughly, follow patterns."],
      ["feature-implementation.mdc", "Follow architecture, use patterns, create types, error handling, tests."],
      ["enhancement.mdc", "Understand current behavior, identify improvements, maintain compatibility."],
      ["refactoring.mdc", "Maintain functionality, follow style, update related files, test."],
      ["code-review.mdc", "Check patterns, error handling, performance, accessibility."],
      ["testing.mdc", "Happy paths, error cases, edge cases, integration."],
      [
        "automation-guidelines.mdc",
        "When to auto vs ask, when to pause, quality gates, hallucination prevention.",
      ],
    ];
    for (const [name, desc] of rules) {
      write(
        `rules/${name}`,
        `# ${name.replace(".mdc", "").replace(".md", "").replace(/-/g, " ")}

${desc}

See CURSOR_INTEGRATION.mdc for full specifications.
`
      );
    }
  }

  generateCommands() {
    ensureDir(join(CURSOR_DIR, "commands"));
    write(
      "commands/bug-report.mdc",
      `# Bug Report Template

## Description

## Steps to Reproduce

## Expected vs Actual

## Environment
`
    );
    write(
      "commands/new-feature.mdc",
      `# New Feature Template

## Description

## Requirements

## Acceptance Criteria
`
    );
    write("commands/enhancement.mdc", `# Enhancement Template

## Current Behavior

## Desired Improvement

## Benefits
`);
    write("commands/refactor.mdc", `# Refactor Template

## Code/Area

## Reason

## Scope
`);
    write("commands/code-review.mdc", `# Code Review Template

## Files

## Focus Areas
`);
  }

  generateCore() {
    write(
      "README.mdc",
      `# Cursor Integration

AI-assisted development system for Suki monorepo.

## Overview

- **rules/entry-point.mdc**: Primary entry; automatic intent detection and routing (alwaysApply: true)
- **architecture/**: System docs (overview, tech-stack, routing, database, etc.)
- **file-index/**: File indexes (components, routes, controllers, models, etc.)
- **rules/**: Bug-fix, feature, enhancement, refactor, testing, code-review
- **debugging/**: Workflow, RCA, common-issues, fix-plan
- **commands/**: Optional templates
- **maintenance/**: Update workflow and checklist

## Usage

Always use **@.cursor/rules/entry-point.mdc** as the first prompt (Hard Rule B). See CURSOR_USAGE_GUIDE.mdc for step-by-step workflows.
`
    );
    write(
      "CURSOR_USAGE_GUIDE.mdc",
      `# Cursor Usage Guide - Suki

## Getting Started (Hard Rule B)

For any prompt, **@.cursor/rules/entry-point.mdc** MUST be used as the first context. Load it before planning, implementing, or applying rules. The entry point detects intent, finds files, and applies appropriate rules automatically.

## Project Context

- **Type**: Full-stack monorepo (Next.js + NestJS)
- **Apps**: apps/web (frontend), apps/api (backend)
- **Packages**: @suki/ui, @suki/database, @suki/types

## Quick Examples

### Add a customer form

"I need a customer form on the home page using @suki/ui Input and Card, with name and mobile fields."

### Add an API endpoint

"Add a GET /customers endpoint in the API that returns customers from the database."

### Fix a bug

"The health check returns 500. Debug and fix."

## Workflows

All workflows begin via the entry point. Load **@.cursor/rules/entry-point.mdc** first, then describe what you need:

1. **Bug**: Describe the bug; system applies bug-fix rules and RCA
2. **Feature**: Describe the feature; system follows architecture and patterns
3. **Enhancement**: Describe current + desired; system maintains compatibility
4. **Refactor**: Describe scope; system preserves behavior
5. **Review**: Mention files; system runs code-review checklist

## Onboarding

1. For every prompt, load **@.cursor/rules/entry-point.mdc** first (Hard Rule B)
2. Read architecture/overview.mdc
3. Read architecture/tech-stack.mdc
4. Skim file-index for relevant areas
`
    );
    writeFileSync(
      join(ROOT, "AGENTS.md"),
      "For any task, load @.cursor/rules/entry-point.mdc first and follow its workflow.\n",
      "utf-8"
    );
  }

  generateMaintenance() {
    ensureDir(join(CURSOR_DIR, "maintenance"));
    write(
      "maintenance/update-workflow.mdc",
      `# Update Workflow

1. Detect change (new file, modified, deleted, pattern change)
2. Identify affected .cursor/ files
3. Update documentation
4. Run: bun run scripts/update-cursor-indexes.ts
`
    );
    write(
      "maintenance/update-checklist.mdc",
      `# Maintenance Checklist

- [ ] New component -> components-index.mdc, src-index.mdc
- [ ] New route -> routes-index.mdc
- [ ] New controller -> controllers-index.mdc
- [ ] New service -> services-index.mdc
- [ ] New model -> models-index.mdc
- [ ] Architecture change -> architecture/
`
    );
    write(
      "maintenance/auto-update-guide.mdc",
      `# Auto-Update Guide

Pre-commit hook runs update-cursor-indexes.ts on staged changes.

Manual: bun run scripts/update-cursor-indexes.ts
Dry run: bun run scripts/update-cursor-indexes.ts --dry-run
`
    );
  }
}

// Main
const det = detectProject();
console.log("Detected:", JSON.stringify(det, null, 2));
ensureDir(CURSOR_DIR);
generateAll(det);
console.log("Generated all .cursor/ files.");