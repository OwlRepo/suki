# Cursor AI Integration - Master Prompt

**Purpose**: Complete regeneration prompt for the Cursor AI context system. Use this file as a standalone prompt to recreate all `.cursor/` files.

## Quick Setup

### Automated Setup

Run the setup script to auto-generate all `.cursor/` files based on project detection:

```bash
bun run scripts/setup-cursor-integration.ts
```

This script will:

1. Detect project type (monorepo, frontend, backend, fullstack)
2. Detect tech stack from `package.json` files
3. Detect file structure from directories
4. Update `CURSOR_INTEGRATION.mdc` with detection results
5. Generate/update all `.cursor/` files accordingly
6. Generate `CURSOR_USAGE_GUIDE.mdc` with project-tailored examples and workflows

### Manual Regeneration

If you need to regenerate all files manually, follow the detection steps below and use this command:

**Command**: Analyze the entire codebase and regenerate all `.cursor/` files according to the specifications below.

## Auto-Update System

File indexes are automatically updated on every commit via git hooks:

### Pre-Commit Hook

- **Location**: `.husky/pre-commit`
- **Script**: `scripts/update-cursor-indexes.ts`
- **Behavior**:
  - Detects staged file changes using `git diff --cached`
  - Updates only affected index files (not full regeneration)
  - Stages updated index files automatically
  - Commit proceeds normally

### Indexer Script

- **Location**: `scripts/update-cursor-indexes.ts`
- **Usage**: `bun run scripts/update-cursor-indexes.ts [--dry-run]`
- **Features**:
  - Maps file paths to index files (components → components-index.mdc, etc.)
  - Handles file operations: Added, Modified, Deleted, Renamed
  - Supports monorepo structure (checks `apps/`, `packages/`)
  - Updates timestamps in index files

### Manual Index Update

To update indexes manually without committing:

```bash
# Dry run (see what would be updated)
bun run scripts/update-cursor-indexes.ts --dry-run

# Update indexes based on staged changes
bun run scripts/update-cursor-indexes.ts
```

### Disabling Auto-Update

To skip the pre-commit hook for a single commit:

```bash
git commit --no-verify -m "Your message"
```

**Note**: This is not recommended as it can cause index drift.

## Project Detection & Adaptation

**CRITICAL FIRST STEP**: Before generating any files, analyze the codebase to detect and adapt to the project:

### 1. Detect Project Type

Analyze the codebase to determine project type:

- **Frontend**: React, Vue, Angular, Svelte, etc.
- **Backend**: Node.js/Express, Python/Django/Flask, Go, Java/Spring, Ruby/Rails, etc.
- **Full-Stack**: Contains both frontend and backend
- **Mobile**: React Native, Flutter, Swift, Kotlin, etc.
- **Desktop**: Electron, Tauri, etc.
- **CLI/Tool**: Command-line applications

**Detection Methods**:

- Check `package.json`, `requirements.txt`, `go.mod`, `pom.xml`, `Cargo.toml`, etc.
- Analyze directory structure (`src/`, `app/`, `components/`, `routes/`, `controllers/`, etc.)
- Check for framework-specific files (e.g., `vite.config.js`, `next.config.js`, `django/settings.py`)

### 2. Detect Tech Stack

Read dependency files and analyze code to identify:

**Frontend Detection**:

- Framework: React, Vue, Angular, Svelte, etc.
- Build Tool: Vite, Webpack, Next.js, etc.
- State Management: Redux, Zustand, Pinia, Context API, etc.
- Routing: React Router, TanStack Router, Vue Router, etc.
- UI Library: Tailwind, Material-UI, shadcn/ui, Chakra UI, etc.
- Data Fetching: TanStack Query, SWR, Apollo, etc.
- Language: TypeScript, JavaScript, etc.

**Backend Detection**:

- Runtime: Node.js, Python, Go, Java, Ruby, etc.
- Framework: Express, FastAPI, Django, Flask, Gin, Spring Boot, Rails, etc.
- Database: PostgreSQL, MySQL, MongoDB, Redis, etc.
- ORM/ODM: Prisma, Sequelize, Mongoose, SQLAlchemy, etc.
- API Style: REST, GraphQL, gRPC, etc.
- Authentication: JWT, OAuth, etc.

**Detection Methods**:

- Read `package.json`, `requirements.txt`, `go.mod`, `pom.xml`, `Cargo.toml`
- Check `tsconfig.json`, `jsconfig.json` for TypeScript/JavaScript
- Analyze import statements in code files
- Check configuration files

### 3. Detect Monorepo Structure

**CRITICAL**: Check for monorepo setup before analyzing project structure:

- **Turborepo**: Check for `turbo.json` in root
- **Workspaces**: Check root `package.json` for `workspaces` field
- **Workspace Structure**: Look for `apps/` and `packages/` directories
- **Workspace Types**: Identify frontend apps, backend apps, and shared packages

**Detection Methods**:

- Check root `package.json` for `workspaces` array
- Check for `turbo.json` configuration file
- List `apps/` directory for applications
- List `packages/` directory for shared packages
- Read workspace `package.json` files to identify workspace types

**Monorepo Adaptation**:

- If Turborepo detected, adapt all paths to use workspace structure
- Update file indexes to reflect workspace locations
- Generate workspace-specific rules (frontend vs backend)
- Update import patterns to use workspace package names (e.g., `@alacrity/shared`)
- Adapt file discovery to check multiple workspace locations

### 4. Detect Project Structure

Analyze directory structure to identify:

- **Modules/Features**: List all modules/features from directory structure
- **File Organization**: Component-based, feature-based, MVC, etc.
- **Patterns**: File-based routing, config-based routing, etc.
- **Conventions**: Naming conventions, file organization patterns

**Detection Methods**:

- List directories in `src/`, `app/`, `lib/`, etc. (or workspace-specific paths)
- Identify patterns (e.g., `components/`, `hooks/`, `routes/`, `controllers/`, `services/`)
- Check for existing architecture patterns
- **For Monorepos**: Check each workspace separately (`apps/frontend/src/`, `apps/backend/src/`, etc.)

### 5. Adapt File Specifications

**After detection, adapt the file specifications below**:

- **Frontend Projects**: Focus on components, hooks, routes, state management, UI patterns
- **Backend Projects**: Focus on controllers, services, models, API patterns, database patterns
- **Full-Stack Projects**: Include both frontend and backend patterns
- **Mobile Projects**: Focus on screens, navigation, state management, platform-specific patterns
- **Monorepo Projects**: Generate workspace-aware documentation and rules

**Adaptation Rules**:

- Replace hardcoded tech stack references with detected stack
- Replace hardcoded module names with detected modules
- Adapt file indexes based on actual project structure
- Generate only relevant architecture docs (e.g., skip routing.mdc for backend-only projects)
- Adapt patterns to match detected frameworks and libraries
- **For Monorepos**:
  - Use workspace paths (`apps/frontend/src/`, `apps/backend/src/`, `packages/shared/src/`)
  - Generate separate rules for frontend and backend workspaces
  - Update import examples to use workspace package names
  - Document Turborepo-specific patterns and commands

## Fully Automatic Development System

**IMPORTANT**: The system is designed for **fully automated development with a mandatory planning gate**. Users do NOT need to:

- Reference command files (`commands/*.mdc`)
- Mention specific rules (`rules/*.mdc`)
- Reference documentation files
- Intervene unless AI hallucinates or many files need review

The `entry-point.mdc` automatically:

- Detects intent from keywords, file references, and context
- Finds relevant files using file-index
- Applies appropriate rules automatically
- Includes relevant documentation automatically
- Creates comprehensive implementation plans
- Enforces a required execution-plan artifact before implementation
- **Implements changes automatically** (when safe and plan-complete)
- **Verifies implementation** automatically
- **Updates documentation** automatically

**Users can simply describe what they need** - the system handles everything automatically, from planning to implementation to verification, while requiring a complete plan artifact before edits.

## Planning Contract (Canonical)

Before any implementation, create an execution plan that is specific enough for any LLM to follow without additional searching.

### Required plan contents

1. Exact file list to update
2. Exact code sections to update in each file
3. Reason for every planned edit
4. Targeted before/after code snippet pairs for every edit
5. Verification steps and commands
6. Post-execution index update step when required

### Fact-only planning rule

- Plans must be based on existing files and code only.
- Verify file existence and current implementation before finalizing plan steps.
- Avoid theory-first or hypothetical edits that are not grounded in repository state.

### Clarification and recommendation rule

- Ask clarifying questions until execution-critical gaps are closed.
- Ask one recommendation question only when multiple materially different valid implementations exist.

### Strict adherence rule

- Execute strictly against the approved plan.
- If real code differs from the plan, pause at a checkpoint, report mismatch, and request approval for a revised step.

## Model Split: Codex + Composer

Use this split to keep planning and execution efficient:

1. **Planning model (GPT Codex)**:
   - Produces the execution-plan artifact with required contents above.
   - Confirms facts from files before finalizing.
2. **Execution model (Cursor Composer)**:
   - Validates plan anchors before edits (files exist, snippets still match, no unanswered gaps).
   - Executes exact approved steps.
   - Raises checkpoint on drift or contradictions.

### Required handoff add-ons

- **Plan artifact contract**: exact files, exact edits, reasons, before/after snippets, verification, index step
- **Execution handoff checklist**: file existence, snippet anchor validity, zero unresolved gaps
- **Deviation protocol**: stop, report mismatch, request revised-step approval
- **Plan version stamp**: `plan_version`, `planned_files_count`, `planned_steps_count`

### Automation Levels

1. **Full Auto (Proceed Automatically)**:
   - Single file changes (< 3 files)
   - Clear requirements
   - Well-defined patterns exist
   - Low risk changes
   - **Action**: Create required plan artifact, implement approved steps, verify, update docs/indexes

2. **Auto with Verification (Proceed + Verify)**:
   - Multiple files (3-10 files)
   - Moderate complexity
   - Some ambiguity but resolvable
   - **Action**: Create required plan artifact, implement approved steps, run verification checks, show summary

3. **Auto with Checkpoint (Proceed + Pause for Review)**:
   - Many files (10+ files)
   - High complexity
   - Breaking changes
   - Architecture changes
   - **Action**: Create required plan artifact, implement approved steps, pause before final commit, show review summary

4. **Ask First (Clarify Before Proceeding)**:
   - Ambiguous requirements
   - Conflicting patterns
   - Missing critical information
   - High-risk changes
   - **Action**: Ask clarifying questions before plan approval and implementation

## File Specifications

**IMPORTANT**: Adapt these specifications based on detected project type and tech stack.

### Architecture Documentation (Adaptive - Generate Only Relevant Files)

1. **architecture/overview.mdc** (Always generate)
   - System architecture with mermaid diagrams (application flow, module relationships, data flow)
   - Key architectural decisions
   - Directory structure
   - Development patterns
   - **Adapt**: Include detected project type, tech stack, and modules

2. **architecture/tech-stack.mdc** (Always generate)
   - **Adapt**: Complete technology stack based on detected dependencies
   - **Frontend**: Framework, build tool, state management, routing, UI library, data fetching, language
   - **Backend**: Runtime, framework, database, ORM/ODM, API style, authentication
   - **Full-Stack**: Include both frontend and backend
   - Version information from dependency files
   - Package management (npm, yarn, pnpm, pip, go mod, etc.)
   - Environment variables

3. **architecture/routing.mdc** (Generate for Frontend/Full-Stack only)
   - **Adapt**: Routing patterns based on detected framework
   - **React**: TanStack Router, React Router, Next.js routing
   - **Vue**: Vue Router patterns
   - **Angular**: Angular Router patterns
   - Route structure and conventions
   - Authentication flow
   - Route parameters and search params
   - **Skip**: For backend-only projects

4. **architecture/state-management.mdc** (Generate for Frontend/Full-Stack only)
   - **Adapt**: State management patterns based on detected library
   - **React**: Zustand, Redux, Context API, Jotai, etc.
   - **Vue**: Pinia, Vuex, etc.
   - **Angular**: NgRx, Services, etc.
   - Store/state creation patterns
   - State/actions structure
   - Persistence patterns
   - DevTools integration
   - **Skip**: For backend-only projects

5. **architecture/data-fetching.mdc** (Generate for Frontend/Full-Stack only)
   - **Adapt**: Data fetching patterns based on detected library
   - **React**: TanStack Query, SWR, Apollo, etc.
   - **Vue**: Vue Query, Apollo, etc.
   - Custom hook/function patterns
   - Socket.io/WebSocket integration (if detected)
   - Pagination patterns
   - Error handling
   - **Skip**: For backend-only projects

6. **architecture/api-integration.mdc** (Generate for Frontend/Full-Stack or Backend)
   - **Frontend**: HTTP client configuration (Axios, Fetch, etc.)
   - **Backend**: API patterns (REST, GraphQL, gRPC)
   - Request/response patterns
   - Error handling
   - Authentication headers/tokens
   - **Adapt**: Based on detected HTTP client or API framework

7. **architecture/component-patterns.mdc** (Generate for Frontend/Full-Stack only)
   - **Adapt**: Component architecture based on detected framework
   - **React**: Component patterns, hooks, JSX patterns
   - **Vue**: Component patterns, Composition API, templates
   - **Angular**: Component patterns, services, dependency injection
   - UI library usage (if detected: shadcn/ui, Material-UI, Chakra UI, etc.)
   - Form patterns (React Hook Form, Formik, Vue Form, etc.)
   - Table/list patterns
   - **Skip**: For backend-only projects

8. **architecture/module-structure.mdc** (Always generate)
   - **Adapt**: List all detected modules/features from directory structure
   - Module organization
   - Module-specific patterns
   - **Frontend**: Feature modules, page modules, etc.
   - **Backend**: Domain modules, service modules, etc.

9. **architecture/database.mdc** (Generate for Backend/Full-Stack only)
   - **Adapt**: Database patterns based on detected database and ORM/ODM
   - Database type (PostgreSQL, MySQL, MongoDB, Redis, etc.)
   - ORM/ODM patterns (Prisma, Sequelize, Mongoose, SQLAlchemy, etc.)
   - Migration patterns
   - Query patterns
   - **Skip**: For frontend-only projects

10. **architecture/service-patterns.mdc** (Generate for Backend/Full-Stack only)
    - **Adapt**: Service layer patterns based on detected framework
    - Service structure
    - Business logic patterns
    - Dependency injection (if applicable)
    - **Skip**: For frontend-only projects

### File Indexes (Adaptive - Generate Based on Project Structure)

1. **file-index/src-index.mdc** (Always generate)
   - **Adapt**: Complete directory tree based on actual project structure
   - **Frontend**: `src/` or `app/` directory tree
   - **Backend**: `src/`, `app/`, `lib/`, or framework-specific directories
   - File purposes and relationships
   - Directory structure with descriptions
   - File organization patterns

2. **file-index/components-index.mdc** (Generate for Frontend/Full-Stack only)
   - **Adapt**: Component categorization based on detected structure
   - **React**: Components categorized (UI, dialogs, forms, layouts, inputs, etc.)
   - **Vue**: Components categorized similarly
   - **Angular**: Components, services, directives
   - Component descriptions and purposes
   - Usage patterns
   - **Skip**: For backend-only projects

3. **file-index/hooks-index.mdc** (Generate for React Frontend/Full-Stack only)
   - **Adapt**: Hooks categorized based on detected patterns
   - Query hooks, mutation hooks, socket hooks, custom hooks
   - Hook purposes and usage patterns
   - Data fetching hooks
   - **Skip**: For non-React projects or backend-only projects

4. **file-index/routes-index.mdc** (Generate for Frontend/Full-Stack only)
   - **Adapt**: Routes based on detected routing system
   - **React**: Routes with paths, purposes, auth requirements, related components
   - **Vue**: Vue Router routes
   - **Angular**: Angular Router routes
   - Route structure
   - Module routes
   - **Skip**: For backend-only projects

5. **file-index/stores-index.mdc** (Generate for Frontend/Full-Stack only)
   - **Adapt**: State management stores based on detected library
   - **Zustand**: Stores with state structures, actions, usage patterns
   - **Redux**: Stores, slices, reducers
   - **Pinia**: Stores (Vue)
   - **NgRx**: Stores (Angular)
   - Store purposes
   - State management patterns
   - **Skip**: For backend-only projects or projects without state management

6. **file-index/utils-index.mdc** (Always generate)
   - **Adapt**: Utility functions based on detected patterns
   - **Frontend**: env, formatting, validation, data processing, helpers
   - **Backend**: helpers, validators, formatters, middleware, etc.
   - Utility purposes
   - Usage examples

7. **file-index/controllers-index.mdc** (Generate for Backend/Full-Stack only)
   - **Adapt**: Controllers/routes based on detected framework
   - **Express**: Route handlers
   - **Django**: Views
   - **Flask**: Routes
   - **Spring Boot**: Controllers
   - Controller purposes and endpoints
   - **Skip**: For frontend-only projects

8. **file-index/services-index.mdc** (Generate for Backend/Full-Stack only)
   - **Adapt**: Services based on detected patterns
   - Service purposes
   - Business logic patterns
   - **Skip**: For frontend-only projects

9. **file-index/models-index.mdc** (Generate for Backend/Full-Stack only)
   - **Adapt**: Models/schemas based on detected ORM/ODM
   - **Prisma**: Models
   - **Sequelize**: Models
   - **Mongoose**: Schemas
   - **SQLAlchemy**: Models
   - Model purposes and relationships
   - **Skip**: For frontend-only projects

### Debugging Files (4 files)

1. **debugging/workflow.mdc**
   - Step-by-step debugging process (reproduce → identify → RCA → fix → test)
   - Debugging methodology
   - Tools and techniques

2. **debugging/root-cause-analysis.mdc**
   - RCA template (problem, affected areas, root cause, impact, solution)
   - Analysis framework
   - Documentation format

3. **debugging/common-issues.mdc**
   - Known issues database with solutions and prevention strategies
   - Common bugs and fixes
   - Prevention tips

4. **debugging/fix-plan-template.mdc**
   - Standardized fix plan format (problem, root cause, solution steps, files, expected outcome, testing)
   - Plan structure
   - Implementation checklist

### Rules System (6 files)

1. **rules/bug-fix.mdc**
   - Bug fixing guidelines (reproduce first, use RCA, test thoroughly, follow patterns)
   - Bug fix workflow
   - Quality standards

2. **rules/feature-implementation.mdc**
   - Feature rules (follow architecture, use patterns, create types, error handling, tests)
   - Implementation standards
   - Code quality requirements

3. **rules/enhancement.mdc**
   - Enhancement guidelines (understand current, identify improvements, maintain compatibility, document)
   - Enhancement process
   - Backward compatibility

4. **rules/refactoring.mdc**
   - Refactoring rules (maintain functionality, follow style, update related files, test)
   - Refactoring standards
   - Safety guidelines

5. **rules/code-review.mdc**
   - Review guidelines (check patterns, error handling, performance, accessibility)
   - Review checklist
   - Quality criteria

6. **rules/testing.mdc**
   - Testing rules (happy paths, error cases, edge cases, integration)
   - Testing standards
   - Coverage requirements

7. **rules/automation-guidelines.mdc** - NEW
   - When to proceed automatically vs ask questions
   - When to pause for review
   - Quality gates and verification
   - Hallucination prevention
   - Implementation workflows

### Command Templates (5 files) - Optional

**Note**: Command files are optional templates for structured requests. The system works automatically without referencing them - users can simply describe what they need and the entry-point automatically detects intent and applies appropriate rules.

1. **commands/bug-report.mdc**
   - Bug reporting template (description, steps, expected/actual, environment) - Optional
   - Report format
   - Required information

2. **commands/new-feature.mdc**
   - Feature implementation template (description, requirements, acceptance criteria) - Optional
   - Feature specification format
   - Implementation checklist

3. **commands/enhancement.mdc**
   - Enhancement template (current behavior, desired improvement, benefits) - Optional
   - Enhancement request format
   - Evaluation criteria

4. **commands/refactor.mdc**
   - Refactoring template (code, reason, scope) - Optional
   - Refactoring request format
   - Scope definition

5. **commands/code-review.mdc**
   - Code review template (files, focus areas) - Optional
   - Review request format
   - Review checklist

### Core Files (4 files)

1. **entry-point.mdc** - PRIMARY ENTRY POINT (Always check first)
   - **Fully automatic** - No need to reference command files or rules
   - Automatically analyzes prompts to identify intent (bug/feature/enhancement/refactor/review)
   - Automatically finds relevant files mentioned in prompts using file-index
   - Automatically routes to appropriate rules based on detected intent
   - Automatically includes relevant documentation from architecture and file-index
   - Shows active rules in execution plan
   - Works without users needing to mention command files or rules

2. **README.mdc**
   - System overview
   - Usage instructions
   - File descriptions

3. **CURSOR_USAGE_GUIDE.mdc**
   - Full step-by-step usage handbook for daily Cursor workflows
   - Beginner-friendly instructions and safety checklists
   - Project-tailored prompt examples based on detected stack and file structure
   - Team onboarding, troubleshooting matrix, and ROI tracking templates

4. **maintenance/** (3 files)
   - **update-workflow.mdc**: When and how to update files
   - **update-checklist.mdc**: Maintenance checklist
   - **auto-update-guide.mdc**: AI auto-update instructions

### Guide Generation Rules (Dynamic Tailoring)

When generating `CURSOR_USAGE_GUIDE.mdc`, always tailor content to the detected project:

1. **Inject detected context**:
   - project type (frontend/backend/full-stack/monorepo)
   - framework and major tools from dependency detection
   - real source folders and common file locations
2. **Generate relatable examples**:
   - frontend examples from detected components/routes/hooks (if present)
   - backend examples from detected routers/services/models (if present)
   - monorepo examples with workspace paths (if present)
3. **Keep structure stable, adapt examples**:
   - preserve handbook section order for consistency
   - replace generic examples with project-specific prompts and paths

## Update Triggers & Maintenance

### Automatic Update Triggers

**New Files Added**:

- **Frontend**: Component → Update `file-index/components-index.mdc`, `file-index/src-index.mdc`
- **Frontend**: Hook → Update `file-index/hooks-index.mdc`, `file-index/src-index.mdc`
- **Frontend**: Route → Update `file-index/routes-index.mdc`, `file-index/src-index.mdc`
- **Frontend**: Store → Update `file-index/stores-index.mdc`, `file-index/src-index.mdc`
- **Backend**: Controller → Update `file-index/controllers-index.mdc`, `file-index/src-index.mdc`
- **Backend**: Service → Update `file-index/services-index.mdc`, `file-index/src-index.mdc`
- **Backend**: Model → Update `file-index/models-index.mdc`, `file-index/src-index.mdc`
- **All**: Utility → Update `file-index/utils-index.mdc`, `file-index/src-index.mdc`

**New Features**:

- New module → Update `architecture/module-structure.mdc`, relevant file-index files
- New pattern → Update relevant `architecture/` files
- **Frontend**: New component pattern → Update `architecture/component-patterns.mdc`
- **Frontend**: New route pattern → Update `architecture/routing.mdc`
- **Frontend**: New state pattern → Update `architecture/state-management.mdc`
- **Backend**: New service pattern → Update `architecture/service-patterns.mdc`
- **Backend**: New database pattern → Update `architecture/database.mdc`
- **All**: New API pattern → Update `architecture/api-integration.mdc`

**Breaking Changes**:

- Architecture change → Update `architecture/overview.mdc`
- Tech stack change → Update `architecture/tech-stack.mdc`
- Pattern change → Update relevant `architecture/` files
- Add to `debugging/common-issues.mdc` if migration needed

**Bug Fixes**:

- Common bug → Add to `debugging/common-issues.mdc`
- New bug pattern → Update `debugging/workflow.mdc` if needed

**Code Changes**:

- File renamed → Update relevant `file-index/` files
- File deleted → Remove from `file-index/` files
- File moved → Update `file-index/src-index.mdc`

### Maintenance Workflow

1. **Detect Change**: Identify type of change (new file, modified, deleted, pattern change)
2. **Identify Affected Files**: Determine which `.cursor/` files need updates
3. **Update Files**: Apply changes to relevant documentation
4. **Verify**: Check that updates are complete and accurate

See `maintenance/update-workflow.mdc` for detailed workflow.

## Directory Structure

```text
.cursor/
├── README.mdc                          # System overview
├── CURSOR_INTEGRATION.mdc             # This file (master prompt)
├── CURSOR_USAGE_GUIDE.mdc             # Project-tailored usage handbook
├── entry-point.mdc                    # Prompt routing system
├── architecture/                     # Adaptive architecture docs (8-10 files)
│   ├── overview.mdc                   # Always generated
│   ├── tech-stack.mdc                # Always generated
│   ├── routing.mdc                    # Frontend/Full-Stack only
│   ├── state-management.mdc          # Frontend/Full-Stack only
│   ├── data-fetching.mdc             # Frontend/Full-Stack only
│   ├── api-integration.mdc           # Always generated
│   ├── component-patterns.mdc        # Frontend/Full-Stack only
│   ├── module-structure.mdc          # Always generated
│   ├── database.mdc                  # Backend/Full-Stack only
│   └── service-patterns.mdc          # Backend/Full-Stack only
├── file-index/                       # Adaptive file indexes (6-9 files)
│   ├── src-index.mdc                 # Always generated
│   ├── components-index.mdc          # Frontend/Full-Stack only
│   ├── hooks-index.mdc               # React Frontend/Full-Stack only
│   ├── routes-index.mdc              # Frontend/Full-Stack only
│   ├── stores-index.mdc              # Frontend/Full-Stack only
│   ├── utils-index.mdc               # Always generated
│   ├── controllers-index.mdc         # Backend/Full-Stack only
│   ├── services-index.mdc            # Backend/Full-Stack only
│   └── models-index.mdc             # Backend/Full-Stack only
├── debugging/                        # 4 debugging files
│   ├── workflow.mdc
│   ├── root-cause-analysis.mdc
│   ├── common-issues.mdc
│   └── fix-plan-template.mdc
├── rules/                           # 7 rule files
│   ├── bug-fix.mdc
│   ├── feature-implementation.mdc
│   ├── enhancement.mdc
│   ├── refactoring.mdc
│   ├── code-review.mdc
│   ├── testing.mdc
│   └── automation-guidelines.mdc
├── commands/                        # 5 command templates
│   ├── bug-report.mdc
│   ├── new-feature.mdc
│   ├── enhancement.mdc
│   ├── refactor.mdc
│   └── code-review.mdc
└── maintenance/                     # 3 maintenance files
    ├── update-workflow.mdc
    ├── update-checklist.mdc
    └── auto-update-guide.mdc
```

## Key Principles

- **Fully Automatic**: No need to reference command files or rules - system detects everything automatically
- **Cross-Functional**: Rules work together automatically; entry point handles routing automatically
- **Auto-Context**: System automatically provides relevant context from architecture, indexes, common issues, patterns
- **Intelligent Detection**: Uses keywords, file references, and context clues to detect intent
- **Minimal Prompting**: Just describe what you need - system handles the rest automatically
- **Self-Updating**: System evolves with project; documentation reflects current state
- **Always Current**: Files updated automatically when code changes

## Implementation Requirements

- **Location**: All files in `.cursor/` directory
- **Git**: `.cursor/` excluded from git (local AI assistance only)
- **Naming**: Use kebab-case, descriptive names, logical grouping
- **Standards**: Clear, concise docs with code examples and mermaid diagrams where helpful
- **Maintenance**: Update files when code changes (see Update Triggers above)
- **Adaptation**: Files must adapt to detected project type, tech stack, and structure
- **Detection**: Always detect project type and tech stack before generating files

## Automatic Workflow Example

**User Prompt** (No command file, no rules mentioned):

```text
I need usePaginatedTableSocket to handle 100k records from socket 
data and store it in IndexedDB for the live-data-table component
```

**System Automatically**:

1. ✅ **Detects Intent**: Keywords "need", "handle", "store" → Feature/Enhancement intent
2. ✅ **Finds Files**:
   - `usePaginatedTableSocket` → Found in `file-index/hooks-index.mdc`
   - `live-data-table` → Found in `file-index/components-index.mdc`
   - `IndexedDB` → Found in `file-index/utils-index.mdc`
3. ✅ **Applies Rules**:
   - `rules/feature-implementation.mdc`
   - `rules/enhancement.mdc`
   - `rules/testing.mdc`
4. ✅ **Includes Documentation**:
   - `architecture/data-fetching.mdc`
   - `architecture/component-patterns.mdc`
   - `file-index/hooks-index.mdc`
   - `file-index/components-index.mdc`
   - `file-index/utils-index.mdc`
5. ✅ **Creates Plan**: Comprehensive implementation plan with all details

**Result**: User gets complete plan without mentioning any command files or rules!

## When to Ask Questions vs. Proceed Automatically

### Ask Questions When

1. **Ambiguous Requirements**:
   - User request is unclear or has multiple interpretations
   - Missing critical details (e.g., "add a button" - where? what does it do?)
   - Conflicting requirements mentioned
   - **Action**: Ask 1-2 specific questions to clarify

2. **Missing Critical Information**:
   - API endpoint not specified
   - Data structure unknown
   - User flow unclear
   - **Action**: Ask for missing information before proceeding

3. **High-Risk Changes**:
   - Breaking changes to core architecture
   - Changes affecting multiple modules
   - Security-related changes
   - **Action**: Confirm approach before implementing

4. **Pattern Conflicts**:
   - Request conflicts with existing patterns
   - Multiple valid approaches exist
   - **Action**: Ask which approach to use

### Proceed Automatically When

1. **Clear Requirements**:
   - User request is specific and clear
   - All necessary information is present
   - Pattern is well-established
   - **Action**: Implement immediately

2. **Low-Risk Changes**:
   - Single file modifications
   - Following established patterns
   - Non-breaking changes
   - **Action**: Implement, verify, update docs

3. **Well-Defined Patterns**:
   - Similar implementations exist
   - Architecture patterns are clear
   - File structure is standard
   - **Action**: Follow patterns automatically

4. **Standard Tasks**:
   - Bug fixes with clear root cause
   - Feature additions following patterns
   - Enhancements to existing features
   - **Action**: Implement automatically

## Quality Gates & Checkpoints

### Automatic Verification Steps

After implementing changes, automatically:

1. **Code Quality Checks**:
   - ✅ **TypeScript/JavaScript**: Compiles without errors
   - ✅ **Python**: No syntax errors, passes type checking (if mypy/pyright used)
   - ✅ **Go**: Compiles without errors
   - ✅ **Java**: Compiles without errors
   - ✅ No linting errors (ESLint, Pylint, golint, etc.)
   - ✅ Follows project patterns
   - ✅ Matches code style

2. **Functional Verification**:
   - ✅ Files are syntactically correct
   - ✅ Imports are valid
   - ✅ Types are properly defined
   - ✅ No obvious logic errors

3. **Pattern Compliance**:
   - ✅ Follows architecture patterns
   - ✅ Uses established components
   - ✅ Follows naming conventions
   - ✅ Matches existing code style

4. **Documentation Updates**:
   - ✅ Updated file-index if new files
   - ✅ Updated architecture docs if patterns change
   - ✅ Updated common-issues if bug fixed
   - ✅ Ran `bun run scripts/update-cursor-indexes.ts` after execution when source files changed
   - ✅ Kept pre-commit hook as safety net for index consistency

### Checkpoint: When to Pause for Review

**Pause and show summary when**:

1. **Many Files Modified** (10+ files):
   - Show list of all modified files
   - Show summary of changes
   - Highlight potential impacts
   - **Action**: Wait for user confirmation before finalizing

2. **Breaking Changes**:
   - Show what breaks
   - Show migration path
   - Show affected areas
   - **Action**: Confirm before proceeding

3. **Architecture Changes**:
   - Show architecture impact
   - Show affected modules
   - Show migration requirements
   - **Action**: Review with user

4. **High Complexity**:
   - Show implementation complexity
   - Show potential risks
   - Show alternative approaches
   - **Action**: Confirm approach

### Hallucination Prevention

**Detect and prevent hallucinations**:

1. **File Existence Check**:
   - ✅ Verify files exist before referencing
   - ✅ Check file-index for actual file paths
   - ✅ Don't create files that already exist with different names

2. **Pattern Verification**:
   - ✅ Verify patterns exist in architecture docs
   - ✅ Check file-index for actual implementations
   - ✅ Don't invent patterns that don't exist

3. **API Verification**:
   - ✅ Check existing hooks for API patterns
   - ✅ Verify API endpoints from existing code
   - ✅ Don't invent API endpoints

4. **Type Safety**:
   - ✅ Use existing types when possible
   - ✅ Verify type definitions exist
   - ✅ Don't create conflicting types

5. **Cross-Reference Check**:
   - ✅ Verify imports are correct
   - ✅ Check file relationships in file-index
   - ✅ Ensure consistency across files

**When hallucination detected**:

- Stop implementation
- Show what was detected
- Ask for clarification
- Verify with user before proceeding

## Implementation Workflow

### Standard Workflow (Automatic)

1. **Analyze Request**: Detect intent, find files, apply rules
2. **Create Plan (Required Gate)**: Comprehensive, file-specific, step-by-step plan with targeted before/after snippets and reasons
3. **Close Gaps**: Ask clarifying questions until execution-critical gaps are closed
4. **Implement**: Make changes strictly according to approved plan
5. **Verify**: Run quality checks automatically
6. **Update Docs and Indexes**: Update `.cursor/` files and run hybrid index update flow when source files changed
7. **Show Summary**: Display what was done

### Workflow with Checkpoint

1. **Analyze Request**: Detect intent, find files, apply rules
2. **Create Plan (Required Gate)**: Comprehensive implementation plan with exact files/edits/reasons/snippets
3. **Implement**: Make changes strictly according to approved plan
4. **Pause**: Show summary when drift, complexity, or risk requires review
5. **Wait**: User reviews and confirms
6. **Verify**: Run quality checks
7. **Update Docs and Indexes**: Update `.cursor/` files and run hybrid index update flow when source files changed
8. **Finalize**: Complete implementation

### Workflow with Questions

1. **Analyze Request**: Detect intent, find files
2. **Identify Gaps**: Find missing information
3. **Ask Questions**: 1-2 specific clarifying questions
4. **Wait**: User provides answers
5. **Recommendation Question (Conditional)**: Ask only if materially different valid implementations remain
6. **Proceed**: Continue with standard workflow

## Success Criteria

System is successful when:

- ✅ AI understands project context without extensive prompting
- ✅ Files located quickly via indexes (automatic discovery)
- ✅ Bugs debugged systematically with RCA (automatic detection)
- ✅ Prompts auto-routed to correct rules (fully automatic)
- ✅ Common tasks require minimal input (just describe what you need)
- ✅ Code follows consistent patterns (rules applied automatically)
- ✅ Documentation stays current with codebase (auto-updated)
- ✅ All files exist and are complete (number varies by project type)
- ✅ **Files adapt to project type** (frontend/backend/full-stack)
- ✅ **Tech stack detected automatically** from dependencies
- ✅ **Modules detected automatically** from directory structure
- ✅ System works without referencing command files or rules (fully automatic)
- ✅ **Implementation happens automatically** (when safe)
- ✅ **Quality gates prevent errors** automatically
- ✅ **Developer only intervenes** when hallucination detected or many files changed
- ✅ **Questions asked only when necessary** for accuracy

## Cross-Project Usage

**This file is designed to work across different project types!**

### How to Use in a New Project

1. **Copy this file** to `.cursor/CURSOR_INTEGRATION.mdc` in your new project
2. **Run the command**: "Analyze the codebase and regenerate all `.cursor/` files according to `@.cursor/CURSOR_INTEGRATION.mdc`"
3. **The system will automatically**:
   - Detect project type (frontend/backend/full-stack)
   - Detect tech stack from dependencies
   - Detect modules from directory structure
   - Generate appropriate files based on detection
   - Adapt all specifications to match your project

### Supported Project Types

- ✅ **Frontend**: React, Vue, Angular, Svelte, etc.
- ✅ **Backend**: Node.js, Python, Go, Java, Ruby, etc.
- ✅ **Full-Stack**: Any combination of frontend + backend
- ✅ **Mobile**: React Native, Flutter, etc.
- ✅ **CLI/Tools**: Command-line applications

### What Gets Detected Automatically

1. **Project Type**: From directory structure and dependency files
2. **Tech Stack**: From `package.json`, `requirements.txt`, `go.mod`, etc.
3. **Frameworks**: From dependencies and configuration files
4. **Modules/Features**: From directory structure
5. **Patterns**: From existing code structure

### What Gets Generated

- **Always Generated**: `overview.mdc`, `tech-stack.mdc`, `module-structure.mdc`, `src-index.mdc`, `utils-index.mdc`, `CURSOR_USAGE_GUIDE.mdc`
- **Frontend Only**: `routing.mdc`, `state-management.mdc`, `data-fetching.mdc`, `component-patterns.mdc`, `components-index.mdc`, `hooks-index.mdc`, `routes-index.mdc`, `stores-index.mdc`
- **Backend Only**: `database.mdc`, `service-patterns.mdc`, `controllers-index.mdc`, `services-index.mdc`, `models-index.mdc`
- **Full-Stack**: All files from both frontend and backend

### Example: Using in a Backend Project

**Backend Project (Node.js/Express)**:

- System detects: Backend project, Node.js, Express, MongoDB, Mongoose
- Generates: `overview.mdc`, `tech-stack.mdc`, `api-integration.mdc`, `database.mdc`, `service-patterns.mdc`, `module-structure.mdc`
- Generates indexes: `src-index.mdc`, `controllers-index.mdc`, `services-index.mdc`, `models-index.mdc`, `utils-index.mdc`
- Skips: `routing.mdc`, `state-management.mdc`, `component-patterns.mdc`, `components-index.mdc`, etc.

### Example: Using in a Vue Frontend Project

**Vue Frontend Project**:

- System detects: Frontend project, Vue 3, Vue Router, Pinia, Vite
- Generates: `overview.mdc`, `tech-stack.mdc`, `routing.mdc`, `state-management.mdc`, `data-fetching.mdc`, `component-patterns.mdc`, `api-integration.mdc`, `module-structure.mdc`
- Generates indexes: `src-index.mdc`, `components-index.mdc`, `routes-index.mdc`, `stores-index.mdc` (Pinia stores), `utils-index.mdc`
- Adapts: Patterns to Vue-specific (Composition API, Vue Router, Pinia)

### Example: Using in a Python/Django Backend Project

**Python/Django Backend Project**:

- System detects: Backend project, Python, Django, PostgreSQL, Django REST Framework
- Generates: `overview.mdc`, `tech-stack.mdc`, `api-integration.mdc`, `database.mdc`, `service-patterns.mdc`, `module-structure.mdc`
- Generates indexes: `src-index.mdc`, `controllers-index.mdc` (Django views), `services-index.mdc`, `models-index.mdc` (Django models), `utils-index.mdc`
- Adapts: Patterns to Django-specific (views, models, serializers, URLs)
